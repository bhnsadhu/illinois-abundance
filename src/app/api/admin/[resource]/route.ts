import { revalidatePath, revalidateTag } from 'next/cache';
import { getReviewer } from '@/lib/auth';
import { adminMutationSchema, adminResourceSchema, adminTables, parseAdminValues, subscriberRemovalSchema } from '@/lib/admin-schema';
import { apiFailure, guardRateLimit, HttpError, privateJson, readJson, requireOrigin } from '@/lib/api';
import { serviceDatabase } from '@/lib/database/service';
import type { DatabaseError } from '@/lib/database/client';
import { hashPassword } from '@/lib/passwords';

function databaseFailure(error: DatabaseError | null) {
  if (!error) return;
  if (error.code === '23503' || error.code === '23001') throw new HttpError('Other content still uses this record, or a linked record is missing. Update the links first.', 409);
  if (error.code === '23505') throw new HttpError('That email or link is already in use. Choose another one.', 409);
  if (error.code === '23514') throw new HttpError('That change would break a content rule. Check the fields and try again.', 400);
  throw new HttpError('We could not save that change. Please try again.', 503);
}

function expirePublicContent() {
  revalidateTag('public-content', { expire: 0 });
  for (const path of ['/', '/latest', '/events', '/learn', '/show-up', '/sitemap.xml', '/rss.xml']) revalidatePath(path);
  for (const path of ['/post/[slug]', '/topic/[slug]', '/writer/[slug]', '/learn/[slug]']) revalidatePath(path, 'page');
}

export async function POST(request: Request, context: { params: Promise<{ resource: string }> }) {
  try {
    requireOrigin(request);
    const reviewer = await getReviewer();
    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    if (!reviewer) throw new HttpError('Sign in as the site admin to continue.', 401);
    if (!reviewer.isAdmin || !adminEmail || reviewer.email !== adminEmail) throw new HttpError('Only the site admin can make this change.', 403);
    const resource = adminResourceSchema.safeParse((await context.params).resource);
    if (!resource.success) throw new HttpError('That admin section could not be found.', 404);
    const input = adminMutationSchema.parse(await readJson(request, 160000));
    await guardRateLimit('admin-mutation', reviewer.id, 120, 300);
    const db = serviceDatabase();

    if (resource.data === 'samples') {
      if (input.action !== 'delete' || input.id || Object.keys(input.values).length) throw new HttpError('Use the sample removal action to clear sample content.');
      const { error } = await db.rpc('delete_sample_content');
      databaseFailure(error);
      expirePublicContent();
      return privateJson({ ok: true });
    }
    if (resource.data === 'subscribers') {
      if (input.action !== 'delete' || input.id) throw new HttpError('Subscribers can only be removed here. They must confirm their own subscriptions.');
      const { email } = subscriberRemovalSchema.parse(input.values);
      const { error } = await db.from('subscribers').delete().eq('email', email);
      databaseFailure(error);
      return privateJson({ ok: true });
    }

    const table = adminTables[resource.data];
    if (input.action === 'delete' && (!input.id || Object.keys(input.values).length)) throw new HttpError('Choose the record to remove.');
    const values = input.action === 'save' ? parseAdminValues(resource.data, input.values, Boolean(input.id)) : null;
    if (resource.data === 'reviewers') {
      if (values?.email === adminEmail && values.is_active !== true) throw new HttpError('The configured site admin must remain active.');
      let existingEmail: string | undefined;
      if (input.id) {
        const existing = await db.from<{ email: string }>('reviewers').select('email').eq('id', input.id).maybeSingle();
        databaseFailure(existing.error);
        if (!existing.data) throw new HttpError('That reviewer could not be found.', 404);
        existingEmail = existing.data.email;
        if (existing.data.email === adminEmail && (input.action === 'delete' || values?.email !== adminEmail || values.is_active !== true)) {
          throw new HttpError('The configured site admin cannot be removed or reassigned.');
        }
      }
      if (values?.email === adminEmail && existingEmail !== adminEmail) throw new HttpError('The admin identity cannot be assigned to a reviewer.');
      if (values) {
        const password = values.password;
        delete values.password;
        if (password) {
          if (existingEmail === adminEmail) throw new HttpError('Use Change password to update your own admin password.');
          values.password_hash = await hashPassword(String(password));
        }
      }
    }
    if (resource.data === 'learn' && values) values.updated_at = new Date().toISOString();
    const query = db.from<{ id: string }>(table);
    const mutation = input.action === 'delete' ? query.delete().eq('id', input.id!)
      : input.id ? query.update(values).eq('id', input.id) : query.insert(values);
    const { data, error } = await mutation.select('id').maybeSingle();
    databaseFailure(error);
    if (!data) throw new HttpError('That record could not be found. Refresh and try again.', 404);
    if (resource.data !== 'reviewers') expirePublicContent();
    return privateJson({ ok: true, id: data.id });
  } catch (error) { return apiFailure(error); }
}
