import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { digestMail, renderEmail, submissionCodeMail, submissionReceiptMail, subscriptionConfirmationMail } from '../src/lib/email-templates';
import { site } from '../src/lib/config';
import { escapeHtml } from '../src/lib/format';

// Render only: no mail provider, database, credentials, or delivery calls.
const directory = resolve('.vercel/email-previews');
const unsubscribe = new URL('/unsubscribe?token=preview-only', site.url).href;
const event = { id: 'preview-event', title: 'A conversation about the place we share', description: 'Bring a question, bring a friend. We’ll talk about what makes a campus and its neighborhoods feel like home.', starts_at: '2026-11-12T23:00:00Z', location: 'On campus · preview event', rsvp_url: null };
const previews = [
  { name: 'submission-code', label: 'Submission code', content: submissionCodeMail('012345') },
  { name: 'submission-received', label: 'Submission received', content: submissionReceiptMail('Alex') },
  { name: 'subscription-confirmation', label: 'Newsletter confirmation', content: subscriptionConfirmationMail(new URL('/subscribe/confirm?token=preview-only', site.url).href), unsubscribe },
  { name: 'digest', label: 'Stories and campus event', content: digestMail({ posts: [
    { id: 'preview-post', slug: 'preview-story', headline: 'What would it mean to make room for everyone?', short_version: 'A student perspective on more homes, closer neighbors, and a campus that welcomes the people who make it what it is.', published_at: '2026-11-10T18:00:00Z' },
  ], event }), unsubscribe },
  { name: 'event-only', label: 'Campus event only', content: digestMail({ posts: [], event }), unsubscribe },
  { name: 'long-name', label: 'Long name and special characters', content: submissionReceiptMail('Alexandra ' + 'N'.repeat(110) + ' 王 & María <reader>') },
];
await mkdir(directory, { recursive: true });
for (const preview of previews) {
  const rendered = renderEmail(preview.content, preview.unsubscribe);
  await writeFile(resolve(directory, `${preview.name}.html`), rendered.html);
  await writeFile(resolve(directory, `${preview.name}.txt`), rendered.text);
}
await writeFile(resolve(directory, 'index.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Illinois Abundance email previews</title></head><body style="max-width:680px;margin:40px auto;padding:0 24px;font:16px/1.6 system-ui;background:#fffbe4;color:#202722"><h1>Email previews</h1><p>Local examples only. No emails have been sent. Codes, links, stories, and events below are preview data.</p><ul>${previews.map(preview => `<li style="margin-bottom:20px"><a href="${preview.name}.html">${escapeHtml(preview.label)}</a><br><strong>Subject:</strong> ${escapeHtml(preview.content.subject)}<br><strong>Inbox preview:</strong> ${escapeHtml(preview.content.preview)}<br><a href="${preview.name}.txt">Plain text</a></li>`).join('')}</ul></body></html>`);
console.log(`Email previews written to ${directory}/index.html. Nothing was sent.`);
