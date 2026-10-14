import 'server-only';
import { z } from 'zod';
import { apiFailure, guardRateLimit, HttpError, privateJson, readJson, requireOrigin } from './api';
import { site } from './config';
import { serviceDatabase } from './database/service';
import { sendMail } from './email';
import { subscriptionConfirmationMail } from './email-templates';
import { newToken, requestIp } from './security';
import { emailSchema } from './validation';

const subscribeSchema = z.object({ email: emailSchema, website: z.string().max(0).optional().default('') }).strict();
const validToken = (token: string | undefined): token is string => Boolean(token && /^[a-f0-9]{64}$/.test(token));
export type SubscriptionResult = 'confirmed' | 'unsubscribed' | 'invalid' | 'unavailable';
export function unsubscribeUrl(token: string) { return new URL(`/unsubscribe?token=${token}`, site.url).href; }

export async function requestSubscription(request: Request) {
  try {
    requireOrigin(request);
    const { email } = subscribeSchema.parse(await readJson(request, 4096));
    if (!process.env.DATABASE_URL || !process.env.RESEND_API_KEY || !process.env.MAIL_FROM) throw new HttpError('Subscriptions are not connected yet. Please try again soon.', 503);
    await guardRateLimit('subscribe-ip', requestIp(request), 20, 3600);
    await guardRateLimit('subscribe-email', email, 5, 3600);
    await guardRateLimit('subscribe-cooldown', email, 1, 60);
    const { data, error } = await serviceDatabase().rpc<{ confirmed: boolean; token: string }>('prepare_subscription', { p_email: email, p_token: newToken() });
    if (error || !data) throw new HttpError('We could not start your subscription. Please try again.', 503);
    if (!data.confirmed) {
      const confirm = new URL(`/subscribe/confirm?token=${data.token}`, site.url).href;
      await sendMail({ to: email, ...subscriptionConfirmationMail(confirm),
        unsubscribeUrl: unsubscribeUrl(data.token), idempotencyKey: `subscription-confirmation/${data.token}`,
      });
    }
    return privateJson({ ok: true });
  } catch (error) { return apiFailure(error); }
}

/** Token pages never return the subscriber's identity to their renderer. */
export async function getSubscriptionResult(token: string | undefined, action: 'confirm' | 'unsubscribe'): Promise<SubscriptionResult> {
  if (!validToken(token)) return 'invalid';
  try {
    if (action === 'confirm') {
      const { data, error } = await serviceDatabase().rpc<boolean>('confirm_subscription', { p_token: token });
      return error ? 'unavailable' : data ? 'confirmed' : 'invalid';
    }
    const { error } = await serviceDatabase().from('subscribers').delete().eq('token', token);
    return error ? 'unavailable' : 'unsubscribed';
  } catch { return 'unavailable'; }
}
