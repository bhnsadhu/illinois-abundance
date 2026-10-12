import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import { apiFailure, HttpError, privateJson, readJson, requireOrigin } from '@/lib/api';
import { getReviewer } from '@/lib/auth';
import { slugify } from '@/lib/format';
import { serviceDatabase } from '@/lib/database/service';
import { postEditSchema, sourceSchema } from '@/lib/validation';

const mutation = z.object({
  action: z.enum(['claim', 'release', 'save', 'publish', 'decline', 'unpublish']),
  version: z.number().int().positive().max(2147483647),
  changes: z.record(z.string(), z.unknown()).optional().default({}),
}).strict();
const draft = z.object({
  headline: z.string().trim().max(200).optional(), short_version: z.string().trim().max(600).optional(),
  final_body: z.string().max(30000).optional(), byline: z.string().trim().max(160).optional(),
  topic_id: z.uuid().nullable().optional(), writer_id: z.uuid().nullable().optional(),
  sources: z.array(sourceSchema).max(30).optional(),
  cover_url: z.string().regex(/^\/covers\/[0-9a-f-]{36}\.(jpg|png|webp|avif)$/).nullable().optional(),
  cover_alt: z.string().trim().max(300).nullable().optional(),
}).refine(value => !value.cover_url || Boolean(value.cover_alt), 'Add alt text for your cover image.');

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireOrigin(request);
    const reviewer = await getReviewer();
    if (!reviewer) throw new HttpError('Sign in as a reviewer to continue.', 401);
    const id = z.uuid().parse((await context.params).id);
    const input = mutation.parse(await readJson(request));
    const db = serviceDatabase();
    const { data: current, error: readError } = await db.from<{slug:string|null;status:string}>('posts').select('slug,status').eq('id', id).maybeSingle();
    if (readError) throw new HttpError('We could not load that submission. Please try again.', 503);
    if (!current) throw new HttpError('That submission could not be found.', 404);
    let changes: Record<string, unknown> = {};
    if (input.action === 'publish' || input.action === 'save') {
      changes = input.action === 'publish' || current.status === 'published'
        ? postEditSchema.parse(input.changes) : draft.parse(input.changes);
    } else if (input.action === 'decline') {
      changes = z.object({ decline_note: z.string().trim().max(4000).optional() }).parse(input.changes);
    }
    const slug = current.slug || (input.action === 'publish' ? `${slugify(String(changes.headline))}-${id.slice(0, 8)}` : null);
    if (input.action === 'publish') changes.slug = slug;
    const { data, error } = await db.rpc<{status:string;version?:number}>('review_post', {
      p_id: id, p_expected_version: input.version, p_actor_id: reviewer.id, p_action: input.action, p_changes: changes,
    });
    if (error) {
      if (error.code === '23514') throw new HttpError('Complete the headline, short version, story, byline, and active topic before publishing.', 400);
      if (error.code === '23505') throw new HttpError('That story link is already in use. Refresh and try a different headline.', 409);
      throw new HttpError('We could not save that change. Please try again.', 503);
    }
    if (data?.status === 'conflict') throw new HttpError('Another reviewer changed this piece. Refresh to see their changes before saving again.', 409);
    if (data?.status === 'forbidden') throw new HttpError('Your reviewer access has changed. Sign in again.', 403);
    if (data?.status === 'missing') throw new HttpError('That submission could not be found.', 404);
    if (data?.status !== 'ok') throw new HttpError('We could not save that change. Please try again.', 503);
    if (['publish', 'save', 'unpublish', 'decline'].includes(input.action)) {
      revalidateTag('public-content', { expire: 0 });
      for (const path of ['/', '/latest', '/rss.xml', '/sitemap.xml']) revalidatePath(path);
      if (slug) revalidatePath(`/post/${slug}`);
      revalidatePath('/topic/[slug]', 'page');
      revalidatePath('/writer/[slug]', 'page');
    }
    const status = input.action === 'publish' ? 'published' : input.action === 'decline' ? 'declined'
      : input.action === 'unpublish' ? 'unpublished' : input.action === 'claim' && current.status === 'new' ? 'in_progress' : current.status;
    return privateJson({ ok: true, version: data.version, slug, status });
  } catch (error) { return apiFailure(error); }
}
