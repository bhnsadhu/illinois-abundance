import { getStory } from '@/lib/data';
import { shareContent } from '@/lib/share-content';
import { createShareImage } from '@/lib/share-image';

export const runtime = 'nodejs';
export const revalidate = 60;

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const story = await getStory((await params).slug);
  if (!story) return new Response('Story not found.', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  const filename = story.slug.replace(/[^a-z0-9-]/gi, '').slice(0, 160) || 'illinois-abundance';
  return createShareImage(shareContent(story), 'instagram', { 'Content-Disposition': `attachment; filename="${filename}.png"` });
}
