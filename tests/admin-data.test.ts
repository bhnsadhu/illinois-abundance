import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as exportCsv } from '@/app/api/admin/export/route';
import { getAdminStats, type AdminStats } from '@/lib/admin-data';
import { DatabaseQuery } from '@/lib/database/client';
import { csvCell } from '@/lib/format';

const mocks = vi.hoisted(() => ({ reviewer: vi.fn(), service: vi.fn() }));
vi.mock('@/lib/auth', () => ({
  getReviewer: mocks.reviewer,
  requireAdmin: async () => {
    const reviewer = await mocks.reviewer();
    if (!reviewer?.isAdmin) throw new Error('Admin access required');
    return reviewer;
  },
}));
vi.mock('@/lib/database/service', () => ({ serviceDatabase: mocks.service }));

let db: PGlite;
let executed: { text: string; values: unknown[] }[];
let failQueries = false;
const admin = { id: '70000000-0000-4000-8000-000000000001', email: 'admin@example.test', name: 'Admin', isAdmin: true };
const ids = [1, 2, 3, 4].map(n => `30000000-0000-4000-8000-${String(n).padStart(12, '0')}`);
const original = 'Original private draft, with "quotes".\nKeep this exact.';

function adapter() {
  return {
    from(table: string) {
      return new DatabaseQuery(table, async statements => {
        const results = [];
        for (const statement of statements) {
          executed.push(statement);
          if (failQueries) throw new Error('Private provider payload student@illinois.edu');
          const result = await db.query<Record<string, unknown>>(statement.text, statement.values);
          results.push({ rows: result.rows, rowCount: result.affectedRows ?? result.rows.length });
        }
        return results;
      }, false);
    },
    async rpc(name: string) {
      const { rows } = await db.query<{ result: AdminStats }>(`select public.${name}() as result`);
      return { data: rows[0].result, error: null };
    },
  };
}

function request(type = 'published') {
  return new Request(`http://localhost:3000/api/admin/export?type=${type}`);
}

async function scenario() {
  await db.exec(`
    insert into writers(id,slug,name) values
      ('20000000-0000-4000-8000-000000000001','student-one','Student One'),
      ('20000000-0000-4000-8000-000000000002','sample-writer','Sample Writer');
  `);
  for (let i = 0; i < ids.length; i++) {
    await db.query(`
      insert into posts(id,status,slug,author_name,headline,short_version,final_body,byline,
        topic_id,writer_id,created_at,published_at,is_sample)
      values($1,$2,$3,'Student One',$4,'A short version.','Edited public text.','Student One',
        '10000000-0000-4000-8000-000000000001',$5,'2026-10-01T00:00:00Z',$6,$7)
    `, [ids[i], ['published', 'unpublished', 'new', 'published'][i], `story-${i + 1}`, `Story ${i + 1}`,
      `20000000-0000-4000-8000-00000000000${i === 3 ? 2 : 1}`,
      ['2026-10-01T02:00:00Z', '2026-10-01T06:00:00Z', null, '2026-10-05T00:00:00Z'][i], i === 3]);
    await db.query('insert into submission_private(post_id,author_email,original_body,decline_note,is_sample) values($1,$2,$3,$4,$5)',
      [ids[i], i === 3 ? 'sample@example.test' : 'student@illinois.edu', original, 'Private reviewer note', i === 3]);
  }
  await db.exec(`
    insert into subscribers(email,confirmed_at,token) values
      ('confirmed@example.test',now(),repeat('c',64)), ('pending@example.test',null,repeat('p',64));
  `);
  for (const [index, count] of [[0, 3], [1, 8], [3, 1]]) {
    for (let n = 0; n < count; n++) {
      await db.query('insert into post_views(post_id,visitor_hash) values($1,$2)', [ids[index], String(n).padStart(64, '0')]);
    }
  }
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
  executed = [];
  failQueries = false;
  mocks.reviewer.mockReset().mockResolvedValue(admin);
  mocks.service.mockReset().mockImplementation(adapter);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(async () => { await db.exec('rollback; reset role'); vi.restoreAllMocks(); });
afterAll(async () => { await db.close(); });

describe('private admin statistics', () => {
  it('returns honest empty counts and an absent median before any submissions', async () => {
    expect(await getAdminStats()).toEqual({ published_count: 0, submission_count: 0, median_publish_hours: null, active_writer_count: 0, subscriber_count: 0, top_posts: [] });
  });

  it('counts real submissions, confirmed subscribers and active writers with a true publication median', async () => {
    await scenario();
    const stats = await getAdminStats();
    expect(stats).toMatchObject({ published_count: 2, submission_count: 3, median_publish_hours: 4, active_writer_count: 2, subscriber_count: 1 });
    expect(stats.top_posts).toEqual([
      { id: ids[0], slug: 'story-1', headline: 'Story 1', views: 3 },
      { id: ids[3], slug: 'story-4', headline: 'Story 4', views: 1 },
    ]);
    expect(JSON.stringify(stats)).not.toContain('student@illinois.edu');
    expect(JSON.stringify(stats)).not.toContain(original);
  });

  it('caps the ranked view list at ten published pieces', async () => {
    await scenario();
    await db.exec(`
      insert into posts(status,slug,author_name,headline,short_version,final_body,byline,topic_id,writer_id,published_at)
      select 'published','extra-'||n,'Student','Extra '||n,'Short.','Body.','Student',
        '10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',now()
      from generate_series(1,11) n
    `);
    const stats = await getAdminStats();
    expect(stats.published_count).toBe(13);
    expect(stats.top_posts).toHaveLength(10);
    expect(stats.top_posts[0]).toMatchObject({ id: ids[0], views: 3 });
    expect(stats.top_posts[1]).toMatchObject({ id: ids[3], views: 1 });
    expect(stats.top_posts.every(post => post.id !== ids[1] && post.id !== ids[2])).toBe(true);
  });

  it('rejects non-admin application access and denies the RPC to both browser roles', async () => {
    for (const actor of [null, { ...admin, isAdmin: false }]) {
      mocks.reviewer.mockResolvedValue(actor);
      await expect(getAdminStats()).rejects.toThrow('Admin access');
    }
    expect(mocks.service).not.toHaveBeenCalled();
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`savepoint permission_check; set local role ${role}`);
      await expect(db.query('select public.get_admin_stats()')).rejects.toThrow('permission denied');
      await db.exec('rollback to savepoint permission_check; reset role');
    }
    await scenario();
    await db.exec('set local role service_role');
    const allowed = await db.query<{ result: AdminStats }>('select public.get_admin_stats() as result');
    expect(allowed.rows[0].result.submission_count).toBe(3);
    await db.exec('reset role');
  });
});

describe('admin CSV downloads', () => {
  it('denies readers and ordinary reviewers before touching export data', async () => {
    for (const actor of [null, { ...admin, isAdmin: false }]) {
      mocks.reviewer.mockResolvedValue(actor);
      const response = await exportCsv(request('submissions'));
      expect(response.status).toBe(403);
      expect(response.headers.get('cache-control')).toBe('private, no-store');
      expect(await response.json()).toEqual({ error: 'Admin access is required.' });
    }
    expect(mocks.service).not.toHaveBeenCalled();
  });

  it('exports only published public fields with private attachment headers', async () => {
    await scenario();
    const response = await exportCsv(request());
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/csv; charset=utf-8');
    expect(response.headers.get('content-disposition')).toBe('attachment; filename="illinois-abundance-published.csv"');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('vary')).toBe('Cookie');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    const csv = await response.text();
    expect(csv).toContain('"final_body"');
    expect(csv).toContain('"sources"');
    expect(csv).toContain('"Story 1"');
    expect(csv).toContain('"Story 4"');
    for (const secret of ['Story 2', 'Story 3', 'author_email', 'original_body', 'claimed_by', 'decline_note', 'student@illinois.edu', 'Private reviewer note', 'Original private draft']) {
      expect(csv).not.toContain(secret);
    }
  });

  it('exports originals and private review fields only in the authorized submissions download', async () => {
    await scenario();
    const response = await exportCsv(request('submissions'));
    const csv = await response.text();
    expect(response.headers.get('content-disposition')).toContain('illinois-abundance-submissions.csv');
    for (const column of ['status', 'author_email', 'original_body', 'claimed_by', 'claimed_at', 'decline_note']) expect(csv).toContain(`"${column}"`);
    expect(csv).toContain('"student@illinois.edu"');
    expect(csv).toContain('"Original private draft, with ""quotes"".\nKeep this exact."');
    expect(csv).toContain('"Private reviewer note"');
    expect(csv).toContain('"Story 2"');
    expect(csv).toContain('"Story 3"');
  });

  it('neutralizes formulas including leading whitespace and preserves CSV quoting', async () => {
    await scenario();
    await db.query('update posts set headline=$1 where id=$2', ['  =HYPERLINK("https://evil.example")', ids[0]]);
    const csv = await (await exportCsv(request())).text();
    expect(csv).toContain('"\'  =HYPERLINK(""https://evil.example"")"');
    for (const value of ['=1+1', '+SUM(1)', '-1+1', '@SUM(1)', '\t=1', '\r=1', '\n=1', ' \t=1', '\uFEFF=1']) {
      expect(csvCell(value).startsWith('"\'')).toBe(true);
    }
    expect(csvCell('A "quoted", normal title')).toBe('"A ""quoted"", normal title"');
  });

  it('streams all rows in bounded batches using a stable keyset cursor', async () => {
    await db.exec("insert into posts(author_name,headline) select 'Writer', 'Piece '||n from generate_series(1,501) n");
    const csv = await (await exportCsv(request('submissions'))).text();
    expect(csv.trim().split('\r\n')).toHaveLength(502);
    const postQueries = executed.filter(query => query.text.includes('FROM "public"."posts"'));
    expect(postQueries).toHaveLength(3);
    expect(postQueries.every(query => query.values.at(-1) === 250)).toBe(true);
    expect(postQueries.slice(1).every(query => query.text.includes('"id" > $1'))).toBe(true);
    expect(postQueries.every(query => !query.text.includes('OFFSET'))).toBe(true);
  });

  it('validates the export kind and hides initial provider errors', async () => {
    expect((await exportCsv(request('subscribers'))).status).toBe(400);
    expect(mocks.service).not.toHaveBeenCalled();
    failQueries = true;
    const response = await exportCsv(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('student@illinois.edu');
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('student@illinois.edu');
  });

  it('aborts a failed later batch without writing provider details into a partial CSV', async () => {
    await db.exec("insert into posts(author_name,headline) select 'Writer', 'Piece '||n from generate_series(1,251) n");
    const response = await exportCsv(request('submissions'));
    failQueries = true;
    await expect(response.text()).rejects.toThrow('export was interrupted');
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('student@illinois.edu');
  });
});
