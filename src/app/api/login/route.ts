import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { site } from '@/lib/config';
import { apiFailure, guardRateLimit, HttpError, privateJson, readJson, requireOrigin } from '@/lib/api';
import { sendMail } from '@/lib/email';
import { escapeHtml } from '@/lib/format';
import { newToken, requestIp } from '@/lib/security';
import { hashLoginToken } from '@/lib/auth';
import { serviceDatabase } from '@/lib/database/service';
import { emailSchema } from '@/lib/validation';

export const runtime = 'nodejs';
const schema = z.object({ email: emailSchema, website: z.string().max(0).optional().default('') });
export async function POST(request: Request) {
  try {
    requireOrigin(request);
    const input = schema.parse(await readJson(request, 4096));
    if (!process.env.DATABASE_URL || !process.env.RESEND_API_KEY || !process.env.MAIL_FROM || (process.env.CODE_PEPPER?.length ?? 0) < 32) {
      throw new HttpError('Reviewer login is not connected yet. Please try again soon.', 503);
    }
    await guardRateLimit('login-ip', requestIp(request), 20, 3600);
    await guardRateLimit('login-email', input.email, 5, 3600);
    await guardRateLimit('login-cooldown', input.email, 1, 60);
    const db = serviceDatabase();
    const { data: reviewer, error: lookupError } = await db.from('reviewers').select('id').eq('email', input.email).eq('is_active', true).maybeSingle();
    if (lookupError) throw new HttpError('Please try again in a moment.', 503);
    const isAdmin = Boolean(process.env.ADMIN_EMAIL?.trim()) && input.email === process.env.ADMIN_EMAIL?.trim().toLowerCase();
    if (!reviewer && !isAdmin) return privateJson({ ok: true });
    const token = newToken();
    const { error } = await db.from('login_tokens').insert({
      token_hash: hashLoginToken(token), email: input.email, expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });
    if (error) throw new HttpError('We could not send your link. Please try again.', 503);
    const callback = new URL('/auth/callback', site.url);
    callback.searchParams.set('token', token);
    await sendMail({ to: input.email, subject: 'Sign in to Illinois Abundance',
      html: `<h1 style="font-size:30px;line-height:1.15">Welcome back.</h1><p><a href="${escapeHtml(callback.href)}" style="color:#315c59">Sign in to the review desk</a></p><p>This link works once and expires in 15 minutes. If you did not request it, you can ignore this email.</p>`,
      text: `Sign in to the Illinois Abundance review desk: ${callback.href}\nThis link works once and expires in 15 minutes. If you did not request it, you can ignore this email.`,
      idempotencyKey: `reviewer-login/${randomUUID()}`,
    });
    return privateJson({ ok: true });
  } catch (error) { return apiFailure(error); }
}
