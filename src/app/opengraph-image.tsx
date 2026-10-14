import { createShareImage } from '@/lib/share-image';
import { getSiteContent } from '@/lib/site-content';

export const runtime = 'nodejs';
export const alt = 'Illinois Abundance. A little more possibility.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpenGraphImage() {
  const { branding } = await getSiteContent();
  return createShareImage({ headline: branding.shareTitle, author: branding.shareDescription, topic: branding.name, topicSlug: 'housing', isSample: false, isSite: true });
}
