import { readImageUpload } from '@/lib/image-upload';
import { randomUUID } from 'node:crypto';
import { apiFailure, guardRateLimit, HttpError, privateJson, requireOrigin } from '@/lib/api';
import { isAdminEmail } from '@/lib/admin-access';
import { getReviewer } from '@/lib/auth';
import { put } from '@vercel/blob';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    requireOrigin(request);
    const reviewer = await getReviewer();
    if (!reviewer) throw new HttpError('Sign in as an admin to upload images.', 401);
    if (!reviewer.isAdmin || !isAdminEmail(reviewer.email)) throw new HttpError('Only an admin can upload site images.', 403);
    await guardRateLimit('site-image-upload', reviewer.id, 40, 3600);
    const {output,alt}=await readImageUpload(request);
    const fileName = `${randomUUID()}.webp`;
    await put(`media/${fileName}`, output, { access: 'private', contentType: 'image/webp', addRandomSuffix: false });
    return privateJson({ url: `/media/${fileName}`, alt });
  } catch (error) { return apiFailure(error); }
}
