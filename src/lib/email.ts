import 'server-only';
import { Resend } from 'resend';
import { site } from '@/lib/config';
import { safeUrl } from '@/lib/format';
import { renderEmail, type EmailContent } from '@/lib/email-templates';

export type Mail = EmailContent & {
  to: string;
  idempotencyKey: string;
  unsubscribeUrl?: string;
};

/** Shared wrapper for transactional mail and the manually sent digest. */
export async function sendMail(mail: Mail): Promise<string> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!apiKey || !from) throw new Error('Email is not connected yet. Please try again soon.');
  const unsubscribe = mail.unsubscribeUrl ? safeUrl(mail.unsubscribeUrl) : null;
  if (mail.unsubscribeUrl && !unsubscribe) throw new Error('Invalid unsubscribe link.');
  const rendered = renderEmail(mail, unsubscribe);
  const { data, error } = await new Resend(apiKey).emails.send({
    from,
    to: mail.to,
    subject: mail.subject,
    replyTo: site.contact,
    ...rendered,
    ...(unsubscribe ? { headers: { 'List-Unsubscribe': `<${unsubscribe}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } } : {}),
  }, { idempotencyKey: mail.idempotencyKey });
  // Provider errors can contain recipients and request details. Never expose or log them.
  if (error || !data?.id) throw new Error('We could not send that email. Please try again in a moment.');
  return data.id;
}
