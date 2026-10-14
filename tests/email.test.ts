import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { digestMail, renderEmail, submissionCodeMail, submissionReceiptMail, subscriptionConfirmationMail } from '@/lib/email-templates';
import { sendMail } from '@/lib/email';
import { site } from '@/lib/config';
import { escapeHtml } from '@/lib/format';

const mocks = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('resend', () => ({ Resend: class { emails = { send: mocks.send }; } }));
beforeEach(() => {
  vi.stubEnv('RESEND_API_KEY', 'test-only');
  vi.stubEnv('MAIL_FROM', 'Illinois Abundance <mail@example.test>');
  mocks.send.mockReset().mockResolvedValue({ data: { id: 'test-delivery' }, error: null });
});
afterEach(() => vi.unstubAllEnvs());

describe('branded email content and delivery', () => {
  it('keeps verification codes readable as text, including leading zeroes, without remote images or fonts', () => {
    const mail = renderEmail(submissionCodeMail('012345'));
    expect(mail.text).toContain('code is 012345');
    expect(mail.text).toContain('10 minutes');
    expect(mail.html).toContain('>012345</p>');
    expect(mail.html).not.toContain('<img src="012345');
    expect(() => submissionCodeMail('12345')).toThrow('six-digit');
    expect(() => submissionCodeMail('<script>')).toThrow('six-digit');
  });

  it('escapes author names and all envelope text while preserving a useful plain-text message', () => {
    const name = '王 <img src=x onerror="alert(1)"> & Ana';
    const receipt = submissionReceiptMail(name);
    const mail = renderEmail({ ...receipt, preview: '<script>preview</script>', title: '<img onerror=alert(1)>', eyebrow: 'A & B', subject: '<script>subject</script>' });
    expect(mail.html).toContain(escapeHtml(name));
    expect(mail.html).toContain('&lt;script&gt;preview&lt;/script&gt;');
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).not.toContain('<img src=x');
    expect(mail.html).not.toContain('<img onerror=');
    expect(mail.text).toContain(`Hi ${name},`);
    expect(mail.text).toContain('only after a reviewer publishes it');
    expect(mail.text).toContain('Just reply to this email');
  });

  it('preserves confirmation and unsubscribe tokens in both formats and rejects unsafe action links', () => {
    const confirm = new URL('/subscribe/confirm?token=abc&source=email', site.url).href;
    const unsubscribe = new URL('/unsubscribe?token=abc', site.url).href;
    const mail = renderEmail(subscriptionConfirmationMail(confirm), unsubscribe);
    expect(mail.html).toContain(`href="${escapeHtml(confirm)}"`);
    expect(mail.text).toContain(confirm);
    expect(mail.html).toContain(`href="${unsubscribe}"`);
    expect(mail.text).toContain(`Unsubscribe: ${unsubscribe}`);
    expect(() => subscriptionConfirmationMail('javascript:alert(1)')).toThrow('valid confirmation');
    expect(() => renderEmail(submissionCodeMail('123456'), 'javascript:alert(1)')).toThrow('Invalid unsubscribe');
  });

  it('escapes digest content and includes the campus time zone and public story links', () => {
    const unsafe = '<script>alert("editor text")</script>';
    const mail = renderEmail(digestMail({
      posts: [{ id: 'post', slug: 'campus-story', headline: unsafe, short_version: unsafe, published_at: '2026-10-13T18:00:00Z' }],
      event: { id: 'event', title: unsafe, description: unsafe, location: unsafe, starts_at: '2026-11-01T23:00:00Z', rsvp_url: null },
    }), new URL('/unsubscribe?token=test', site.url).href);
    expect(mail.html).not.toContain('<script>');
    expect(mail.html.match(/&lt;script&gt;/g)).toHaveLength(5);
    expect(mail.text).toContain('/post/campus-story');
    expect(mail.text).toContain('5:00 PM CST');
    expect(mail.text).toContain('/events');
    const eventOnly = digestMail({ posts: [], event: { id: 'event', title: 'Campus conversation', description: '', location: 'Campus', starts_at: '2026-11-01T23:00:00Z', rsvp_url: null } });
    expect(eventOnly.subject).toContain('Come join us');
    expect(eventOnly.text).not.toContain('new perspectives');
  });

  it('routes replies to the contact inbox and retains delivery idempotency and one-click unsubscribe', async () => {
    const unsubscribe = new URL('/unsubscribe?token=example', site.url).href;
    const content = subscriptionConfirmationMail(new URL('/subscribe/confirm?token=example', site.url).href);
    expect(await sendMail({ ...content, to: 'reader@example.test', idempotencyKey: 'subscription-confirmation/example', unsubscribeUrl: unsubscribe })).toBe('test-delivery');
    const [message, options] = mocks.send.mock.calls[0];
    expect(message).toMatchObject({ subject: content.subject, replyTo: site.contact, headers: {
      'List-Unsubscribe': `<${unsubscribe}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    } });
    expect(message.html).toContain(content.preview);
    expect(message.text).toContain(content.text);
    expect(options).toEqual({ idempotencyKey: 'subscription-confirmation/example' });
    await sendMail({ ...submissionCodeMail('123456'), to: 'writer@illinois.edu', idempotencyKey: 'submission-code/example' });
    expect(mocks.send.mock.calls[1][0]).not.toHaveProperty('headers');
  });
});
