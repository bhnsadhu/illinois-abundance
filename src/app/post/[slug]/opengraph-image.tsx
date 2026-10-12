import { getStory } from '@/lib/data';
import { shareContent } from '@/lib/share-content';
import { createShareImage } from '@/lib/share-image';

export const runtime = 'nodejs';
export const revalidate = 60;
export const alt = 'Student writing from Illinois Abundance';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const story = await getStory((await params).slug);
  if (!story) return new Response('Story not found.', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  return createShareImage(shareContent(story), 'opengraph');
}
