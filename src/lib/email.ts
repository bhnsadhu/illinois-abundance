import 'server-only';
import { Resend } from 'resend';
import { site } from '@/lib/config';
import { escapeHtml, safeUrl } from '@/lib/format';

export type Mail = {
  to: string;
  subject: string;
  /** Trusted template HTML. Escape any author or admin supplied text first. */
  html: string;
  text?: string;
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
  const wordmark = escapeHtml(new URL('/brand/logo-wordmark-horizontal.png', site.url).href);
  const footer = unsubscribe
    ? `<p><a href="${escapeHtml(unsubscribe)}" style="color:#315c59">Unsubscribe in one click</a></p>`
    : `<p>Questions? <a href="mailto:${escapeHtml(site.contact)}" style="color:#315c59">Email Illinois Abundance</a>.</p>`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body style="margin:0;background:#fffbe4;color:#121515;font-family:Arial,sans-serif"><main style="max-width:560px;margin:0 auto;padding:40px 24px"><a href="${escapeHtml(site.url)}"><img src="${wordmark}" alt="Illinois Abundance" width="240" style="display:block;width:240px;max-width:100%;height:auto;margin-bottom:36px"></a><div style="font-size:18px;line-height:1.65">${mail.html}</div><footer style="margin-top:36px;padding-top:20px;border-top:1px solid #dedac4;font-size:13px;line-height:1.6">${footer}<p>Student writing on local policy in Champaign Urbana.</p></footer></main></body></html>`;
  const { data, error } = await new Resend(apiKey).emails.send({
    from,
    to: mail.to,
    subject: mail.subject,
    html,
    ...(mail.text ? { text: `${mail.text}\n\nIllinois Abundance\n${unsubscribe ? `Unsubscribe: ${unsubscribe}` : `Contact: ${site.contact}`}` } : {}),
    ...(unsubscribe ? { headers: { 'List-Unsubscribe': `<${unsubscribe}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } } : {}),
  }, { idempotencyKey: mail.idempotencyKey });
  // Provider errors can contain recipients and request details. Never expose or log them.
  if (error || !data?.id) throw new Error('We could not send that email. Please try again in a moment.');
  return data.id;
}
