import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { NextRequest } from 'next/server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as requestCode } from '@/app/api/submissions/route';
import { POST as verifyCode } from '@/app/api/submissions/verify/route';
import { POST as resendCode } from '@/app/api/submissions/resend/route';
import { hashCode } from '@/lib/codes';
import { site } from '@/lib/config';
import { sendMail } from '@/lib/email';

const mocks = vi.hoisted(() => ({ sendEmail: vi.fn(), generateCode: vi.fn() }));
vi.mock('resend', () => ({ Resend: class { emails = { send: mocks.sendEmail }; } }));
vi.mock('@/lib/codes', async (original) => ({ ...await original<typeof import('@/lib/codes')>(), generateCode: mocks.generateCode }));
vi.mock('@/lib/database/service', () => ({ serviceDatabase: () => databaseAdapter() }));

let db: PGlite;
let databaseCalls = 0;
type Message = { to: string; html: string; text: string; subject: string; headers?: Record<string, string> };
let delivered: Map<string, Message>;
const pepper = 'test-pepper-with-at-least-thirty-two-characters';
const body = '\n  CHAMPAIGN, Ill. We can make room for more neighbors.\n\n## What could change?\nMore homes near campus.\n';
const form = { name: 'Student Writer', email: 'student@illinois.edu', body, website: '' };

// The production Neon transport is adapted to real PostgreSQL. No RPC logic
// is mocked: RLS, attempts, transactions, rate limits, and archives really run.
function databaseAdapter() {
  return {
    async rpc(name: string, args: Record<string, unknown>) {
      databaseCalls++;
      try {
        const entries = Object.entries(args);
        const result = await db.query<{ result: unknown }>(
          `select public.${name}(${entries.map(([key], i) => `${key} => $${i + 1}`).join(',')}) as result`, entries.map(([, value]) => value),
        );
        return { data: result.rows[0].result, error: null };
      } catch { return { data: null, error: { code: 'TEST_SQL_ERROR' } }; }
    },
    from(table: string) {
      if (table !== 'email_verifications') throw new Error(`Unexpected test table: ${table}`);
      return {
        select: () => ({ eq: (_column: string, id: string) => ({
          async maybeSingle() {
            databaseCalls++;
            const result = await db.query('select id,email,author_name,original_body,verified_at,post_id,confirmation_sent_at from email_verifications where id=$1', [id]);
            return { data: result.rows[0] ?? null, error: null };
          },
        }) }),
        update: (values: { confirmation_sent_at: string }) => ({ eq: (_column: string, id: string) => ({
          async is() {
            databaseCalls++;
            await db.query('update email_verifications set confirmation_sent_at=$1 where id=$2 and confirmation_sent_at is null', [values.confirmation_sent_at, id]);
            return { data: null, error: null };
          },
        }) }),
      };
    },
  };
}

function request(path: string, input: unknown, cookie?: string, extraHeaders: Record<string, string> = {}) {
  return new NextRequest(new URL(path, site.url), {
    method: 'POST', headers: { origin: new URL(site.url).origin, 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...extraHeaders },
    body: JSON.stringify(input),
  });
}

async function beginSubmission() {
  const response = await requestCode(request('/api/submissions', form));
  expect(response.status).toBe(200);
  const cookie = response.headers.get('set-cookie')!.split(';')[0];
  const id = cookie.split('=')[1];
  const code = [...delivered.values()][0].text.match(/\b(\d{6})\b/)![1];
  return { response, cookie, id, code };
}

beforeAll(async () => {
  db = new PGlite();
  const directory = new URL('../db/migrations/', import.meta.url);
  for (const file of (await readdir(directory)).filter(file => file.endsWith('.sql')).sort()) {
    await db.exec(await readFile(new URL(file, directory), 'utf8'));
  }
  await db.exec(await readFile(new URL('../db/seed.sql', import.meta.url), 'utf8'));
}, 30000);

beforeEach(async () => {
  await db.exec('begin');
  databaseCalls = 0;
  delivered = new Map();
  vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost/test');
  vi.stubEnv('RESEND_API_KEY', 'test-only-mail-key');
  vi.stubEnv('MAIL_FROM', 'Illinois Abundance <test@example.test>');
  vi.stubEnv('CODE_PEPPER', pepper);
  let codeCounter = 123455;
  mocks.generateCode.mockReset().mockImplementation(() => String(++codeCounter));
  mocks.sendEmail.mockReset().mockImplementation(async (message: Message, options: { idempotencyKey: string }) => {
    if (!delivered.has(options.idempotencyKey)) delivered.set(options.idempotencyKey, message);
    return { data: { id: 'provider-test-id' }, error: null };
  });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(async () => { await db.exec('rollback; reset role'); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
afterAll(async () => { await db.close(); });

describe('submission HTTP routes with real PostgreSQL', () => {
  it('stores only a peppered code hash, preserves exact text, and returns an opaque protected cookie', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { response, id, code } = await beginSubmission();
    expect(await response.json()).toEqual({ ok: true });
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('set-cookie')).toMatch(/HttpOnly/);
    expect(response.headers.get('set-cookie')).toMatch(/SameSite=lax/i);
    expect(response.headers.get('set-cookie')).toMatch(/Secure/);
    expect(response.headers.get('set-cookie')).not.toContain(form.email);
    const record = (await db.query<{ code_hash: string; original_body: string }>('select code_hash,original_body from email_verifications')).rows[0];
    expect(record.code_hash).toBe(hashCode(id, code, pepper));
    expect(record.code_hash).not.toBe(code);
    expect(record.original_body).toBe(body);
    expect((await db.query('select * from posts')).rows).toHaveLength(0);
  });

  it('rejects foreign origins, honeypots, and deceptive domains before accessing the database or sending mail', async () => {
    for (const [input, headers, expectedStatus] of [
      [form, { origin: 'https://evil.example' }, 403],
      [{ ...form, website: 'spam' }, {}, 400],
      [{ ...form, email: 'student@illinois.edu.evil.test' }, {}, 400],
    ] as const) {
      expect((await requestCode(request('/api/submissions', input, undefined, headers))).status).toBe(expectedStatus);
    }
    expect(databaseCalls).toBe(0);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it('caps streamed bodies without relying on a Content-Length header', async () => {
    const response = await requestCode(request('/api/submissions', { ...form, body: 'x'.repeat(90_001) }));
    expect(response.status).toBe(413);
    expect(databaseCalls).toBe(0);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it('returns an honest unavailable response when secrets are missing', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    const response = await requestCode(request('/api/submissions', form));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'Submissions are not connected yet. Please try again soon.' });
    expect(databaseCalls).toBe(0);
  });

  it('rate limits repeated email requests and resends through shared SQL state', async () => {
    const { cookie } = await beginSubmission();
    const immediate = await resendCode(request('/api/submissions/resend', {}, cookie));
    expect(immediate.status).toBe(429);
    expect(immediate.headers.get('retry-after')).toBe('60');
    expect(delivered.size).toBe(1);
    for (let attempt = 0; attempt < 4; attempt++) {
      await db.exec("update rate_limits set window_started_at=now()-interval '61 seconds' where key like 'submission-code-cooldown:%'");
      await resendCode(request('/api/submissions/resend', {}, cookie));
    }
    await db.exec("update rate_limits set window_started_at=now()-interval '61 seconds' where key like 'submission-code-cooldown:%'");
    expect((await resendCode(request('/api/submissions/resend', {}, cookie))).status).toBe(429);
    expect(delivered.size).toBeLessThanOrEqual(5);
  });

  it('caps a single IP even when each request has a different email address', async () => {
    await beginSubmission();
    await db.exec("update rate_limits set requests=30 where key like 'submission-code-ip:%'");
    expect((await requestCode(request('/api/submissions', { ...form, email: 'different@illinois.edu' }))).status).toBe(429);
    expect(delivered.size).toBe(1);
  });

  it('expires codes, invalidates the old hash on resend, and uses stored identity for delivery', async () => {
    const { cookie, id, code } = await beginSubmission();
    await db.query("update email_verifications set expires_at=now()-interval '1 second' where id=$1", [id]);
    const expired = await verifyCode(request('/api/submissions/verify', { code }, cookie));
    expect(expired.status).toBe(400);
    expect((await expired.json()).error).toContain('expired');
    await db.exec("update rate_limits set window_started_at=now()-interval '61 seconds' where key like 'submission-code-cooldown:%'");
    expect((await resendCode(request('/api/submissions/resend', {}, cookie))).status).toBe(200);
    expect((await verifyCode(request('/api/submissions/verify', { code }, cookie))).status).toBe(400);
    const newestCode = [...delivered.values()].at(-1)!.text.match(/\b(\d{6})\b/)![1];
    expect((await verifyCode(request('/api/submissions/verify', { code: newestCode }, cookie))).status).toBe(200);
    expect([...delivered.values()].every(message => message.to === form.email)).toBe(true);
  });

  it('allows exactly five wrong attempts and refuses the correct code afterward', async () => {
    const { cookie, code } = await beginSubmission();
    for (let attempt = 0; attempt < 5; attempt++) {
      const response = await verifyCode(request('/api/submissions/verify', { code: '000000' }, cookie));
      expect(await response.json()).toEqual({ error: "That code didn't match. Try again." });
    }
    expect((await verifyCode(request('/api/submissions/verify', { code }, cookie))).status).toBe(429);
    expect((await db.query('select attempts from email_verifications')).rows[0]).toEqual({ attempts: 5 });
    expect((await db.query('select * from posts')).rows).toHaveLength(0);
  });

  it('creates one piece and one delivered confirmation when verification requests overlap', async () => {
    const { cookie, code } = await beginSubmission();
    const responses = await Promise.all([verifyCode(request('/api/submissions/verify', { code }, cookie)), verifyCode(request('/api/submissions/verify', { code }, cookie))]);
    for (const response of responses) expect(await response.json()).toEqual({ ok: true });
    expect((await db.query('select * from posts')).rows).toHaveLength(1);
    expect((await db.query('select original_body from submission_private')).rows[0]).toEqual({ original_body: body });
    expect([...delivered.keys()].filter(key => key.startsWith('submission-confirmation/'))).toHaveLength(1);
  });

  it('keeps saved success if confirmation delivery fails and repairs it on an idempotent retry', async () => {
    const { cookie, id, code } = await beginSubmission();
    mocks.sendEmail.mockResolvedValueOnce({ data: null, error: { message: 'private provider payload student@illinois.edu' } });
    const response = await verifyCode(request('/api/submissions/verify', { code }, cookie));
    expect(await response.json()).toEqual({ ok: true });
    expect((await db.query('select confirmation_sent_at from email_verifications where id=$1', [id])).rows[0]).toEqual({ confirmation_sent_at: null });
    expect((await verifyCode(request('/api/submissions/verify', { code }, cookie))).status).toBe(200);
    expect((await db.query('select confirmation_sent_at is not null as sent from email_verifications where id=$1', [id])).rows[0]).toEqual({ sent: true });
    const deliveredCount = delivered.size;
    await verifyCode(request('/api/submissions/verify', { code }, cookie));
    expect(delivered.size).toBe(deliveredCount);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(form.email);
  });

  it('hides provider failures and never exposes codes or private submission fields in errors', async () => {
    mocks.sendEmail.mockResolvedValueOnce({ data: null, error: { message: 'Private student@illinois.edu and credential' } });
    const response = await requestCode(request('/api/submissions', form));
    expect(response.status).toBe(503);
    const payload = await response.text();
    for (const secret of [form.email, body, 'credential', 'code_hash', '123456']) expect(payload).not.toContain(secret);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(form.email);
  });

  it('rejects missing or forged challenge cookies and does not accept client supplied resend recipients', async () => {
    expect((await verifyCode(request('/api/submissions/verify', { code: '123456' }))).status).toBe(400);
    expect((await verifyCode(request('/api/submissions/verify', { code: '123456' }, 'ia_submission=not-a-uuid'))).status).toBe(400);
    const { cookie } = await beginSubmission();
    expect((await resendCode(request('/api/submissions/resend', { email: 'victim@example.com' }, cookie))).status).toBe(400);
    expect(delivered.size).toBe(1);
  });

  it('uses the wordmark and unsubscribe headers in the shared email helper', async () => {
    const unsubscribeUrl = new URL('/unsubscribe?token=test-token', site.url).href;
    await sendMail({ to: 'digest@example.test', subject: 'This week', html: '<p>New writing.</p>', text: 'New writing.', idempotencyKey: 'digest/test', unsubscribeUrl });
    const message = delivered.get('digest/test')!;
    expect(message.html).toContain('/brand/logo-wordmark-horizontal.png');
    expect(message.html).not.toContain('logo-source.png');
    expect(message.headers).toEqual({ 'List-Unsubscribe': `<${unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' });
  });
});
