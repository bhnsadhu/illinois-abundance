import { getAllStories } from '@/lib/data';
import { site } from '@/lib/config';
import { storyFeed } from '@/lib/syndication';
export const revalidate=60;
export async function GET() {
  return new Response(storyFeed(await getAllStories(),site.url),{headers:{'Content-Type':'application/rss+xml; charset=utf-8','Cache-Control':'public, max-age=60, s-maxage=60','X-Content-Type-Options':'nosniff'}});
}
