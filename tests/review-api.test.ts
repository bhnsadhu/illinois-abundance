import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import sharp from 'sharp';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as mutate } from '@/app/api/review/[id]/route';
import { POST as upload } from '@/app/api/covers/route';
import { GET as cover } from '@/app/covers/[file]/route';
import { site } from '@/lib/config';

const mocks = vi.hoisted(() => ({ reviewer: vi.fn(), revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getReviewer: mocks.reviewer }));
vi.mock('next/cache', () => ({ revalidateTag: mocks.revalidateTag, revalidatePath: mocks.revalidatePath }));
vi.mock('@/lib/database/service', () => ({ serviceDatabase: () => databaseAdapter() }));
vi.mock('@/lib/database/public', () => ({ publicDatabase: () => publicAdapter() }));
vi.mock('@vercel/blob', () => ({
  put: async (path: string, bytes: Buffer, options: {access:string}) => {
    if(options.access !== 'private') throw new Error('Covers must stay private');
    storage.set(path.replace('covers/',''), bytes); return {pathname:path};
  },
  get: async (path: string, options: {access:string}) => {
    if(options.access !== 'private') throw new Error('Covers must stay private');
    const file=path.replace('covers/','');downloaded.push(file);const bytes=storage.get(file);
    return bytes?{statusCode:200,stream:new Blob([new Uint8Array(bytes)]).stream()}:null;
  },
}));

const actorId = '70000000-0000-4000-8000-000000000001';
const postId = '30000000-0000-4000-8000-000000000001';
const topicId = '10000000-0000-4000-8000-000000000001';
const reviewer = { id: actorId, email: 'reviewer@illinois.edu', name: 'Reviewer', isAdmin: false };
const context = { params: Promise.resolve({ id: postId }) };
const publish = { headline: 'A better campus', short_version: 'More homes. More room to learn.', final_body: 'CHAMPAIGN, Ill. More homes close to campus mean more room for neighbors.', byline: 'Student Writer', topic_id: topicId, sources: [] };
let db: PGlite;
let storage: Map<string, Buffer>;
let downloaded: string[];
let mutationCalls: Record<string, unknown>[];

function databaseAdapter() {
  return {
    async rpc(name: string, args: Record<string, unknown>) {
      if (name === 'review_post') mutationCalls.push(args);
      try {
        const pairs = Object.entries(args);
        const { rows } = await db.query<{ result: unknown }>(`select public.${name}(${pairs.map(([key], i) => `${key} => $${i + 1}`).join(',')}) as result`, pairs.map(([, value]) => value));
        return { data: rows[0].result, error: null };
      } catch (error) { return { data: null, error: { code: (error as { code: string }).code } }; }
    },
    from(table: string) {
      if (table !== 'posts') throw new Error('Unexpected test table');
      return { select: () => ({ eq: (_column: string, id: string) => ({
        async maybeSingle() { const { rows } = await db.query('select slug,status from posts where id=$1', [id]); return { data: rows[0] ?? null, error: null }; },
      }) }) };
    },

  };
}

function publicAdapter() {
  return { from: (table: string) => {
    if (table !== 'public_posts') throw new Error('Public reads must use the safe view');
    return { select: () => ({ eq: (_column: string, path: string) => ({ async limit() {
      const { rows } = await db.query('select id from public_posts where cover_url=$1 limit 1', [path]); return { data: rows, error: null };
    } }) }) };
  } };
}

function request(input: unknown, origin = new URL(site.url).origin) {
  return new Request(new URL(`/api/review/${postId}`, site.url), { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(input) });
}
function imageRequest(bytes: Uint8Array, type = 'image/png', alt = 'A teal roof beside a tree') {
  const form = new FormData();
  form.set('file', new File([new Uint8Array(bytes)], 'cover.png', { type }));
  form.set('alt', alt);
  return new Request(new URL('/api/covers', site.url), { method: 'POST', headers: { origin: new URL(site.url).origin }, body: form });
}

beforeAll(async () => {
  db = new PGlite();
  const directory = new URL('../db/migrations/', import.meta.url);
  for (const file of (await readdir(directory)).filter(file => file.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file, directory), 'utf8'));
  await db.exec(await readFile(new URL('../db/seed.sql', import.meta.url), 'utf8'));
}, 30000);

beforeEach(async () => {
  await db.exec('begin');
  await db.query("insert into reviewers(id,email,name) values($1,'reviewer@illinois.edu','Reviewer')", [actorId]);
  await db.query("insert into posts(id,author_name,byline,final_body) values($1,'Student Writer','Student Writer','The complete original submission from the student.')", [postId]);
  await db.query("insert into submission_private(post_id,author_email,original_body) values($1,'student@illinois.edu','The complete original submission from the student.')", [postId]);
  mocks.reviewer.mockReset().mockResolvedValue(reviewer);
  mocks.revalidateTag.mockReset(); mocks.revalidatePath.mockReset();
  storage = new Map(); downloaded = []; mutationCalls = [];
  vi.stubEnv('CODE_PEPPER', 'test-secret-pepper-longer-than-thirty-two-characters');
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(async () => { await db.exec('rollback; reset role'); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
afterAll(async () => { await db.close(); });

describe('review mutation HTTP endpoint', () => {
  it('rejects unauthenticated and cross-origin mutation attempts before any RPC', async () => {
    mocks.reviewer.mockResolvedValue(null);
    expect((await mutate(request({ action: 'claim', version: 1 }), context)).status).toBe(401);
    mocks.reviewer.mockResolvedValue(reviewer);
    expect((await mutate(request({ action: 'claim', version: 1 }, 'https://evil.example'), context)).status).toBe(403);
    expect(mutationCalls).toHaveLength(0);
  });

  it('claims and publishes with the verified actor, a stable slug, and immediate public cache expiry', async () => {
    expect((await mutate(request({ action: 'claim', version: 1 }), context)).status).toBe(200);
    const response = await mutate(request({ action: 'publish', version: 2, changes: publish }), context);
    expect(await response.json()).toEqual({ ok: true, version: 3, slug: 'a-better-campus-30000000', status: 'published' });
    expect(mutationCalls.every(call => call.p_actor_id === actorId)).toBe(true);
    expect((await db.query('select headline from public_posts')).rows).toEqual([{ headline: publish.headline }]);
    expect(mocks.revalidateTag).toHaveBeenCalledWith('public-content', { expire: 0 });
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/post/a-better-campus-30000000');
    const edited = await mutate(request({ action: 'save', version: 3, changes: { ...publish, headline: 'A new headline' } }), context);
    expect((await edited.json()).slug).toBe('a-better-campus-30000000');
    expect((await db.query('select original_body from submission_private')).rows[0]).toEqual({ original_body: 'The complete original submission from the student.' });
  });

  it('returns a useful conflict response and never overwrites a concurrent edit', async () => {
    await mutate(request({ action: 'claim', version: 1 }), context);
    const response = await mutate(request({ action: 'publish', version: 1, changes: publish }), context);
    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain('Another reviewer changed');
    expect((await db.query('select status,headline from posts')).rows[0]).toEqual({ status: 'in_progress', headline: '' });
  });

  it('requires a numeric revision and rejects source scripts, unsafe covers, and incomplete publishing', async () => {
    const invalidInputs = [
      { action: 'publish', version: null, changes: publish },
      { action: 'publish', version: 1, changes: { ...publish, sources: [{ label: 'Bad', url: 'javascript:alert(1)' }] } },
      { action: 'publish', version: 1, changes: { ...publish, cover_url: 'https://evil.example/draft.png', cover_alt: 'Cover' } },
      { action: 'publish', version: 1, changes: { ...publish, headline: '' } },
      { action: 'publish', version: 1, actor_id: actorId, changes: publish },
    ];
    for (const input of invalidInputs) expect((await mutate(request(input), context)).status).toBe(400);
    expect(mutationCalls).toHaveLength(0);
  });

  it('allows incomplete drafts, rejects revoked membership at the SQL boundary, and unpublishes cleanly', async () => {
    expect((await mutate(request({ action: 'save', version: 1, changes: { headline: '', topic_id: null } }), context)).status).toBe(200);
    await db.query('update reviewers set is_active=false where id=$1', [actorId]);
    expect((await mutate(request({ action: 'publish', version: 2, changes: publish }), context)).status).toBe(403);
    await db.query('update reviewers set is_active=true where id=$1', [actorId]);
    expect((await mutate(request({ action: 'publish', version: 2, changes: publish }), context)).status).toBe(200);
    expect((await mutate(request({ action: 'unpublish', version: 3 }), context)).status).toBe(200);
    expect((await db.query('select * from public_posts')).rows).toHaveLength(0);
  });
});

describe('private cover uploads and public delivery', () => {
  it('re-encodes valid pixels, removes metadata, bounds dimensions, and returns only a local opaque URL', async () => {
    const png = await sharp({ create: { width: 2000, height: 1400, channels: 3, background: '#98c6c3' } }).png().withMetadata({ exif: { IFD0: { Artist: 'Private image creator' } } }).toBuffer();
    const response = await upload(imageRequest(png));
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result).toMatchObject({ alt: 'A teal roof beside a tree' });
    expect(result.url).toMatch(/^\/covers\/[0-9a-f-]{36}\.webp$/);
    const metadata = await sharp([...storage.values()][0]).metadata();
    expect(metadata.format).toBe('webp'); expect(metadata.width).toBeLessThanOrEqual(1600); expect(metadata.exif).toBeUndefined();
  });

  it('rejects disguised SVG, missing alt text, oversized files, and unauthenticated uploads', async () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    expect((await upload(imageRequest(svg))).status).toBe(400);
    expect((await upload(imageRequest(svg, 'image/svg+xml'))).status).toBe(400);
    expect((await upload(imageRequest(svg, 'image/png', ''))).status).toBe(400);
    expect((await upload(imageRequest(new Uint8Array(5 * 1024 * 1024 + 1)))).status).toBe(413);
    mocks.reviewer.mockResolvedValue(null);
    expect((await upload(imageRequest(svg))).status).toBe(401);
    expect(storage.size).toBe(0);
  });

  it('never downloads an unpublished cover for an anonymous request, but supports private reviewer preview', async () => {
    const file = '60000000-0000-4000-8000-000000000001.webp';
    storage.set(file, Buffer.from('test-image'));
    await db.query('update posts set cover_url=$1,cover_alt=$2 where id=$3', [`/covers/${file}`, 'Cover image', postId]);
    mocks.reviewer.mockResolvedValue(null);
    const params = { params: Promise.resolve({ file }) };
    expect((await cover(new Request(new URL(`/covers/${file}`, site.url)), params)).status).toBe(404);
    expect(downloaded).toHaveLength(0);
    mocks.reviewer.mockResolvedValue(reviewer);
    const preview = await cover(new Request(new URL(`/covers/${file}`, site.url)), params);
    expect(preview.status).toBe(200); expect(preview.headers.get('cache-control')).toBe('private, no-store');
    await mutate(request({ action: 'publish', version: 1, changes: { ...publish, cover_url: `/covers/${file}`, cover_alt: 'Cover image' } }), context);
    mocks.reviewer.mockResolvedValue(null);
    const published = await cover(new Request(new URL(`/covers/${file}`, site.url)), params);
    expect(published.status).toBe(200); expect(published.headers.get('cache-control')).toContain('public, max-age=60');
    mocks.reviewer.mockResolvedValue(reviewer);
    await mutate(request({ action: 'unpublish', version: 2 }), context);
    mocks.reviewer.mockResolvedValue(null);
    expect((await cover(new Request(new URL(`/covers/${file}`, site.url)), params)).status).toBe(404);
  });

  it('rejects unsafe file paths before touching storage', async () => {
    for (const file of ['../secret', 'draft.svg', 'not-a-uuid.webp']) {
      expect((await cover(new Request(site.url), { params: Promise.resolve({ file }) })).status).toBe(404);
    }
    expect(downloaded).toHaveLength(0);
  });
});
