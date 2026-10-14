import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/admin/[resource]/route';
import { site } from '@/lib/config';

const mocks = vi.hoisted(() => ({ reviewer: vi.fn(), revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getReviewer: mocks.reviewer }));
vi.mock('next/cache', () => ({ revalidateTag: mocks.revalidateTag, revalidatePath: mocks.revalidatePath }));
let db: PGlite;
let queries: string[] = [];
let unavailable = false;
// Keep production SQL generation. Savepoints isolate expected constraint errors
// inside each test's rollback transaction, as separate HTTP queries would be.
vi.mock('@neondatabase/serverless', () => ({ neon: () => ({
  async query(text: string, values: unknown[] = []) {
    queries.push(text);
    if (unavailable) throw Object.assign(new Error('Private connection detail'), { code: '08006' });
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

const adminId = '70000000-0000-4000-8000-000000000001';
const adminEmail = 'owner@example.test';
const admin = { id: adminId, name: 'Site admin', email: adminEmail, isAdmin: true };
const missingId = '70000000-0000-4000-8000-000000000099';
const topicId = '10000000-0000-4000-8000-000000000001';
const fixtures = {
  reviewers: { email: 'new-reviewer@illinois.edu', name: 'New Reviewer', is_active: true, password: 'Reviewer password 2026' },
  topics: { slug: 'better-places', name: 'Better places', description: '', sort_order: 0, is_active: true },
  events: { slug: 'housing-teach-in', title: 'Housing teach in', description: '', starts_at: '2026-11-01T18:00:00-06:00', ends_at: null, location: 'Campus library', rsvp_url: null, recap_post_id: null, is_published: true },
  writers: { slug: 'new-writer', name: 'New Writer', bio: '' },
  learn: { slug: 'housing-basics', title: 'Housing basics', short_version: '', body: 'A useful introduction to housing policy.', is_published: true },
  meetings: { body_name: 'Champaign city council', starts_at: '2026-11-02T18:00:00-06:00', location: 'City hall', agenda_url: null, is_published: true },
};
type Resource = keyof typeof fixtures;
const tables: Record<Resource, string> = { reviewers: 'reviewers', topics: 'topics', events: 'events', writers: 'writers', learn: 'learn_pages', meetings: 'meetings' };

function call(resource: string, input: unknown, origin = new URL(site.url).origin) {
  const request = new Request(new URL(`/api/admin/${resource}`, site.url), {
    method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(input),
  });
  return POST(request, { params: Promise.resolve({ resource }) });
}
async function create(resource: Resource, values: Record<string, unknown> = fixtures[resource]) {
  const response = await call(resource, { action: 'save', values });
  expect(response.status).toBe(200);
  const result = await response.json() as { ok: boolean; id: string };
  expect(result).toEqual({ ok: true, id: expect.any(String) });
  return result.id;
}

beforeAll(async () => {
  db = new PGlite();
  const directory = new URL('../db/migrations/', import.meta.url);
  for (const file of (await readdir(directory)).filter(file => file.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file, directory), 'utf8'));
  await db.exec(await readFile(new URL('../db/seed.sql', import.meta.url), 'utf8'));
}, 30000);
beforeEach(async () => {
  await db.exec('begin');
  await db.query('insert into reviewers(id,email,name) values($1,$2,$3)', [adminId, adminEmail, 'Site admin']);
  vi.stubEnv('DATABASE_URL', 'postgresql://admin-only.invalid/no-network');
  vi.stubEnv('ADMIN_EMAIL', adminEmail);
  vi.stubEnv('SECOND_ADMIN_EMAIL', '');
  vi.stubEnv('CODE_PEPPER', 'admin-test-pepper-longer-than-thirty-two-characters');
  mocks.reviewer.mockReset().mockResolvedValue(admin);
  mocks.revalidateTag.mockReset(); mocks.revalidatePath.mockReset();
  queries = []; unavailable = false;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(async () => { await db.exec('rollback'); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
afterAll(async () => { await db.close(); });

describe('admin content HTTP actions', () => {
  it('requires the current exact configured admin and same origin before touching the database', async () => {
    mocks.reviewer.mockResolvedValue(null);
    expect((await call('topics', { action: 'save', values: fixtures.topics })).status).toBe(401);
    mocks.reviewer.mockResolvedValue({ ...admin, isAdmin: false });
    expect((await call('topics', { action: 'save', values: fixtures.topics })).status).toBe(403);
    mocks.reviewer.mockResolvedValue({ ...admin, email: 'other@example.test' });
    expect((await call('topics', { action: 'save', values: fixtures.topics })).status).toBe(403);
    mocks.reviewer.mockResolvedValue(admin);
    expect((await call('topics', { action: 'save', values: fixtures.topics }, 'https://evil.example')).status).toBe(403);
    expect(queries).toHaveLength(0);
  });

  it('creates, updates and removes every editable resource with explicit returned IDs', async () => {
    for (const resource of Object.keys(fixtures) as Resource[]) {
      const id = await create(resource);
      const values = { ...fixtures[resource], ...(resource === 'reviewers' ? { name: 'Updated Reviewer', email: 'UPDATED@ILLINOIS.EDU' }
        : resource === 'topics' || resource === 'writers' ? { name: 'Updated name' }
          : resource === 'meetings' ? { body_name: 'Updated council' } : { title: 'Updated title' }) };
      expect(await (await call(resource, { action: 'save', id, values })).json()).toEqual({ ok: true, id });
      const saved = (await db.query<Record<string, unknown>>(`select * from ${tables[resource]} where id=$1`, [id])).rows[0];
      const field = resource === 'reviewers' || resource === 'topics' || resource === 'writers' ? 'name' : resource === 'meetings' ? 'body_name' : 'title';
      expect(saved[field]).toContain('Updated');
      if (resource === 'reviewers') expect(saved.email).toBe('updated@illinois.edu');
      else expect(saved.is_sample).toBe(false);
      expect(await (await call(resource, { action: 'delete', id })).json()).toEqual({ ok: true, id });
      expect((await db.query(`select id from ${tables[resource]} where id=$1`, [id])).rows).toHaveLength(0);
    }
    expect(mocks.revalidateTag).toHaveBeenCalledWith('public-content', { expire: 0 });
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/writer/[slug]', 'page');
  });

  it('applies defaults only when creating and requires complete forms for edits', async () => {
    const id = await create('topics', { slug: 'new-idea', name: 'New idea' });
    expect((await db.query('select description,sort_order,is_active from topics where id=$1', [id])).rows[0]).toEqual({ description: '', sort_order: 0, is_active: true });
    expect((await call('topics', { action: 'save', id, values: { slug: 'new-idea', name: 'Oops' } })).status).toBe(400);
    expect((await db.query('select name from topics where id=$1', [id])).rows[0]).toEqual({ name: 'New idea' });
  });

  it('protects sample markers, timestamps, writer contacts, and the original-submission API boundary', async () => {
    for (const values of [
      { ...fixtures.writers, is_sample: true }, { ...fixtures.writers, email: 'private@illinois.edu' },
      { ...fixtures.writers, avatar_url: 'https://example.test/avatar.png' },
    ]) expect((await call('writers', { action: 'save', values })).status).toBe(400);
    expect((await call('learn', { action: 'save', values: { ...fixtures.learn, updated_at: '2000-01-01T00:00:00Z' } })).status).toBe(400);
    for (const resource of ['posts', 'submission_private', 'writer_contacts', 'login_tokens', 'topics;drop table posts']) {
      expect((await call(resource, { action: 'delete', id: missingId })).status).toBe(404);
    }
    expect((await db.query('select * from writers')).rows).toHaveLength(0);
  });

  it('validates safe URLs, timezone-aware dates, event ordering, lengths, and typed fields', async () => {
    const invalid: [Resource, Record<string, unknown>][] = [
      ['events', { ...fixtures.events, rsvp_url: 'javascript:alert(1)' }],
      ['events', { ...fixtures.events, starts_at: '2026-11-01T18:00' }],
      ['events', { ...fixtures.events, ends_at: '2026-11-01T17:00:00-06:00' }],
      ['events', { ...fixtures.events, location: 'x'.repeat(301) }],
      ['meetings', { ...fixtures.meetings, agenda_url: 'data:text/html,bad' }],
      ['topics', { ...fixtures.topics, is_active: 'false' }],
      ['topics', { ...fixtures.topics, slug: '../private' }],
      ['reviewers', { ...fixtures.reviewers, email: 'not-an-address' }],
    ];
    for (const [resource, values] of invalid) expect((await call(resource, { action: 'save', values })).status).toBe(400);
    const id = await create('events', { ...fixtures.events, rsvp_url: '', ends_at: '', recap_post_id: '' });
    expect((await db.query('select rsvp_url,ends_at,recap_post_id from events where id=$1', [id])).rows[0]).toEqual({ rsvp_url: null, ends_at: null, recap_post_id: null });
  });

  it('cannot disable, remove, or change the configured admin email', async () => {
    const attempts = [
      { action: 'delete', id: adminId },
      { action: 'save', id: adminId, values: { name: 'Admin', email: adminEmail, is_active: false } },
      { action: 'save', id: adminId, values: { name: 'Admin', email: 'changed@example.test', is_active: true } },
      { action: 'save', values: { name: 'Admin', email: adminEmail, is_active: false } },
    ];
    for (const input of attempts) expect((await call('reviewers', input)).status).toBe(400);
    expect((await db.query('select email,is_active from reviewers where id=$1', [adminId])).rows[0]).toEqual({ email: adminEmail, is_active: true });
  });

  it('protects both admin identities from deletion, reassignment, takeover, and roster password resets', async () => {
    const secondEmail = 'second@example.test';
    const secondId = await create('reviewers', { ...fixtures.reviewers, email: secondEmail });
    const ordinaryId = await create('reviewers');
    vi.stubEnv('SECOND_ADMIN_EMAIL', secondEmail);
    for (const actor of [admin, { id: secondId, name: 'Second admin', email: secondEmail, isAdmin: true }]) {
      mocks.reviewer.mockResolvedValue(actor);
      for (const [id, email] of [[adminId, adminEmail], [secondId, secondEmail]]) {
        for (const input of [
          { action: 'delete', id },
          { action: 'save', id, values: { name: 'Admin', email, is_active: false } },
          { action: 'save', id, values: { name: 'Admin', email: 'changed@example.test', is_active: true } },
          { action: 'save', id, values: { name: 'Admin', email, is_active: true, password: 'Changed password 2026' } },
          { action: 'save', id: ordinaryId, values: { name: 'Takeover', email, is_active: true } },
          { action: 'save', values: { ...fixtures.reviewers, email } },
        ]) expect((await call('reviewers', input)).status).toBe(400);
      }
      expect((await call('reviewers', { action: 'save', id: ordinaryId, values: { ...fixtures.reviewers, name: 'Updated by an admin' } })).status).toBe(200);
    }
    expect((await db.query('select email,is_active from reviewers where id=any($1)', [[adminId, secondId]])).rows).toEqual(expect.arrayContaining([
      { email: adminEmail, is_active: true }, { email: secondEmail, is_active: true },
    ]));
  });

  it('returns friendly conflicts for duplicate links and referenced records without removing original submissions', async () => {
    await create('topics');
    const duplicate = await call('topics', { action: 'save', values: fixtures.topics });
    expect(duplicate.status).toBe(409); expect(await duplicate.text()).toContain('already in use');
    const writerId = await create('writers');
    const realPost = (await db.query<{ id: string }>('insert into posts(author_name,topic_id,writer_id) values($1,$2,$3) returning id', ['Student', topicId, writerId])).rows[0].id;
    await db.query('insert into submission_private(post_id,author_email,original_body) values($1,$2,$3)', [realPost, 'private@illinois.edu', 'The genuine immutable original.']);
    for (const [resource, id] of [['topics', topicId], ['writers', writerId]]) {
      const response = await call(resource, { action: 'delete', id });
      expect(response.status).toBe(409); expect(await response.text()).toContain('Other content still uses');
    }
    expect((await db.query('select original_body from submission_private')).rows).toEqual([{ original_body: 'The genuine immutable original.' }]);
    expect((await call('topics', { action: 'delete', id: missingId })).status).toBe(404);
  });

  it('allows only removal of subscribers, with no path to add or confirm one administratively', async () => {
    await db.query('insert into subscribers(email,confirmed_at,token) values($1,now(),$2)', ['reader@example.test', 'a'.repeat(64)]);
    expect((await call('subscribers', { action: 'save', values: { email: 'reader@example.test', confirmed_at: '2026-10-12T00:00:00Z' } })).status).toBe(400);
    expect((await call('subscribers', { action: 'delete', values: { email: 'READER@example.test', token: 'attack' } })).status).toBe(400);
    expect(await (await call('subscribers', { action: 'delete', values: { email: 'READER@example.test' } })).json()).toEqual({ ok: true });
    expect((await db.query('select * from subscribers')).rows).toHaveLength(0);
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
  });

  it('removes only sample content while retaining real originals and foundational topics', async () => {
    await db.exec(`insert into posts(id,author_name,is_sample) values
      ('30000000-0000-4000-8000-000000000001','Sample Writer',true),
      ('30000000-0000-4000-8000-000000000002','Real Writer',false);
      insert into submission_private(post_id,author_email,original_body,is_sample) values
      ('30000000-0000-4000-8000-000000000001','sample@illinois.edu','Sample original.',true),
      ('30000000-0000-4000-8000-000000000002','real@illinois.edu','Genuine original.',false);`);
    expect((await call('samples', { action: 'save' })).status).toBe(400);
    expect(await (await call('samples', { action: 'delete' })).json()).toEqual({ ok: true });
    expect((await db.query('select original_body from submission_private')).rows).toEqual([{ original_body: 'Genuine original.' }]);
    expect((await db.query('select count(*)::int as total from topics')).rows[0]).toEqual({ total: 6 });
    expect(mocks.revalidateTag).toHaveBeenCalledWith('public-content', { expire: 0 });
  });

  it('sets learn update timestamps on the server and returns only the saved ID', async () => {
    const id = await create('learn');
    await db.query("update learn_pages set updated_at='2000-01-01T00:00:00Z' where id=$1", [id]);
    const response = await call('learn', { action: 'save', id, values: { ...fixtures.learn, body: 'Updated lesson.' } });
    expect(await response.json()).toEqual({ ok: true, id });
    const record = (await db.query<{ updated_at: Date }>('select updated_at from learn_pages where id=$1', [id])).rows[0];
    expect(new Date(record.updated_at).getTime()).toBeGreaterThan(Date.now() - 10000);
  });

  it('bounds request bodies and shares rate limits before any content mutation', async () => {
    expect((await call('learn', { action: 'save', values: { ...fixtures.learn, body: 'x'.repeat(160001) } })).status).toBe(413);
    expect(queries).toHaveLength(0);
    await create('topics');
    await db.exec('update rate_limits set requests=120');
    expect((await call('topics', { action: 'save', values: { ...fixtures.topics, slug: 'rate-limited' } })).status).toBe(429);
    expect((await db.query("select * from topics where slug='rate-limited'")).rows).toHaveLength(0);
  });

  it('returns private no-store responses and conceals database errors', async () => {
    unavailable = true;
    const response = await call('topics', { action: 'save', values: fixtures.topics });
    expect(response.status).toBe(503); expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(await response.text()).not.toContain('Private connection');
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('Private connection');
  });
});
