import { createShareImage } from '@/lib/share-image';

export const runtime = 'nodejs';
export const alt = 'Illinois Abundance. A little more possibility.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpenGraphImage() {
  return createShareImage({ headline: 'A little more possibility.', author: 'Student writing on local policy in Champaign Urbana.', topic: 'Local questions. Real possibilities.', topicSlug: 'housing', isSample: false, isSite: true });
}
