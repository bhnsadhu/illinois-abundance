import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { NextRequest } from 'next/server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getReviewer, hashLoginToken, hashSessionToken, requireAdmin, requireReviewer, REVIEWER_COOKIE } from '@/lib/auth';
import { POST as login } from '@/app/api/login/route';
import { GET as callback } from '@/app/auth/callback/route';
import { POST as logout } from '@/app/api/logout/route';
import { proxy } from '@/proxy';
import { site } from '@/lib/config';

const mocks = vi.hoisted(() => ({ sendEmail: vi.fn(), cookieGet: vi.fn(), cookieSet: vi.fn() }));
vi.mock('resend', () => ({ Resend: class { emails = { send: mocks.sendEmail }; } }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: mocks.cookieGet, set: mocks.cookieSet }) }));
vi.mock('@/lib/database/service', () => ({ serviceDatabase: () => databaseAdapter() }));

let db: PGlite;
let databaseCalls = 0;
let unavailable = false;
const reviewerEmail = 'reviewer@illinois.edu';
const adminEmail = 'owner@example.test';
const reviewerId = '70000000-0000-4000-8000-000000000001';
const sessionToken = 'a'.repeat(64);

type Result = { data: unknown; error: { code: string } | null };
function databaseAdapter() {
  return {
    async rpc(name: string, args: Record<string, unknown>): Promise<Result> {
      databaseCalls++;
      if (unavailable) return { data: null, error: { code: 'UNAVAILABLE' } };
      const pairs = Object.entries(args);
      const result = await db.query<{ result: unknown }>(`select public.${name}(${pairs.map(([key], index) => `${key} => $${index + 1}`).join(',')}) as result`, pairs.map(([, value]) => value));
      return { data: result.rows[0].result, error: null };
    },
    from(table: string) {
      if (!['reviewers', 'login_tokens', 'reviewer_sessions'].includes(table)) throw new Error('Unexpected auth table');
      let operation = 'select';
      let values: Record<string, unknown> = {};
      let columns = '*';
      const filters: { name: string; operator: string; value: unknown }[] = [];
      const execute = async (single = false): Promise<Result> => {
        databaseCalls++;
        if (unavailable) return { data: null, error: { code: 'UNAVAILABLE' } };
        const params: unknown[] = [];
        const where = filters.length ? ` where ${filters.map(filter => { params.push(filter.value); return `${filter.name} ${filter.operator} $${params.length}`; }).join(' and ')}` : '';
        let sql: string;
        if (operation === 'select') sql = `select ${columns} from public.${table}${where}`;
        else if (operation === 'delete') sql = `delete from public.${table}${where} returning *`;
        else {
          const keys = Object.keys(values);
          params.push(...Object.values(values));
          sql = `insert into public.${table}(${keys.join(',')}) values(${params.map((_, i) => `$${i + 1}`).join(',')})`;
          if (operation === 'upsert') sql += ' on conflict(email) do update set name=excluded.name,is_active=excluded.is_active';
          sql += ` returning ${columns}`;
        }
        const result = await db.query(sql, params);
        return { data: single ? result.rows[0] ?? null : result.rows, error: null };
      };
      const query = {
        select: (selected: string) => { columns = selected; return query; },
        eq: (name: string, value: unknown) => { filters.push({ name, operator: '=', value }); return query; },
        gt: (name: string, value: unknown) => { filters.push({ name, operator: '>', value }); return query; },
        insert: (input: Record<string, unknown>) => { operation = 'insert'; values = input; return query; },
        upsert: (input: Record<string, unknown>) => { operation = 'upsert'; values = input; return query; },
        delete: () => { operation = 'delete'; return query; },
        maybeSingle: () => execute(true), single: () => execute(true),
        then: (resolve: (result: Result) => unknown, reject?: (error: unknown) => unknown) => execute().then(resolve, reject),
      };
      return query;
    },
  };
}

function post(path: string, input: unknown = {}, headers: Record<string, string> = {}) {
  return new NextRequest(new URL(path, site.url), { method: 'POST', headers: { origin: new URL(site.url).origin, 'content-type': 'application/json', ...headers }, body: JSON.stringify(input) });
}
async function createSession(email = reviewerEmail, expires = new Date(Date.now() + 3600000).toISOString()) {
  await db.query('insert into reviewer_sessions(token_hash,email,expires_at) values($1,$2,$3)', [hashSessionToken(sessionToken), email, expires]);
  mocks.cookieGet.mockReturnValue({ name: REVIEWER_COOKIE, value: sessionToken });
}
async function requestLink(email = reviewerEmail) {
  const response = await login(post('/api/login', { email }));
  expect(response.status).toBe(200);
  const message = mocks.sendEmail.mock.calls.at(-1)![0] as { text: string; html: string };
  const url = message.text.match(/https?:\/\/\S+\/auth\/callback\?token=[a-f0-9]+/)![0];
  return { response, url, token: new URL(url).searchParams.get('token')! };
}

beforeAll(async () => {
  db = new PGlite();
  const directory = new URL('../db/migrations/', import.meta.url);
  for (const file of (await readdir(directory)).filter(file => file.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file, directory), 'utf8'));
}, 30000);
beforeEach(async () => {
  await db.exec('begin');
  await db.query('insert into reviewers(id,email,name) values($1,$2,$3)', [reviewerId, reviewerEmail, 'Approved Reviewer']);
  databaseCalls = 0; unavailable = false;
  vi.stubEnv('DATABASE_URL', 'postgresql://test-only.invalid/never-connect');
  vi.stubEnv('ADMIN_EMAIL', adminEmail); vi.stubEnv('RESEND_API_KEY', 'test-only-mail-key');
  vi.stubEnv('MAIL_FROM', 'Illinois Abundance <test@example.test>'); vi.stubEnv('CODE_PEPPER', 'test-pepper-longer-than-thirty-two-characters');
  mocks.cookieGet.mockReset().mockReturnValue(undefined); mocks.cookieSet.mockReset();
  mocks.sendEmail.mockReset().mockResolvedValue({ data: { id: 'mail-test-id' }, error: null });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(async () => { await db.exec('rollback; reset role'); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
afterAll(async () => { await db.close(); });

describe('Neon passwordless reviewer authentication', () => {
  it('gives unknown and revoked addresses generic success without issuing a token or email', async () => {
    expect(await (await login(post('/api/login', { email: 'unknown@example.test' }))).json()).toEqual({ ok: true });
    await db.query('update reviewers set is_active=false where id=$1', [reviewerId]);
    expect(await (await login(post('/api/login', { email: reviewerEmail }))).json()).toEqual({ ok: true });
    expect((await db.query('select * from login_tokens')).rows).toHaveLength(0);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it('stores only a purpose-separated hash, sends a branded fixed callback, and expires links in 15 minutes', async () => {
    const { response, url, token } = await requestLink();
    expect(await response.json()).toEqual({ ok: true });
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    const record = (await db.query<{ token_hash: string; ttl: number }>('select token_hash,extract(epoch from expires_at-created_at)::integer as ttl from login_tokens')).rows[0];
    expect(record.token_hash).toBe(hashLoginToken(token)); expect(record.token_hash).not.toBe(token);
    expect(record.token_hash).not.toBe(hashSessionToken(token)); expect(record.ttl).toBeGreaterThanOrEqual(899); expect(record.ttl).toBeLessThanOrEqual(901);
    expect(new URL(url).origin).toBe(new URL(site.url).origin);
    expect(mocks.sendEmail.mock.calls[0][0].html).toContain('/brand/logo-wordmark-horizontal.png');
  });

  it('consumes a link only once and creates exactly one seven-day session when callbacks overlap', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { url } = await requestLink();
    const responses = await Promise.all([callback(new NextRequest(url)), callback(new NextRequest(url))]);
    expect(responses.filter(value => new URL(value.headers.get('location')!).pathname === '/review')).toHaveLength(1);
    expect(responses.filter(value => value.headers.get('set-cookie'))).toHaveLength(1);
    const successful = responses.find(value => value.headers.get('set-cookie'))!;
    expect(successful.headers.get('set-cookie')).toContain('HttpOnly'); expect(successful.headers.get('set-cookie')).toContain('Secure'); expect(successful.headers.get('set-cookie')).toMatch(/SameSite=lax/i);
    expect(successful.headers.get('set-cookie')).toContain('Max-Age=604800');
    const rawSession = successful.cookies.get(REVIEWER_COOKIE)!.value;
    const sessions = (await db.query<{ token_hash: string; ttl: number }>('select token_hash,extract(epoch from expires_at-created_at)::integer as ttl from reviewer_sessions')).rows;
    expect(sessions).toEqual([{ token_hash: hashSessionToken(rawSession), ttl: 604800 }]);
    expect(successful.headers.get('referrer-policy')).toBe('no-referrer');
  });

  it('rejects expired and revoked links and ignores open-redirect parameters', async () => {
    const first = await requestLink();
    await db.exec("update login_tokens set expires_at=now()-interval '1 second'");
    expect((await callback(new NextRequest(first.url))).headers.get('location')).toBe(new URL('/login?error=expired', site.url).href);
    await db.exec('delete from rate_limits');
    const second = await requestLink();
    await db.query('update reviewers set is_active=false where id=$1', [reviewerId]);
    expect((await callback(new NextRequest(second.url))).headers.get('location')).toBe(new URL('/login?error=expired', site.url).href);
    expect((await db.query('select * from reviewer_sessions')).rows).toHaveLength(0);
    await db.query('update reviewers set is_active=true where id=$1', [reviewerId]);
    await db.exec('delete from rate_limits');
    const third = await requestLink();
    expect((await callback(new NextRequest(`${third.url}&next=https://evil.example`))).headers.get('location')).toBe(new URL('/review', site.url).href);
  });

  it('reads hashed server sessions and current membership, never identity supplied in a cookie', async () => {
    mocks.cookieGet.mockReturnValue({ name: REVIEWER_COOKIE, value: JSON.stringify({ email: adminEmail }) });
    expect(await getReviewer()).toBeNull(); expect(databaseCalls).toBe(0);
    await createSession();
    expect(await getReviewer()).toEqual({ id: reviewerId, email: reviewerEmail, name: 'Approved Reviewer', isAdmin: false });
    await db.query('update reviewers set is_active=false where id=$1', [reviewerId]);
    expect(await getReviewer()).toBeNull();
  });

  it('rejects expired sessions and database failures', async () => {
    await createSession(reviewerEmail, new Date(Date.now() - 1000).toISOString());
    expect(await getReviewer()).toBeNull();
    await db.exec("update reviewer_sessions set expires_at=now()+interval '1 day'");
    unavailable = true; expect(await getReviewer()).toBeNull();
  });

  it('recognizes only the exact environment admin and bootstraps its reviewer row', async () => {
    const { url } = await requestLink(adminEmail);
    const response = await callback(new NextRequest(url));
    expect(new URL(response.headers.get('location')!).pathname).toBe('/review');
    const raw = response.cookies.get(REVIEWER_COOKIE)!.value;
    mocks.cookieGet.mockReturnValue({ name: REVIEWER_COOKIE, value: raw });
    expect(await getReviewer()).toMatchObject({ email: adminEmail, isAdmin: true });
    expect((await db.query('select is_active from reviewers where email=$1', [adminEmail])).rows).toEqual([{ is_active: true }]);
    expect(await requireAdmin()).toMatchObject({ isAdmin: true });
    vi.stubEnv('ADMIN_EMAIL', `not-${adminEmail}`);
    expect(await getReviewer()).toMatchObject({ isAdmin: false });
  });

  it('redirects missing sessions to login and keeps reviewers out of admin pages', async () => {
    await expect(requireReviewer()).rejects.toThrow('NEXT_REDIRECT');
    await createSession();
    await expect(requireAdmin()).rejects.toThrow('NEXT_REDIRECT');
  });

  it('enforces origin, honeypot, body caps, and shared email/IP/cooldown limits before delivery', async () => {
    expect((await login(post('/api/login', { email: reviewerEmail }, { origin: 'https://evil.example' }))).status).toBe(403);
    expect((await login(post('/api/login', { email: reviewerEmail, website: 'spam' }))).status).toBe(400);
    expect((await login(post('/api/login', { email: reviewerEmail, extra: 'x'.repeat(5000) }))).status).toBe(413);
    expect(databaseCalls).toBe(0);
    await requestLink();
    expect((await login(post('/api/login', { email: reviewerEmail }))).status).toBe(429);
    expect((await db.query('select count(*)::integer as total from rate_limits')).rows[0]).toEqual({ total: 3 });
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
  });

  it('keeps login/session rows and token-consumption RPC private to the backend', async () => {
    await requestLink();
    await createSession();
    await db.exec('set role anon');
    for (const sql of ['select * from login_tokens', 'select * from reviewer_sessions', "select consume_login(repeat('a',64),repeat('b',64),null)"]) {
      await db.exec('savepoint denied'); await expect(db.query(sql)).rejects.toThrow(/permission denied/); await db.exec('rollback to savepoint denied');
    }
  });

  it('deletes the server session on logout and clears the protected cookie', async () => {
    await createSession();
    expect((await logout(post('/api/logout', {}, { origin: 'https://evil.example' }))).status).toBe(403);
    expect((await db.query('select * from reviewer_sessions')).rows).toHaveLength(1);
    expect(await (await logout(post('/api/logout'))).json()).toEqual({ ok: true });
    expect((await db.query('select * from reviewer_sessions')).rows).toHaveLength(0);
    expect(mocks.cookieSet).toHaveBeenCalledWith(REVIEWER_COOKIE, '', expect.objectContaining({ httpOnly: true, maxAge: 0 }));
  });

  it('does not return or log private provider details and reports unconfigured login honestly', async () => {
    mocks.sendEmail.mockResolvedValueOnce({ data: null, error: { message: `Private ${reviewerEmail} token secret` } });
    const failed = await login(post('/api/login', { email: reviewerEmail }));
    expect(failed.status).toBe(503); expect(await failed.text()).not.toContain(reviewerEmail);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(reviewerEmail);
    vi.stubEnv('DATABASE_URL', '');
    expect((await login(post('/api/login', { email: reviewerEmail }))).status).toBe(503);
  });

  it('lets a failed logout retry server invalidation before clearing its cookie', async () => {
    await createSession();
    unavailable = true;
    expect((await logout(post('/api/logout'))).status).toBe(503);
    expect(mocks.cookieSet).not.toHaveBeenCalled();
    expect((await db.query('select * from reviewer_sessions')).rows).toHaveLength(1);
    unavailable = false;
    expect((await logout(post('/api/logout'))).status).toBe(200);
    expect((await db.query('select * from reviewer_sessions')).rows).toHaveLength(0);
  });

  it('marks private routes no-store without injecting sessions into public content', () => {
    const response = proxy(new NextRequest(new URL('/review', site.url)));
    expect(response.headers.get('cache-control')).toBe('private, no-store'); expect(response.headers.get('pragma')).toBe('no-cache');
    expect(response.headers.get('set-cookie')).toBeNull();
  });
});
