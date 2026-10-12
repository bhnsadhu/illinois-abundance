import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { z } from 'zod';
import { getReviewer, requireAdmin } from './auth';
import { apiFailure, guardRateLimit, HttpError, privateJson, readJson, requireOrigin } from './api';
import { site } from './config';
import { serviceDatabase } from './database/service';
import { sendMail } from './email';
import { escapeHtml, formatDate } from './format';
import { privateHash, safeEqual } from './security';
import { unsubscribeUrl } from './subscriptions';

export type DigestPost = { id: string; slug: string; headline: string; short_version: string; published_at: string };
export type DigestEvent = { id: string; title: string; description: string; starts_at: string; location: string; rsvp_url: string | null };
export type DigestSnapshot = { posts: DigestPost[]; event: DigestEvent | null };
export type DigestProgress = {
  id: string; status: 'sending' | 'sent' | 'failed'; recipient_count: number; sent_count: number; failed_count: number;
  skipped_count: number; uncertain_count: number; pending_count: number; created_at: string; sent_at: string | null; lease_until: string | null;
};
export type DigestPreview = DigestSnapshot & {
  window_start: string; window_end: string; preview_token: string; subscriber_count: number; can_send: boolean; latest: DigestProgress | null;
};
type DigestRow = Omit<DigestProgress, 'pending_count'> & { window_start: string; window_end: string; content_hash: string; snapshot: DigestSnapshot };
const progressFields = 'id,status,recipient_count,sent_count,failed_count,skipped_count,uncertain_count,created_at,sent_at,lease_until';
const digestFields = `${progressFields},window_start,window_end,content_hash,snapshot`;
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const snapshotHash = (snapshot: DigestSnapshot) => sha256(JSON.stringify(snapshot));
const signedPreviewSchema = z.object({ from: z.iso.datetime(), to: z.iso.datetime(), hash: z.string().regex(/^[a-f0-9]{64}$/), expires: z.number().int().positive() }).strict();
const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('start'), preview_token: z.string().max(1500) }).strict(),
  z.object({ action: z.literal('continue'), digest_id: z.uuid() }).strict(),
]);

function progress(row: Omit<DigestProgress, 'pending_count'>): DigestProgress {
  return { id: row.id, status: row.status, recipient_count: row.recipient_count, sent_count: row.sent_count,
    failed_count: row.failed_count, skipped_count: row.skipped_count, uncertain_count: row.uncertain_count,
    pending_count: Math.max(0, row.recipient_count - row.sent_count - row.failed_count - row.skipped_count - row.uncertain_count),
    created_at: row.created_at, sent_at: row.sent_at, lease_until: row.lease_until };
}
async function loadSnapshot(from: string, to: string): Promise<DigestSnapshot> {
  const db = serviceDatabase();
  const [posts, events] = await Promise.all([
    db.from<DigestPost>('public_posts').select('id,slug,headline,short_version,published_at').gte('published_at', from).lte('published_at', to).order('published_at', { ascending: false }).order('id').limit(501),
    db.from<DigestEvent>('public_events').select('id,title,description,starts_at,location,rsvp_url').gte('starts_at', to).order('starts_at').order('id').limit(1),
  ]);
  if (posts.error || events.error) throw new HttpError('We could not load the digest preview. Please try again.', 503);
  if ((posts.data?.length ?? 0) > 500) throw new HttpError('There are too many pieces for one digest. Please contact the site maintainer.', 400);
  return { posts: posts.data ?? [], event: events.data?.[0] ?? null };
}

export async function getDigestPreview(): Promise<DigestPreview> {
  await requireAdmin();
  const end = new Date();
  const from = new Date(end.getTime() - 7 * 86400000).toISOString();
  const to = end.toISOString();
  const db = serviceDatabase();
  const [snapshot, subscribers, latest] = await Promise.all([
    loadSnapshot(from, to),
    db.from('subscribers').select('email', { head: true, count: 'exact' }).gt('confirmed_at', '1970-01-01T00:00:00Z'),
    db.from<Omit<DigestProgress, 'pending_count'>>('digest_log').select(progressFields).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (subscribers.error || latest.error) throw new HttpError('We could not load the digest preview. Please try again.', 503);
  const payload = Buffer.from(JSON.stringify({ from, to, hash: snapshotHash(snapshot), expires: Date.now() + 30 * 60000 })).toString('base64url');
  return { ...snapshot, window_start: from, window_end: to,
    preview_token: `${payload}.${privateHash(`digest-preview:${payload}`)}`,
    subscriber_count: subscribers.count ?? 0, can_send: Boolean((snapshot.posts.length || snapshot.event) && subscribers.count),
    latest: latest.data ? progress(latest.data) : null };
}

function parsePreview(token: string) {
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra || !safeEqual(signature, privateHash(`digest-preview:${payload}`))) throw new HttpError('Refresh the preview before sending.', 409);
  try {
    const value = signedPreviewSchema.parse(JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')));
    if (value.expires <= Date.now()) throw new Error('Expired');
    return value;
  } catch { throw new HttpError('This preview has expired. Refresh it before sending.', 409); }
}

async function getDigest(id: string): Promise<DigestRow> {
  const { data, error } = await serviceDatabase().from<DigestRow>('digest_log').select(digestFields).eq('id', id).maybeSingle();
  if (error) throw new HttpError('We could not load that digest. Please try again.', 503);
  if (!data?.snapshot) throw new HttpError('That digest could not be found.', 404);
  return data;
}

function digestMail(snapshot: DigestSnapshot) {
  const postsHtml = snapshot.posts.map(post => `<article style="margin:28px 0"><h2 style="font-size:24px;line-height:1.2;margin-bottom:10px"><a href="${escapeHtml(new URL(`/post/${post.slug}`, site.url).href)}" style="color:#315c59">${escapeHtml(post.headline)}</a></h2><p>${escapeHtml(post.short_version)}</p></article>`).join('');
  const event = snapshot.event;
  const eventHtml = event ? `<section style="margin-top:32px;padding-top:24px;border-top:1px solid #dedac4"><h2 style="font-size:24px;line-height:1.2">Next teach in: ${escapeHtml(event.title)}</h2><p>${escapeHtml(formatDate(event.starts_at, { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }))} · ${escapeHtml(event.location)}</p><p>${escapeHtml(event.description)}</p><p><a href="${escapeHtml(new URL('/events', site.url).href)}" style="color:#315c59">See the details</a></p></section>` : '';
  return {
    html: `<h1 style="font-size:32px;line-height:1.15">A little more possibility.</h1><p>Here is what is new at Illinois Abundance.</p>${postsHtml}${eventHtml}`,
    text: `A little more possibility.\n\n${snapshot.posts.map(post => `${post.headline}\n${post.short_version}\n${new URL(`/post/${post.slug}`, site.url).href}`).join('\n\n')}${event ? `\n\nNext teach in: ${event.title}\n${formatDate(event.starts_at, { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · ${event.location}\n${event.description}\n${new URL('/events', site.url).href}` : ''}`,
  };
}

async function sendBatch(digest: DigestRow): Promise<DigestProgress> {
  if (digest.status === 'sent') return progress(digest);
  // Removed or edited content must be reviewed again before any unsent batch.
  if (snapshotHash(await loadSnapshot(digest.window_start, digest.window_end)) !== digest.content_hash) {
    throw new HttpError('The published content in this digest has changed. Refresh the preview and start a new digest.', 409);
  }
  const db = serviceDatabase();
  const worker = randomUUID();
  const claim = await db.rpc<{ status: string; recipients?: { email: string; token: string }[] }>('claim_digest_batch', { p_id: digest.id, p_worker: worker, p_limit: 8 });
  if (claim.error || !claim.data) throw new HttpError('We could not start this batch. Please try again.', 503);
  if (claim.data.status === 'busy') throw new HttpError('Another batch is still sending. Wait a moment, then continue.', 409);
  if (claim.data.status === 'complete') return progress(await getDigest(digest.id));
  if (claim.data.status !== 'ready') throw new HttpError('That digest could not be found.', 404);
  const started = Date.now();
  const mail = digestMail(digest.snapshot);
  try {
    for (const recipient of claim.data.recipients ?? []) {
      if (Date.now() - started > 40000) break;
      const subscribed = await db.from('subscribers').select('email').eq('email', recipient.email).eq('token', recipient.token).gt('confirmed_at', '1970-01-01T00:00:00Z').maybeSingle();
      if (subscribed.error) throw new HttpError('This batch paused while checking subscriptions. Continue to try again.', 503);
      let deliveryStatus: 'sent' | 'failed' | 'skipped' = 'skipped';
      let providerId: string | null = null;
      if (subscribed.data) {
        try {
          providerId = await sendMail({ to: recipient.email, subject: 'This week at Illinois Abundance', ...mail,
            unsubscribeUrl: unsubscribeUrl(recipient.token), idempotencyKey: `digest/${digest.id}/${sha256(recipient.email)}` });
          deliveryStatus = 'sent';
        } catch { deliveryStatus = 'failed'; }
      }
      const saved = await db.rpc<boolean>('finish_digest_delivery', { p_id: digest.id, p_worker: worker, p_email: recipient.email, p_status: deliveryStatus, p_provider_id: providerId });
      if (saved.error || !saved.data) throw new HttpError('Delivery progress could not be saved. Continue this digest to check it safely.', 503);
      // A provider outage should pause the batch, preserving the rest for retry.
      if (deliveryStatus === 'failed') break;
      if (deliveryStatus === 'sent') await delay(600);
    }
  } finally {
    const released = await db.rpc('release_digest_batch', { p_id: digest.id, p_worker: worker });
    if (released.error) throw new HttpError('This batch is paused. Wait two minutes, then continue safely.', 503);
  }
  return progress(await getDigest(digest.id));
}

export async function sendDigest(request: Request) {
  try {
    requireOrigin(request);
    const reviewer = await getReviewer();
    if (!reviewer) throw new HttpError('Sign in as the site admin to send a digest.', 401);
    if (!reviewer.isAdmin || reviewer.email !== process.env.ADMIN_EMAIL?.trim().toLowerCase()) throw new HttpError('Only the site admin can send a digest.', 403);
    const action = actionSchema.parse(await readJson(request, 4096));
    if (!process.env.RESEND_API_KEY || !process.env.MAIL_FROM) throw new HttpError('Email is not connected yet. Please try again soon.', 503);
    await guardRateLimit('digest-send', reviewer.id, 120, 300);
    let id: string;
    if (action.action === 'start') {
      const preview = parsePreview(action.preview_token);
      const snapshot = await loadSnapshot(preview.from, preview.to);
      if (snapshotHash(snapshot) !== preview.hash) throw new HttpError('The preview has changed. Refresh it before sending.', 409);
      if (!snapshot.posts.length && !snapshot.event) throw new HttpError('There is nothing new to send yet. Publish a piece or add the next teach in.');
      const started = await serviceDatabase().rpc<string>('start_digest', { p_window_start: preview.from, p_window_end: preview.to, p_content_hash: preview.hash, p_snapshot: snapshot });
      if (started.error || !started.data) throw new HttpError('We could not prepare this digest. Please try again.', 503);
      id = started.data;
    } else id = action.digest_id;
    return privateJson({ ok: true, digest: await sendBatch(await getDigest(id)) });
  } catch (error) { return apiFailure(error); }
}
