import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { NextRequest } from 'next/server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getReviewer, hashSessionToken, requireAdmin, requireReviewer, REVIEWER_COOKIE } from '@/lib/auth';
import { hashPassword, verifyPassword } from '@/lib/passwords';
import { POST as login } from '@/app/api/login/route';
import { POST as changePassword } from '@/app/api/account/password/route';
import { POST as adminMutation } from '@/app/api/admin/[resource]/route';
import { POST as reviewMutation } from '@/app/api/review/[id]/route';
import { GET as callback } from '@/app/auth/callback/route';
import { POST as logout } from '@/app/api/logout/route';
import { proxy } from '@/proxy';
import { site } from '@/lib/config';

const mocks = vi.hoisted(() => ({ cookieGet: vi.fn(), cookieSet: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: mocks.cookieGet, set: mocks.cookieSet }) }));
vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
let db: PGlite;
let unavailable = false;
let databaseCalls = 0;
// Use the real SQL adapter against an isolated Postgres engine.
vi.mock('@neondatabase/serverless', () => ({ neon: () => ({
  async query(text: string, values: unknown[] = []) {
    databaseCalls++;
    if (unavailable) throw new Error('Private connection details');
    await db.exec('savepoint http_query');
    try {
      const result = await db.query(text, values);
      await db.exec('release savepoint http_query');
      return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length };
    } catch (error) {
      await db.exec('rollback to savepoint http_query; release savepoint http_query');
      throw error;
    }
  },
}) }));
const reviewerEmail = 'reviewer@illinois.edu';
const adminEmail = 'owner@example.test';
const reviewerId = '70000000-0000-4000-8000-000000000001';
const adminId = '70000000-0000-4000-8000-000000000002';
const password = 'Initial password 2026';
const replacement = 'My new password 2026';
const sessionToken = 'a'.repeat(64);
let initialHash: string;
function post(path: string, input: unknown = {}, headers: Record<string, string> = {}) {
  return new NextRequest(new URL(path, site.url), { method: 'POST', headers: { origin: new URL(site.url).origin, 'content-type': 'application/json', ...headers }, body: JSON.stringify(input) });
}
function signIn(email = reviewerEmail, secret = password, role = 'reviewer') {
  return login(post('/api/login', { email, password: secret, role }));
}
async function createSession(email = reviewerEmail, expires = new Date(Date.now() + 3600000).toISOString()) {
  await db.query('insert into reviewer_sessions(token_hash,email,expires_at) values($1,$2,$3)', [hashSessionToken(sessionToken), email, expires]);
  mocks.cookieGet.mockReturnValue({ name: REVIEWER_COOKIE, value: sessionToken });
}
function change(currentPassword = password, newPassword = replacement, confirmPassword = newPassword) {
  return changePassword(post('/api/account/password', { currentPassword, newPassword, confirmPassword }));
}
async function resetByAdmin(values: Record<string, unknown>, id?: string) {
  return adminMutation(post('/api/admin/reviewers', { action: 'save', id, values }), { params: Promise.resolve({ resource: 'reviewers' }) });
}
beforeAll(async () => {
  initialHash = await hashPassword(password);
  db = new PGlite();
  const directory = new URL('../db/migrations/', import.meta.url);
  for (const file of (await readdir(directory)).filter(file => file.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file, directory), 'utf8'));
}, 30000);
beforeEach(async () => {
  await db.exec('begin');
  await db.query('insert into reviewers(id,email,name,password_hash) values($1,$2,$3,$4),($5,$6,$7,$4)', [reviewerId, reviewerEmail, 'Approved Reviewer', initialHash, adminId, adminEmail, 'Site admin']);
  databaseCalls = 0; unavailable = false;
  vi.stubEnv('DATABASE_URL', 'postgresql://test-only.invalid/never-connect');
  vi.stubEnv('ADMIN_EMAIL', adminEmail);
  vi.stubEnv('SECOND_ADMIN_EMAIL', '');
  vi.stubEnv('RESEND_API_KEY', '');
  vi.stubEnv('CODE_PEPPER', 'test-pepper-longer-than-thirty-two-characters');
  mocks.cookieGet.mockReset().mockReturnValue(undefined); mocks.cookieSet.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(async () => { await db.exec('rollback; reset role'); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
afterAll(async () => { await db.close(); });

describe('password authentication and account lifecycle', () => {
  it('uses unique salted hashes, preserves spaces, and rejects missing or malformed hashes', async () => {
    const spaced = ` ${password} `;
    const first = await hashPassword(spaced);
    const second = await hashPassword(spaced);
    expect(first).not.toBe(second); expect(first).not.toContain(password);
    expect(await verifyPassword(spaced, first)).toBe(true);
    for (const [input, hash] of [[password, first], [spaced, null], [spaced, 'corrupt']]) expect(await verifyPassword(input!, hash)).toBe(false);
  });
  it('signs in with a normalized email without email delivery and stores only a seven-day session hash', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const response = await signIn('REVIEWER@illinois.edu');
    expect(await response.json()).toEqual({ ok: true, redirect: '/review' });
    const cookie = response.headers.get('set-cookie')!;
    expect(cookie).toContain('HttpOnly'); expect(cookie).toContain('Secure'); expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).toContain('Max-Age=604800');
    const raw = response.cookies.get(REVIEWER_COOKIE)!.value;
    const sessions = (await db.query('select token_hash,extract(epoch from expires_at-created_at)::integer as ttl from reviewer_sessions')).rows;
    expect(sessions).toEqual([{ token_hash: hashSessionToken(raw), ttl: 604800 }]);
    mocks.cookieGet.mockReturnValue({ value: raw });
    expect(await getReviewer()).toEqual({ id: reviewerId, email: reviewerEmail, name: 'Approved Reviewer', isAdmin: false });
  });
  it('gives the same failure for wrong passwords, unknown emails, revoked accounts, and wrong admin role', async () => {
    const responses = [await signIn(reviewerEmail, 'wrong'), await signIn('unknown@example.test'), await signIn(reviewerEmail, password, 'admin')];
    await db.query('update reviewers set is_active=false where id=$1', [reviewerId]);
    responses.push(await signIn());
    for (const response of responses) {
      expect(response.status).toBe(401); expect(response.headers.get('set-cookie')).toBeNull();
      expect(await response.json()).toEqual({ error: 'Email or password is incorrect for this sign in.' });
    }
    expect((await db.query('select * from reviewer_sessions')).rows).toHaveLength(0);
  });
  it('grants admin permissions only to the exact configured email and redirects each role', async () => {
    const response = await signIn(adminEmail, password, 'admin');
    expect(await response.json()).toEqual({ ok: true, redirect: '/admin' });
    mocks.cookieGet.mockReturnValue({ value: response.cookies.get(REVIEWER_COOKIE)!.value });
    expect(await requireAdmin()).toMatchObject({ isAdmin: true });
    vi.stubEnv('ADMIN_EMAIL', `not-${adminEmail}`);
    expect(await getReviewer()).toMatchObject({ isAdmin: false });
    await expect(requireAdmin()).rejects.toThrow('NEXT_REDIRECT');
    mocks.cookieGet.mockReturnValue(undefined);
    await expect(requireReviewer()).rejects.toThrow('NEXT_REDIRECT');
  });
  it('gives the second configured admin full access and rechecks that slot on every request', async () => {
    vi.stubEnv('SECOND_ADMIN_EMAIL', reviewerEmail);
    const response = await signIn(reviewerEmail, password, 'admin');
    expect(await response.json()).toEqual({ ok: true, redirect: '/admin' });
    mocks.cookieGet.mockReturnValue({ value: response.cookies.get(REVIEWER_COOKIE)!.value });
    expect(await requireAdmin()).toMatchObject({ id: reviewerId, isAdmin: true });
    expect(await requireReviewer()).toMatchObject({ id: reviewerId, isAdmin: true });
    expect((await resetByAdmin({ email: 'third@example.test', name: 'Third reviewer', is_active: true, password })).status).toBe(200);
    expect((await signIn('third@example.test', password, 'admin')).status).toBe(401);
    vi.stubEnv('SECOND_ADMIN_EMAIL', '');
    expect(await requireReviewer()).toMatchObject({ isAdmin: false });
    await expect(requireAdmin()).rejects.toThrow('NEXT_REDIRECT');
    expect((await resetByAdmin({ email: 'fourth@example.test', name: 'Fourth reviewer', is_active: true, password })).status).toBe(403);
    vi.stubEnv('SECOND_ADMIN_EMAIL', reviewerEmail);
    await db.query('update reviewers set is_active=false where id=$1', [reviewerId]);
    expect(await getReviewer()).toBeNull();
    expect((await signIn(reviewerEmail, password, 'admin')).status).toBe(401);
  });
  it('lets admins use reviewer sign-in and rejects client-supplied privileges', async () => {
    expect(await (await signIn(adminEmail)).json()).toEqual({ ok: true, redirect: '/admin' });
    await createSession();
    for (const resource of ['reviewers', 'topics', 'events', 'writers', 'samples']) {
      const response = await adminMutation(post('/api/admin/' + resource, { action: 'save', values: {} }), { params: Promise.resolve({ resource }) });
      expect(response.status).toBe(403);
    }
    expect((await login(post('/api/login', { email: reviewerEmail, password, role: 'reviewer', isAdmin: true }))).status).toBe(400);
    await db.exec('delete from reviewer_sessions'); await createSession(adminEmail);
    for (const privilege of [{ isAdmin: true }, { role: 'admin' }]) {
      expect((await resetByAdmin({ email: 'extra@example.test', name: 'Extra reviewer', is_active: true, password, ...privilege })).status).toBe(400);
    }
  });
  it('lets both admins claim, edit, publish, and unpublish while preserving the private original', async () => {
    vi.stubEnv('SECOND_ADMIN_EMAIL', reviewerEmail);
    const topicId = '10000000-0000-4000-8000-000000000001';
    await db.query('insert into topics(id,slug,name) values($1,$2,$3)', [topicId, 'campus', 'Campus']);
    for (const email of [adminEmail, reviewerEmail]) {
      await db.exec('delete from reviewer_sessions'); await createSession(email);
      const id = (await db.query<{ id: string }>("insert into posts(author_name) values('Test writer') returning id")).rows[0].id;
      await db.query('insert into submission_private(post_id,author_email,original_body) values($1,$2,$3)', [id, 'writer@illinois.edu', 'The private unchanged original.']);
      let version = 1;
      const changes = { headline: 'Admin review test', short_version: 'A complete editorial workflow.', final_body: 'The agreed final version of this campus story is ready for readers.', byline: 'Test writer', topic_id: topicId, sources: [] };
      for (const action of ['claim', 'save', 'publish', 'unpublish']) {
        const response = await reviewMutation(post('/api/review/' + id, { action, version, changes: ['save', 'publish'].includes(action) ? changes : {} }), { params: Promise.resolve({ id }) });
        expect(response.status).toBe(200);
        const result = await response.json(); expect(result.version).toBe(version + 1); version = result.version;
        if (action === 'publish') expect((await db.query('select id from public_posts where id=$1', [id])).rows).toHaveLength(1);
      }
      expect((await db.query('select id from public_posts where id=$1', [id])).rows).toHaveLength(0);
      expect((await db.query('select original_body from submission_private where post_id=$1', [id])).rows).toEqual([{ original_body: 'The private unchanged original.' }]);
    }
  });
  it('changes either role’s password, rotates the current session, and rejects the old password', async () => {
    for (const email of [reviewerEmail, adminEmail]) {
      await db.exec('delete from reviewer_sessions');
      await createSession(email);
      const response = await change();
      expect(await response.json()).toEqual({ ok: true });
      const raw = response.cookies.get(REVIEWER_COOKIE)!.value;
      expect(raw).not.toBe(sessionToken);
      expect((await db.query('select token_hash,email from reviewer_sessions')).rows).toEqual([{ token_hash: hashSessionToken(raw), email }]);
      expect(await getReviewer()).toBeNull();
      mocks.cookieGet.mockReturnValue({ value: raw });
      expect(await getReviewer()).toMatchObject({ email });
      expect((await signIn(email)).status).toBe(401);
      expect((await signIn(email, replacement)).status).toBe(200);
    }
  });
  it('requires a session, current password, matching confirmation, length limits, and same origin for changes', async () => {
    expect((await change()).status).toBe(401);
    await createSession();
    for (const response of [await change('wrong'), await change(password, replacement, 'mismatch'), await change(password, 'short'), await change(password, password)]) expect(response.status).toBe(400);
    expect((await changePassword(post('/api/account/password', {}, { origin: 'https://evil.example' }))).status).toBe(403);
    expect((await db.query('select password_hash from reviewers where id=$1', [reviewerId])).rows[0]).toEqual({ password_hash: initialHash });
    expect((await db.query('select * from reviewer_sessions')).rows).toHaveLength(1);
  });
  it('allows only the admin to create reviewer credentials and reset them without exposing the hash', async () => {
    await createSession();
    const values = { email: 'new@example.test', name: 'New reviewer', is_active: true, password };
    expect((await resetByAdmin(values)).status).toBe(403);
    await db.exec('delete from reviewer_sessions'); await createSession(adminEmail);
    const response = await resetByAdmin(values);
    const result = await response.json(); expect(result).toEqual({ ok: true, id: expect.any(String) });
    expect((await signIn(values.email)).status).toBe(200);
    const reset = await resetByAdmin({ ...values, password: replacement }, result.id);
    expect(reset.status).toBe(200);
    expect((await db.query('select * from reviewer_sessions where email=$1', [values.email])).rows).toHaveLength(0);
    expect((await signIn(values.email)).status).toBe(401);
    expect((await signIn(values.email, replacement)).status).toBe(200);
    expect((await resetByAdmin({ ...values, password: '' }, result.id)).status).toBe(200);
    expect((await signIn(values.email, replacement)).status).toBe(200);
    expect((await resetByAdmin({ ...values, email: 'empty@example.test', password: '' })).status).toBe(400);
    expect((await resetByAdmin({ ...values, email: adminEmail, password: replacement }, reviewerId)).status).toBe(400);
    expect((await resetByAdmin({ ...values, email: adminEmail, password: replacement }, adminId)).status).toBe(400);
  });
  it('invalidates sessions on email changes, disabling, deletion, and password resets, without resurrection', async () => {
    for (const sql of ["update reviewers set email='renamed@example.test' where id=$1", 'update reviewers set is_active=false where id=$1', 'delete from reviewers where id=$1', 'update reviewers set password_hash=null where id=$1']) {
      await db.exec('savepoint account_change'); await createSession(); await db.query(sql, [reviewerId]);
      expect((await db.query('select * from reviewer_sessions')).rows).toHaveLength(0);
      expect(await getReviewer()).toBeNull();
      await db.exec('rollback to savepoint account_change');
    }
  });
  it('rechecks the verified hash so stale credentials cannot create sessions or overwrite a reset', async () => {
    const newHash = await hashPassword(replacement);
    await db.query('update reviewers set password_hash=$1 where id=$2', [newHash, reviewerId]);
    const login = await db.query('select create_password_session($1,$2,$3,$4) as result', [reviewerId, reviewerEmail, initialHash, hashSessionToken(sessionToken)]);
    expect(login.rows[0]).toEqual({ result: { status: 'invalid' } });
    const change = await db.query('select change_reviewer_password($1,$2,$3,$4,$5) as result', [reviewerId, hashSessionToken(sessionToken), initialHash, initialHash, hashSessionToken(sessionToken)]);
    expect(change.rows[0]).toEqual({ result: { status: 'invalid' } });
    expect((await db.query('select * from reviewer_sessions')).rows).toHaveLength(0);
  });
  it('keeps password hashes and auth functions private to the backend', async () => {
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      for (const sql of ['select password_hash from reviewers', 'select * from reviewer_sessions', "select create_password_session(gen_random_uuid(),'email','hash',repeat('b',64))", "select change_reviewer_password(gen_random_uuid(),repeat('a',64),'old','new',repeat('b',64))"]) {
        await db.exec('savepoint denied'); await expect(db.query(sql)).rejects.toThrow(/permission denied/); await db.exec('rollback to savepoint denied');
      }
      await db.exec('reset role');
    }
  });
  it('enforces origin, honeypot, body caps, and shared email/IP limits before expensive password work', async () => {
    const input = { email: reviewerEmail, password, role: 'reviewer' };
    expect((await login(post('/api/login', input, { origin: 'https://evil.example' }))).status).toBe(403);
    expect((await login(post('/api/login', { ...input, website: 'spam' }))).status).toBe(400);
    expect((await login(post('/api/login', { ...input, extra: 'x'.repeat(5000) }))).status).toBe(413);
    expect(databaseCalls).toBe(0);
    await signIn(); await db.exec('update rate_limits set requests=10');
    expect((await signIn()).status).toBe(429);
    await db.exec('update rate_limits set requests=60');
    expect((await signIn('another@example.test')).status).toBe(429);
  });
  it('rejects forged and expired sessions and fails closed on database outages', async () => {
    mocks.cookieGet.mockReturnValue({ value: JSON.stringify({ email: adminEmail }) });
    expect(await getReviewer()).toBeNull(); expect(databaseCalls).toBe(0);
    await createSession(reviewerEmail, new Date(Date.now() - 1000).toISOString()); expect(await getReviewer()).toBeNull();
    unavailable = true; expect(await getReviewer()).toBeNull();
    const response = await signIn(); expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('Private connection');
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('Private connection');
    vi.stubEnv('DATABASE_URL', ''); expect((await signIn()).status).toBe(503);
  });
  it('retires magic links and never accepts them as password authentication', async () => {
    expect((await callback()).headers.get('location')).toBe(new URL('/login?error=password', site.url).href);
    expect((await login(post('/api/login', { email: reviewerEmail }))).status).toBe(400);
    expect((await db.query("select consume_login(repeat('a',64),repeat('b',64),null) as result")).rows[0]).toEqual({ result: { status: 'invalid' } });
  });
  it('deletes the server session on logout and lets a failed invalidation retry', async () => {
    await createSession();
    expect((await logout(post('/api/logout', {}, { origin: 'https://evil.example' }))).status).toBe(403);
    unavailable = true; expect((await logout(post('/api/logout'))).status).toBe(503);
    expect(mocks.cookieSet).not.toHaveBeenCalled();
    unavailable = false; expect((await logout(post('/api/logout'))).status).toBe(200);
    expect((await db.query('select * from reviewer_sessions')).rows).toHaveLength(0);
    expect(mocks.cookieSet).toHaveBeenCalledWith(REVIEWER_COOKIE, '', expect.objectContaining({ httpOnly: true, maxAge: 0 }));
  });
  it('marks private routes no-store', () => {
    const response = proxy(new NextRequest(new URL('/account', site.url)));
    expect(response.headers.get('cache-control')).toBe('private, no-store'); expect(response.headers.get('pragma')).toBe('no-cache');
    expect(response.headers.get('set-cookie')).toBeNull();
  });
});
