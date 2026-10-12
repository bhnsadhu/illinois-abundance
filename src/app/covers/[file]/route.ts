import { getReviewer } from '@/lib/auth';
import { publicDatabase } from '@/lib/database/public';
import { get } from '@vercel/blob';

export const runtime = 'nodejs';
export async function GET(_request: Request, context: { params: Promise<{ file: string }> }) {
  const { file } = await context.params;
  const notFound = () => new Response('Not found', { status: 404, headers: { 'Cache-Control': 'private, no-store' } });
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|png|jpg|avif)$/.test(file)) return notFound();
  try {
    const publicDb = publicDatabase();
    const result = publicDb ? await publicDb.from('public_posts').select('id').eq('cover_url', `/covers/${file}`).limit(1) : null;
    const published = Boolean(!result?.error && result?.data?.length);
    if (!published && !await getReviewer()) return notFound();
    const data = await get(`covers/${file}`, { access: 'private' });
    if (!data || data.statusCode !== 200) return notFound();
    return new Response(data.stream, { headers: {
      'Content-Type': file.endsWith('.jpg') ? 'image/jpeg' : `image/${file.split('.').at(-1)}`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': published ? 'public, max-age=60, s-maxage=60' : 'private, no-store',
    } });
  } catch { return notFound(); }
}
