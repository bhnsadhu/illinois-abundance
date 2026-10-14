import { site } from '@/lib/config';
import { escapeHtml, formatDate, safeUrl } from '@/lib/format';
import type { DigestSnapshot } from '@/lib/digest';

export type EmailContent = {
  subject: string;
  preview: string;
  eyebrow: string;
  title: string;
  /** Trusted template markup. Escape reader and editor supplied values. */
  html: string;
  text: string;
};

const colors = { cream: '#fffbe4', paper: '#fffef8', ink: '#202722', teal: '#244e49', mint: '#e3efea', muted: '#5b635e', line: '#e8e3cf' };
const bodyFont = "-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif";
const headingFont = "'Patrick Hand','Segoe Print','Bradley Hand',Arial,sans-serif";
const paragraph = (text: string) => `<p style="margin:0 0 18px">${text}</p>`;
const note = (text: string) => `<p style="margin:22px 0 0;color:${colors.muted};font-size:14px;line-height:22px">${text}</p>`;
const link = (label: string, url: string) => `<a href="${escapeHtml(url)}" style="color:${colors.teal};text-decoration:underline;text-underline-offset:3px">${escapeHtml(label)}</a>`;
function button(label: string, url: string) {
  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:26px 0 8px"><tr><td bgcolor="${colors.teal}" style="border-radius:28px;text-align:center;mso-padding-alt:14px 24px"><a href="${escapeHtml(url)}" style="display:inline-block;border:1px solid ${colors.teal};border-radius:28px;padding:14px 24px;color:${colors.paper};font-family:${bodyFont};font-size:16px;font-weight:600;line-height:22px;text-decoration:none;mso-padding-alt:0">${escapeHtml(label)}</a></td></tr></table>`;
}
const signature = () => `<p style="margin:28px 0 0;font-size:15px;line-height:24px">See you around campus,<br><strong style="font-weight:600">The Illinois Abundance team</strong></p>`;
const latestUrl = () => new URL('/latest', site.url).href;

export function submissionCodeMail(code: string): EmailContent {
  if (!/^\d{6}$/.test(code)) throw new Error('A six-digit code is required.');
  return {
    subject: 'Your code for Illinois Abundance',
    preview: 'One last step before your piece reaches our reviewers. Your code is good for 10 minutes.',
    eyebrow: 'YOUR VOICE BELONGS HERE', title: 'One last step.',
    html: paragraph('Thanks for sharing your perspective. Enter this code on the page you just left to send your piece to our reviewers.') +
      `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin:26px 0"><tr><td align="center" bgcolor="${colors.mint}" style="padding:24px 12px;border:1px solid ${colors.mint};border-radius:18px"><p style="margin:0 0 10px;color:${colors.teal};font-size:11px;font-weight:600;line-height:18px;letter-spacing:1.5px">YOUR SIX-DIGIT CODE</p><p style="margin:0;color:${colors.teal};font-family:'Courier New',monospace;font-size:36px;font-weight:700;line-height:46px;letter-spacing:6px">${code}</p><p style="margin:10px 0 0;color:${colors.teal};font-size:13px;line-height:20px">Good for 10 minutes</p></td></tr></table>` +
      note('Didn’t send a piece? You can ignore this email.'),
    text: `Your Illinois Abundance code is ${code}.\n\nThanks for sharing your perspective. Enter this code on the page you just left to send your piece to our reviewers. It expires in 10 minutes.\n\nDidn’t send a piece? You can ignore this email.`,
  };
}

export function submissionReceiptMail(name: string): EmailContent {
  return {
    subject: 'Your piece is with Illinois Abundance',
    preview: 'Thanks for adding your voice. Here’s what happens next.',
    eyebrow: 'THANKS FOR WRITING', title: 'Your piece is with us.',
    html: paragraph(`Hi ${escapeHtml(name)},`) +
      paragraph('Thanks for putting your thoughts into words and sharing them with us. A reviewer will read your piece and get in touch by email to work through any edits.') +
      paragraph('For now, it stays between you and the review team. It will appear on the site only after a reviewer publishes it.') +
      paragraph('Want to change something or take it down later? Just reply to this email.') +
      button('Read the latest stories', latestUrl()) + signature(),
    text: `Hi ${name},\n\nThanks for putting your thoughts into words and sharing them with us. A reviewer will read your piece and get in touch by email to work through any edits.\n\nFor now, it stays between you and the review team. It will appear on the site only after a reviewer publishes it.\n\nWant to change something or take it down later? Just reply to this email.\n\nRead the latest stories: ${latestUrl()}\n\nSee you around campus,\nThe Illinois Abundance team`,
  };
}

export function subscriptionConfirmationMail(confirmUrl: string): EmailContent {
  const confirm = safeUrl(confirmUrl);
  if (!confirm) throw new Error('A valid confirmation link is required.');
  return {
    subject: 'A little more Abundance in your inbox',
    preview: 'Confirm your subscription for student stories and campus gatherings, sent occasionally.',
    eyebrow: 'STAY IN THE LOOP', title: 'A little more possibility.',
    html: paragraph('New student stories. Ideas for the place we share. A reason to get together on campus.') +
      paragraph('Confirm below and we’ll send you an occasional note from Illinois Abundance. We’d love to have you along.') +
      button('Confirm my subscription', confirm) +
      note('Didn’t ask to join? You can ignore this email. You’ll only hear from us after you confirm.'),
    text: `A little more possibility.\n\nNew student stories. Ideas for the place we share. A reason to get together on campus.\n\nConfirm below and we’ll send you an occasional note from Illinois Abundance. We’d love to have you along.\n\nConfirm my subscription: ${confirm}\n\nDidn’t ask to join? You can ignore this email. You’ll only hear from us after you confirm.`,
  };
}

export function digestMail(snapshot: DigestSnapshot): EmailContent {
  const { posts, event } = snapshot;
  const reading = posts.length === 1 ? 'A new story' : 'A few new perspectives';
  const intro = posts.length && event ? `${reading} to read, and a chance to get together. Here’s what’s happening in our corner of campus.`
    : posts.length ? `${reading} from the place we share. Find a little time to read, and let us know what you think.`
      : 'We’re getting together on campus, and you’re invited. Come with a question, an idea, or a friend.';
  const postsHtml = posts.map(post => {
    const url = new URL(`/post/${post.slug}`, site.url).href;
    return `<tr><td style="padding:24px 0;border-top:1px solid ${colors.line}"><h2 style="margin:0 0 10px;font-size:23px;font-weight:600;line-height:30px;letter-spacing:-0.3px">${link(post.headline, url)}</h2><p style="margin:0 0 12px;font-size:16px;line-height:26px">${escapeHtml(post.short_version)}</p><p style="margin:0;font-size:14px;line-height:22px">${link('Read the story →', url)}</p></td></tr>`;
  }).join('');
  const eventDate = event ? formatDate(event.starts_at, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }) : '';
  const eventsUrl = new URL('/events', site.url).href;
  const eventHtml = event ? `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin:16px 0"><tr><td bgcolor="${colors.mint}" style="padding:24px;border:1px solid ${colors.mint};border-radius:18px"><p style="margin:0 0 12px;color:${colors.teal};font-size:11px;font-weight:600;line-height:18px;letter-spacing:1.5px">COME WITH A QUESTION</p><h2 style="margin:0 0 14px;font-size:23px;font-weight:600;line-height:30px;letter-spacing:-0.3px">${escapeHtml(event.title)}</h2><p style="margin:0 0 14px;color:${colors.teal};font-size:14px;line-height:23px">${escapeHtml(eventDate)}<br>${escapeHtml(event.location)}</p>${event.description ? `<p style="margin:0 0 18px;font-size:16px;line-height:26px">${escapeHtml(event.description)}</p>` : ''}<p style="margin:0;font-size:15px;line-height:24px">${link('See the event details →', eventsUrl)}</p></td></tr></table>` : '';
  return {
    subject: posts.length === 1 ? 'A new story from Illinois Abundance' : posts.length ? 'A few good reads from Illinois Abundance' : 'Come join us on campus — Illinois Abundance',
    preview: posts.length && event ? `${posts.length === 1 ? 'A fresh student story' : 'Fresh student stories'} and our next campus gathering.` : posts.length ? 'New perspectives from the place we share.' : 'Our next campus gathering. We’d love to see you there.',
    eyebrow: 'FROM OUR CORNER OF CAMPUS', title: 'A little more possibility.',
    html: paragraph(intro) + (postsHtml ? `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-top:28px">${postsHtml}</table>` : '') + eventHtml + signature(),
    text: `A little more possibility.\n\n${intro}${posts.length ? '\n\n' + posts.map(post => `${post.headline}\n${post.short_version}\nRead the story: ${new URL(`/post/${post.slug}`, site.url).href}`).join('\n\n') : ''}${event ? `\n\nCome with a question\n${event.title}\n${eventDate}\n${event.location}${event.description ? '\n' + event.description : ''}\nEvent details: ${eventsUrl}` : ''}\n\nSee you around campus,\nThe Illinois Abundance team`,
  };
}

/** Inline styles and presentation tables keep the essential layout usable when
 * an email client removes the optional web font, media query, or remote logo. */
export function renderEmail(mail: EmailContent, unsubscribeUrl?: string | null) {
  const unsubscribe = unsubscribeUrl ? safeUrl(unsubscribeUrl) : null;
  if (unsubscribeUrl && !unsubscribe) throw new Error('Invalid unsubscribe link.');
  const home = escapeHtml(site.url);
  const wordmark = escapeHtml(new URL('/brand/logo-wordmark-horizontal.png', site.url).href);
  const font = escapeHtml(new URL('/fonts/PatrickHand-Regular.woff2', site.url).href);
  const footer = unsubscribe ? `<p style="margin:14px 0 0">${link('Unsubscribe', unsubscribe)} whenever you like.</p>` : '';
  return {
    html: `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${escapeHtml(mail.subject)}</title>
<style>@font-face{font-family:'Patrick Hand';font-style:normal;font-weight:400;src:url("${font}") format('woff2')}body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}img{border:0;outline:none;text-decoration:none}a:focus-visible{outline:2px solid ${colors.teal};outline-offset:4px}@media only screen and (max-width:480px){.email-outer{padding:16px 8px!important}.email-content{padding:30px 22px!important}.email-title{font-size:34px!important}}</style>
<!--[if mso]><style>.email-title{font-family:Arial,sans-serif!important}table{border-collapse:collapse}</style><![endif]--></head>
<body style="margin:0;padding:0;width:100%;background-color:${colors.cream};color:${colors.ink};font-family:${bodyFont}">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">${escapeHtml(mail.preview)}</div>
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="${colors.cream}"><tr><td class="email-outer" align="center" style="padding:36px 16px">
<!--[if mso]><table role="presentation" width="600" border="0" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="${colors.paper}" style="width:100%;max-width:600px;border:1px solid ${colors.line};border-radius:24px"><tr><td class="email-content" style="padding:40px;overflow-wrap:anywhere;word-break:break-word;font-family:${bodyFont};font-size:17px;line-height:28px">
<a href="${home}" style="display:inline-block;color:${colors.teal};text-decoration:none"><img src="${wordmark}" alt="Illinois Abundance" width="250" height="23" style="display:block;width:250px;max-width:100%;height:auto;color:${colors.teal};font-size:20px;font-weight:600"></a>
<p style="margin:38px 0 12px;color:${colors.teal};font-size:11px;font-weight:600;line-height:18px;letter-spacing:1.5px">${escapeHtml(mail.eyebrow)}</p>
<h1 class="email-title" style="margin:0 0 24px;color:${colors.ink};font-family:${headingFont};font-size:40px;font-weight:400;line-height:1.12;letter-spacing:-0.5px">${escapeHtml(mail.title)}</h1>
${mail.html}
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-top:34px"><tr><td style="border-top:1px solid ${colors.line};padding-top:22px;color:${colors.muted};font-size:13px;line-height:21px"><p style="margin:0 0 8px;color:${colors.teal};font-size:15px;font-weight:600">Building up our village.</p><p style="margin:0">Student stories &amp; campus gatherings.<br>Illinois Abundance · Champaign-Urbana</p><p style="margin:14px 0 0">Have a question? Reply to this email or <a href="mailto:${escapeHtml(site.contact)}" style="color:${colors.teal};text-decoration:underline">get in touch</a>.</p>${footer}</td></tr></table>
</td></tr></table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`,
    text: `${mail.text}\n\nIllinois Abundance · Champaign-Urbana\nBuilding up our village.\nHave a question? Reply to this email or contact ${site.contact}.${unsubscribe ? `\nUnsubscribe: ${unsubscribe}` : ''}`,
  };
}
