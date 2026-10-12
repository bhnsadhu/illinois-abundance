import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import Home from '@/app/page';
import { POST as submit } from '@/app/api/submissions/route';
import { POST as verify } from '@/app/api/submissions/verify/route';
import { POST as login } from '@/app/api/login/route';
import { GET as callback } from '@/app/auth/callback/route';
import { POST as review } from '@/app/api/review/[id]/route';
import { REVIEWER_COOKIE } from '@/lib/auth';
import { SUBMISSION_COOKIE } from '@/lib/submissions';
import { publicDatabase } from '@/lib/database/public';
import { site } from '@/lib/config';

const mocks = vi.hoisted(() => ({ sendEmail: vi.fn(), cookieGet: vi.fn(), revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock('resend', () => ({ Resend: class { emails = { send: mocks.sendEmail }; } }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: mocks.cookieGet }) }));
vi.mock('next/cache', () => ({
  unstable_cache: <T>(fn: T) => fn,
  revalidateTag: mocks.revalidateTag,
  revalidatePath: mocks.revalidatePath,
}));

type Statement = { text: string; values: unknown[] };
type QueryResult = { rows: Record<string, unknown>[]; rowCount: number };
let db: PGlite;
let queue: Promise<unknown> = Promise.resolve();
let anonymousTransactions = 0;
const observedSql: string[] = [];

// Only the external Neon transport is replaced. Production query generation,
// role reduction, authentication, validation, and route handlers all run here.
// A real transaction owns every SET LOCAL ROLE, including concurrent Home reads.
function enqueue<T>(action: () => Promise<T>): Promise<T> {
  const pending = queue.then(action);
  queue = pending.catch(() => undefined);
  return pending;
}
vi.mock('@neondatabase/serverless', () => ({ neon: () => ({
  query: (text: string, values: unknown[] = []) => enqueue(async () => {
    observedSql.push(text);
    const result = await db.query<Record<string, unknown>>(text, values);
    return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length };
  }),
  transaction: (build: (client: { query: (text: string, values?: unknown[]) => Statement }) => Statement[], options: { readOnly?: boolean }) => enqueue(async () => {
    const statements = build({ query: (text, values = []) => ({ text, values }) });
    if (statements[0]?.text === 'SET LOCAL ROLE anon') anonymousTransactions++;
    return db.transaction(async transaction => {
      if (options.readOnly) await transaction.exec('SET TRANSACTION READ ONLY');
      const results: QueryResult[] = [];
      for (const statement of statements) {
        observedSql.push(statement.text);
        const result = await transaction.query<Record<string, unknown>>(statement.text, statement.values);
        results.push({ rows: result.rows, rowCount: result.affectedRows ?? result.rows.length });
      }
      return results;
    });
  }),
}) }));

function request(path: string, body: unknown, cookie?: string) {
  return new NextRequest(new URL(path, site.url), {
    method: 'POST', headers: { origin: new URL(site.url).origin, 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  vi.stubEnv('DATABASE_URL', 'postgresql://workflow-only.invalid/no-network');
  vi.stubEnv('CODE_PEPPER', 'workflow-test-pepper-longer-than-thirty-two-characters');
  vi.stubEnv('RESEND_API_KEY', 'mock-mail-only');
  vi.stubEnv('MAIL_FROM', 'Illinois Abundance <test@example.test>');
  vi.stubEnv('SEED_SAMPLE_CONTENT', 'false');
  mocks.sendEmail.mockResolvedValue({ data: { id: 'mock-delivery' }, error: null });
  mocks.cookieGet.mockReturnValue(undefined);
  db = new PGlite();
  const directory = new URL('../db/migrations/', import.meta.url);
  for (const file of (await readdir(directory)).filter(file => file.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file, directory), 'utf8'));
  await db.exec(await readFile(new URL('../db/seed.sql', import.meta.url), 'utf8'));
  await db.query('insert into reviewers(id,email,name) values($1,$2,$3)', ['70000000-0000-4000-8000-000000000019', 'editor@illinois.edu', 'Workflow Editor']);
}, 30000);
afterAll(async () => { await queue; await db.close(); vi.unstubAllEnvs(); });

it('takes a real submission through verification and review into public Home HTML, without exposing its private archive', async () => {
  const form = {
    name: 'Student Writer', email: 'private-student-address@illinois.edu', website: '',
    body: '  PRIVATE ORIGINAL: my complete unedited thoughts belong in the permanent archive.\nKeep this exact original spacing.  ',
  };
  const emptyHome = renderToStaticMarkup(await Home());
  expect(emptyHome).toContain('class="empty-state"');
  expect(emptyHome).not.toContain('id="featured-title"');

  const submitted = await submit(request('/api/submissions', form));
  expect(submitted.status).toBe(200);
  expect(await submitted.json()).toEqual({ ok: true });
  const challengeId = submitted.cookies.get(SUBMISSION_COOKIE)!.value;
  const codeEmail = mocks.sendEmail.mock.calls[0][0] as { text: string; to: string[] };
  const code = codeEmail.text.match(/code is (\d{6})/)![1];
  expect((await db.query('select * from posts')).rows).toHaveLength(0);
  const verified = await verify(request('/api/submissions/verify', { code }, `${SUBMISSION_COOKIE}=${challengeId}`));
  expect(verified.status).toBe(200);
  expect(await verified.json()).toEqual({ ok: true });
  expect(mocks.sendEmail).toHaveBeenCalledTimes(2);
  const post = (await db.query<{ id: string; status: string; version: number }>('select id,status,version from posts')).rows[0];
  expect(post).toMatchObject({ status: 'new', version: 1 });
  expect(renderToStaticMarkup(await Home())).not.toContain('PRIVATE ORIGINAL');
  expect((await publicDatabase()!.from('public_posts').select('*')).data).toEqual([]);

  // Enter through the real passwordless login and session lookup, too.
  expect((await login(request('/api/login', { email: 'editor@illinois.edu' }))).status).toBe(200);
  const loginEmail = mocks.sendEmail.mock.calls[2][0] as { text: string };
  const url = loginEmail.text.match(/https?:\/\/\S+\/auth\/callback\?token=[a-f0-9]+/)![0];
  const signedIn = await callback(new NextRequest(url));
  expect(new URL(signedIn.headers.get('location')!).pathname).toBe('/review');
  const session = signedIn.cookies.get(REVIEWER_COOKIE)!;
  mocks.cookieGet.mockImplementation((name: string) => name === REVIEWER_COOKIE ? session : undefined);

  const context = { params: Promise.resolve({ id: post.id }) };
  const claimed = await review(request(`/api/review/${post.id}`, { action: 'claim', version: 1 }), context);
  expect(await claimed.json()).toMatchObject({ ok: true, version: 2, status: 'in_progress' });
  const edited = {
    headline: 'Homes near campus, room for everyone', short_version: 'A practical student proposal for more homes near the places we learn.',
    final_body: 'CHAMPAIGN, Ill. This is the edited, approved article. More homes can make campus life easier for everyone.',
    byline: 'Student Writer', topic_id: '10000000-0000-4000-8000-000000000001',
    sources: [{ label: 'City planning department', url: 'https://champaignil.gov/planning/' }],
  };
  const published = await review(request(`/api/review/${post.id}`, { action: 'publish', version: 2, changes: edited }), context);
  expect(published.status).toBe(200);
  const result = await published.json() as { slug: string; version: number };
  expect(result.version).toBe(3);
  expect(mocks.revalidateTag).toHaveBeenCalledWith('public-content', { expire: 0 });
  expect(mocks.revalidatePath).toHaveBeenCalledWith(`/post/${result.slug}`);

  // Public rendering is anonymous even while the request has a reviewer cookie.
  const html = renderToStaticMarkup(await Home());
  expect(html).toContain(edited.headline);
  expect(html).toContain(edited.short_version);
  expect(html).toContain(`/post/${result.slug}`);
  expect(html).toContain('Student Writer');
  for (const privateValue of [form.email, 'PRIVATE ORIGINAL', 'editor@illinois.edu', 'original_body', 'author_email', 'claimed_by', 'decline_note']) expect(html).not.toContain(privateValue);
  const publicRows = await publicDatabase()!.from('public_posts').select('*');
  expect(publicRows.error).toBeNull();
  expect(publicRows.data).toHaveLength(1);
  expect(publicRows.data![0].final_body).toBe(edited.final_body);
  for (const column of ['original_body', 'author_email', 'claimed_by', 'decline_note', 'version', 'status']) expect(publicRows.data![0]).not.toHaveProperty(column);
  expect((await publicDatabase()!.from('submission_private').select('*')).error?.code).toBe('42501');
  expect((await db.query('select author_email,original_body,claimed_by from submission_private where post_id=$1', [post.id])).rows).toEqual([
    { author_email: form.email, original_body: form.body, claimed_by: '70000000-0000-4000-8000-000000000019' },
  ]);
  expect(anonymousTransactions).toBeGreaterThan(5);
  expect(observedSql).toContain('SET LOCAL ROLE anon');

  const unpublished = await review(request(`/api/review/${post.id}`, { action: 'unpublish', version: 3 }), context);
  expect(unpublished.status).toBe(200);
  expect(renderToStaticMarkup(await Home())).not.toContain(edited.headline);
  expect((await publicDatabase()!.from('public_posts').select('*')).data).toEqual([]);
  expect((await db.query('select original_body from submission_private where post_id=$1', [post.id])).rows[0]).toEqual({ original_body: form.body });
});
