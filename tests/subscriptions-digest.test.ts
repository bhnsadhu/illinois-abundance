import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { NextRequest } from 'next/server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as subscribe } from '@/app/api/subscribe/route';
import { POST as unsubscribe } from '@/app/api/unsubscribe/route';
import { POST as digest } from '@/app/api/admin/digest/route';
import { getSubscriptionResult } from '@/lib/subscriptions';
import { getDigestPreview, type DigestProgress } from '@/lib/digest';
import { proxy } from '@/proxy';
import { site } from '@/lib/config';

const mocks = vi.hoisted(() => ({ reviewer: vi.fn(), send: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getReviewer: mocks.reviewer, requireAdmin: async () => {
  const reviewer = await mocks.reviewer(); if (!reviewer?.isAdmin) throw new Error('Admin required'); return reviewer;
} }));
vi.mock('resend', () => ({ Resend: class { emails = { send: mocks.send }; } }));
vi.mock('node:timers/promises', () => ({ setTimeout: async () => undefined }));

let db: PGlite;
let queue: Promise<unknown> = Promise.resolve();
let failSentMarker = false;
let unavailable = false;
let sqlCalls: string[] = [];
const delivered = new Map<string, { id: string; to: string; html: string; text: string; headers: Record<string, string> }>();
vi.mock('@neondatabase/serverless', () => ({ neon: () => ({
  query(text: string, values: unknown[] = []) {
    const result = queue.then(async () => {
      sqlCalls.push(text);
      if (unavailable) throw new Error('Private database details');
      if (failSentMarker && text.includes('finish_digest_delivery') && values.includes('sent')) {
        failSentMarker = false;
        throw new Error('Simulated marker outage after provider accepted mail');
      }
      await db.exec('savepoint http_query');
      try {
        const result = await db.query(text, values);
        await db.exec('release savepoint http_query');
        return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length };
      } catch (error) {
        await db.exec('rollback to savepoint http_query; release savepoint http_query');
        throw error;
      }
    });
    queue = result.catch(() => undefined);
    return result;
  },
}) }));

const admin = { id: '70000000-0000-4000-8000-000000000001', email: 'owner@example.test', name: 'Owner', isAdmin: true };
const postId = '30000000-0000-4000-8000-000000000001';
const writerId = '20000000-0000-4000-8000-000000000001';
const eventId = '40000000-0000-4000-8000-000000000001';
const token = 'a'.repeat(64);
const reader = 'private-reader@example.test';
function request(path: string, body: unknown, origin = new URL(site.url).origin) {
  return new Request(new URL(path, site.url), { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) });
}
function send(body: unknown) { return digest(request('/api/admin/digest', body)); }
async function subscriber(email = reader, confirmed = true, value = token) {
  await db.query('insert into subscribers(email,confirmed_at,token) values($1,$2,$3)', [email, confirmed ? new Date().toISOString() : null, value]);
}
async function published() {
  await db.query('insert into writers(id,slug,name) values($1,$2,$3)', [writerId, 'student-writer', 'Student Writer']);
  await db.query(`insert into posts(id,status,slug,author_name,final_body,headline,short_version,topic_id,byline,writer_id,published_at)
    values($1,'published','more-homes','Student Writer','The approved published body.','More homes <script>bad()</script>','A practical student proposal.',$2,'Student Writer',$3,now()-interval '1 day')`, [postId, '10000000-0000-4000-8000-000000000001', writerId]);
  await db.query('insert into submission_private(post_id,author_email,original_body) values($1,$2,$3)', [postId, 'private-author@illinois.edu', 'PRIVATE ORIGINAL ARCHIVE']);
}
async function event() {
  await db.query("insert into events(id,slug,title,starts_at,location) values($1,'next-teach-in','Next teach in',now()+interval '2 days','Campus library')", [eventId]);
}
async function start() {
  const preview = await getDigestPreview();
  const response = await send({ action: 'start', preview_token: preview.preview_token });
  expect(response.status, await response.clone().text()).toBe(200);
  return (await response.json()).digest as DigestProgress;
}

beforeAll(async () => {
  db = new PGlite();
  const directory = new URL('../db/migrations/', import.meta.url);
  for (const file of (await readdir(directory)).filter(file => file.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file, directory), 'utf8'));
  await db.exec(await readFile(new URL('../db/seed.sql', import.meta.url), 'utf8'));
}, 30000);
beforeEach(async () => {
  await db.exec('begin');
  vi.stubEnv('DATABASE_URL', 'postgresql://digest-test.invalid/no-network');
  vi.stubEnv('ADMIN_EMAIL', admin.email);
  vi.stubEnv('CODE_PEPPER', 'digest-test-pepper-longer-than-thirty-two-characters');
  vi.stubEnv('RESEND_API_KEY', 'mock-mail-only');
  vi.stubEnv('MAIL_FROM', 'Illinois Abundance <test@example.test>');
  mocks.reviewer.mockReset().mockResolvedValue(admin);
  delivered.clear(); failSentMarker = false; unavailable = false; sqlCalls = [];
  mocks.send.mockReset().mockImplementation(async (mail, options) => {
    let value = delivered.get(options.idempotencyKey);
    if (!value) { value = { id: `mail-${delivered.size + 1}`, ...mail }; delivered.set(options.idempotencyKey, value!); }
    return { data: { id: value!.id }, error: null };
  });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(async () => { await queue; await db.exec('rollback; reset role'); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
afterAll(async () => { await db.close(); });

describe('double opt-in subscriptions', () => {
  it('accepts any email, stores only the three allowed fields, and confirms by an opaque link', async () => {
    const response = await subscribe(request('/api/subscribe', { email: ' READER@EXAMPLE.TEST ' }));
    expect(await response.json()).toEqual({ ok: true });
    const rows = (await db.query<{ email: string; confirmed_at: string | null; token: string }>('select * from subscribers')).rows;
    expect(Object.keys(rows[0]).sort()).toEqual(['confirmed_at', 'email', 'token']);
    expect(rows[0]).toMatchObject({ email: 'reader@example.test', confirmed_at: null, token: expect.stringMatching(/^[a-f0-9]{64}$/) });
    const mail = [...delivered.values()][0];
    expect(mail.text).toContain(`/subscribe/confirm?token=${rows[0].token}`);
    expect(mail.html).toContain(`/unsubscribe?token=${rows[0].token}`);
    expect(mail.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    expect(await getSubscriptionResult(rows[0].token, 'confirm')).toBe('confirmed');
    const first = (await db.query('select confirmed_at from subscribers')).rows[0];
    expect(await getSubscriptionResult(rows[0].token, 'confirm')).toBe('confirmed');
    expect((await db.query('select confirmed_at from subscribers')).rows[0]).toEqual(first);
  });

  it('reuses pending tokens and leaves confirmed subscriptions and earlier unsubscribe links intact', async () => {
    await subscriber(reader, false);
    expect((await subscribe(request('/api/subscribe', { email: reader }))).status).toBe(200);
    await db.exec('delete from rate_limits');
    expect((await subscribe(request('/api/subscribe', { email: reader }))).status).toBe(200);
    expect(delivered.size).toBe(1);
    expect((await db.query('select token from subscribers')).rows[0]).toEqual({ token });
    await getSubscriptionResult(token, 'confirm'); await db.exec('delete from rate_limits');
    expect(await (await subscribe(request('/api/subscribe', { email: reader }))).json()).toEqual({ ok: true });
    expect(mocks.send).toHaveBeenCalledTimes(2);
    expect(await getSubscriptionResult(token, 'unsubscribe')).toBe('unsubscribed');
  });

  it('protects email delivery with origin, honeypot, body limits, and distributed throttles', async () => {
    expect((await subscribe(request('/api/subscribe', { email: reader }, 'https://evil.example'))).status).toBe(403);
    expect((await subscribe(request('/api/subscribe', { email: reader, website: 'spam' }))).status).toBe(400);
    expect((await subscribe(request('/api/subscribe', { email: reader, extra: 'x'.repeat(5000) }))).status).toBe(413);
    expect(sqlCalls).toHaveLength(0);
    expect((await subscribe(request('/api/subscribe', { email: reader }))).status).toBe(200);
    expect((await subscribe(request('/api/subscribe', { email: reader }))).status).toBe(429);
    expect((await db.query('select count(*)::integer as total from rate_limits')).rows[0]).toEqual({ total: 3 });
  });

  it('unsubscribes idempotently by GET helper or RFC8058 POST without requiring a browser origin', async () => {
    await subscriber();
    const request = new NextRequest(new URL(`/unsubscribe?token=${token}`, site.url), { method: 'POST', body: 'List-Unsubscribe=One-Click' });
    expect(proxy(request).headers.get('x-middleware-rewrite')).toContain(`/api/unsubscribe?token=${token}`);
    expect(await (await unsubscribe(request)).json()).toEqual({ ok: true });
    expect(await getSubscriptionResult(token, 'unsubscribe')).toBe('unsubscribed');
    expect((await db.query('select * from subscribers')).rows).toHaveLength(0);
    expect(await getSubscriptionResult('bad', 'confirm')).toBe('invalid');
    expect(await getSubscriptionResult('b'.repeat(64), 'confirm')).toBe('invalid');
    expect((await unsubscribe(new Request(`${site.url}/unsubscribe?token=bad`, { method: 'POST' }))).status).toBe(400);
  });

  it('reports configuration and provider errors without revealing recipient details', async () => {
    mocks.send.mockResolvedValue({ data: null, error: { message: `Private ${reader}` } });
    const response = await subscribe(request('/api/subscribe', { email: reader }));
    expect(response.status).toBe(503); expect(await response.text()).not.toContain(reader);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(reader);
    unavailable = true; expect(await getSubscriptionResult(token, 'confirm')).toBe('unavailable');
    vi.stubEnv('RESEND_API_KEY', '');
    expect((await subscribe(request('/api/subscribe', { email: reader }))).status).toBe(503);
  });
});

describe('manual digest snapshots and durable delivery', () => {
  it('previews only the last seven days, the next event and aggregate subscriber counts', async () => {
    await published(); await event(); await subscriber(); await subscriber('pending@example.test', false, 'b'.repeat(64));
    await db.query("insert into posts(author_name,headline) values('Private Draft','DO NOT INCLUDE')");
    const preview = await getDigestPreview();
    expect(preview.posts).toHaveLength(1); expect(preview.event?.id).toBe(eventId);
    expect(preview.subscriber_count).toBe(1); expect(preview.can_send).toBe(true);
    for (const privateValue of [reader, 'private-author', 'PRIVATE ORIGINAL', 'DO NOT INCLUDE', token]) expect(JSON.stringify(preview)).not.toContain(privateValue);
    await db.query("update posts set published_at=now()-interval '8 days' where id=$1", [postId]);
    expect((await getDigestPreview()).posts).toHaveLength(0);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('requires the exact admin, same origin, and an unchanged signed preview before sending', async () => {
    await published(); await subscriber();
    const preview = await getDigestPreview();
    mocks.reviewer.mockResolvedValue(null);
    expect((await send({ action: 'start', preview_token: preview.preview_token })).status).toBe(401);
    mocks.reviewer.mockResolvedValue({ ...admin, isAdmin: false });
    expect((await send({ action: 'start', preview_token: preview.preview_token })).status).toBe(403);
    mocks.reviewer.mockResolvedValue(admin);
    expect((await digest(request('/api/admin/digest', { action: 'start', preview_token: preview.preview_token }, 'https://evil.example'))).status).toBe(403);
    expect((await send({ action: 'start', preview_token: `${preview.preview_token}bad` })).status).toBe(409);
    await db.query("update posts set headline='Changed after preview' where id=$1", [postId]);
    expect((await send({ action: 'start', preview_token: preview.preview_token })).status).toBe(409);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('sends the approved snapshot once, escapes text, and logs per-recipient success without exposing identities', async () => {
    await published(); await event(); await subscriber();
    const preview = await getDigestPreview();
    const first = await send({ action: 'start', preview_token: preview.preview_token });
    expect(first.status, await first.clone().text()).toBe(200);
    const result = await first.json();
    expect(result.digest).toMatchObject({ status: 'sent', recipient_count: 1, sent_count: 1, pending_count: 0, failed_count: 0 });
    expect(JSON.stringify(result)).not.toContain(reader);
    const mail = [...delivered.values()][0];
    expect(mail.html).toContain('&lt;script&gt;bad()&lt;/script&gt;'); expect(mail.html).not.toContain('<script>bad()');
    expect(mail.text).toContain('/post/more-homes'); expect(mail.text).toContain('Next teach in'); expect(mail.text).toContain(`/unsubscribe?token=${token}`);
    expect(mail.html).not.toContain('PRIVATE ORIGINAL');
    const second = await send({ action: 'start', preview_token: preview.preview_token });
    expect((await second.json()).digest.id).toBe(result.digest.id);
    expect(mocks.send).toHaveBeenCalledTimes(1); expect(delivered.size).toBe(1);
    expect((await db.query('select status,provider_id from digest_deliveries')).rows).toEqual([{ status: 'sent', provider_id: 'mail-1' }]);
  });

  it('caps batches at eight and excludes unconfirmed or newly unsubscribed recipients when continuing', async () => {
    await published();
    for (let i = 0; i < 10; i++) await subscriber(`reader${i}@example.test`, true, i.toString().padStart(64, '0'));
    await subscriber('unconfirmed@example.test', false, 'f'.repeat(64));
    const first = await start();
    expect(first).toMatchObject({ sent_count: 8, pending_count: 2, recipient_count: 10, status: 'sending' });
    await db.query("delete from subscribers where email='reader8@example.test'");
    const response = await send({ action: 'continue', digest_id: first.id });
    expect((await response.json()).digest).toMatchObject({ status: 'sent', sent_count: 9, skipped_count: 1, pending_count: 0 });
    expect(delivered.size).toBe(9);
  });

  it('retries a crash after provider success with the same idempotency key and never resends completed recipients', async () => {
    await published(); await subscriber();
    failSentMarker = true;
    const preview = await getDigestPreview();
    expect((await send({ action: 'start', preview_token: preview.preview_token })).status).toBe(503);
    expect(delivered.size).toBe(1);
    const log = (await db.query<{ id: string; failed_count: number }>('select id,failed_count from digest_log')).rows[0];
    expect(log.failed_count).toBe(1);
    const retry = await send({ action: 'continue', digest_id: log.id });
    expect((await retry.json()).digest).toMatchObject({ status: 'sent', sent_count: 1 });
    expect(mocks.send).toHaveBeenCalledTimes(2); expect(delivered.size).toBe(1);
    expect(mocks.send.mock.calls[0][1]).toEqual(mocks.send.mock.calls[1][1]);
    expect(mocks.send.mock.calls[0][0]).toEqual(mocks.send.mock.calls[1][0]);
    await send({ action: 'continue', digest_id: log.id }); expect(mocks.send).toHaveBeenCalledTimes(2);
  });

  it('pauses on provider failures and holds ambiguous retries beyond the provider idempotency window', async () => {
    await published(); await subscriber();
    mocks.send.mockResolvedValueOnce({ data: null, error: { message: 'Provider unavailable' } });
    const first = await start();
    expect(first).toMatchObject({ status: 'failed', failed_count: 1, sent_count: 0 });
    await db.exec("update digest_deliveries set first_attempt_at=now()-interval '25 hours'");
    const response = await send({ action: 'continue', digest_id: first.id });
    expect((await response.json()).digest).toMatchObject({ status: 'failed', failed_count: 0, uncertain_count: 1 });
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });

  it('refuses overlapping leases and content removed from publication during a paused send', async () => {
    await published(); await subscriber();
    mocks.send.mockResolvedValueOnce({ data: null, error: { message: 'Provider unavailable' } });
    const first = await start();
    await db.exec("update digest_log set lease_until=now()+interval '2 minutes'");
    expect((await send({ action: 'continue', digest_id: first.id })).status).toBe(409);
    await db.exec('update digest_log set lease_until=null');
    await db.query("update posts set status='unpublished' where id=$1", [postId]);
    expect((await send({ action: 'continue', digest_id: first.id })).status).toBe(409);
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });

  it('has a clear empty state, permits an event-only digest, and cannot be started by a public request', async () => {
    await subscriber();
    const empty = await getDigestPreview(); expect(empty.can_send).toBe(false);
    expect((await send({ action: 'start', preview_token: empty.preview_token })).status).toBe(400);
    await event(); expect((await getDigestPreview()).can_send).toBe(true);
    expect(await start()).toMatchObject({ status: 'sent', sent_count: 1 });
  });

  it('keeps subscriber rows, delivery logs and privileged SQL functions inaccessible to anonymous readers', async () => {
    await subscriber();
    await db.exec('set role anon');
    for (const sql of ['select * from subscribers', 'select * from digest_deliveries', 'select * from digest_log', `select prepare_subscription('x@example.test',repeat('a',64))`, `select confirm_subscription(repeat('a',64))`, "select claim_digest_batch(gen_random_uuid(),gen_random_uuid(),8)"]) {
      await db.exec('savepoint denied'); await expect(db.query(sql)).rejects.toThrow(/permission denied/); await db.exec('rollback to savepoint denied');
    }
  });
});
