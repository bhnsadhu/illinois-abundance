import { readImageUpload } from '@/lib/image-upload';
import { randomUUID } from 'node:crypto';
import { apiFailure, guardRateLimit, HttpError, privateJson, requireOrigin } from '@/lib/api';
import { getReviewer } from '@/lib/auth';
import { put } from '@vercel/blob';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    requireOrigin(request);
    const reviewer = await getReviewer();
    if (!reviewer) throw new HttpError('Sign in as a reviewer to add a cover.', 401);
    await guardRateLimit('cover-upload', reviewer.id, 40, 3600);
    const {output,alt}=await readImageUpload(request);
    const fileName = `${randomUUID()}.webp`;
    await put(`covers/${fileName}`, output, { access: 'private', contentType: 'image/webp', addRandomSuffix: false });
    return privateJson({ url: `/covers/${fileName}`, alt });
  } catch (error) { return apiFailure(error); }
}
