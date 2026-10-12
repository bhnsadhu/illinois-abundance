import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { apiFailure, guardRateLimit, HttpError, privateJson, requireOrigin } from '@/lib/api';
import { getReviewer } from '@/lib/auth';
import { put } from '@vercel/blob';

export const runtime = 'nodejs';
const fileLimit = 5 * 1024 * 1024;
const requestLimit = fileLimit + 32 * 1024;

async function boundedForm(request: Request) {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.startsWith('multipart/form-data;')) throw new HttpError('Choose an image and add its alt text.');
  if (Number(request.headers.get('content-length') || 0) > requestLimit) throw new HttpError('Keep your cover image under 5 MB.', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError('Choose an image.');
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > requestLimit) { await reader.cancel(); throw new HttpError('Keep your cover image under 5 MB.', 413); }
    chunks.push(value);
  }
  try { return await new Response(Buffer.concat(chunks), { headers: { 'content-type': contentType } }).formData(); }
  catch { throw new HttpError('We could not read that image. Choose it again.'); }
}

export async function POST(request: Request) {
  try {
    requireOrigin(request);
    const reviewer = await getReviewer();
    if (!reviewer) throw new HttpError('Sign in as a reviewer to add a cover.', 401);
    await guardRateLimit('cover-upload', reviewer.id, 40, 3600);
    const form = await boundedForm(request);
    const file = form.get('file');
    const altValue = form.get('alt');
    const alt = typeof altValue === 'string' ? altValue.trim() : '';
    if (!alt || alt.length > 300) throw new HttpError('Describe the cover image in 300 characters or fewer.');
    if (!(file instanceof File) || file.size === 0) throw new HttpError('Choose an image.');
    if (file.size > fileLimit) throw new HttpError('Keep your cover image under 5 MB.', 413);
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type)) throw new HttpError('Choose a JPG, PNG, WebP, or AVIF image.');
    let output: Buffer;
    try {
      const input = Buffer.from(await file.arrayBuffer());
      const image = sharp(input, { failOn: 'error', limitInputPixels: 40_000_000, animated: false });
      const metadata = await image.metadata();
      if (!['jpeg', 'png', 'webp', 'heif'].includes(metadata.format || '') || (metadata.pages ?? 1) > 1) throw new Error('Unsupported image');
      // Decode and re-encode the pixels; SVG, disguised payloads, and metadata
      // never pass through to the public URL. Sharp strips EXIF by default.
      output = await image.rotate().resize({ width: 1600, height: 1200, fit: 'inside', withoutEnlargement: true }).webp({ quality: 84 }).toBuffer();
    } catch { throw new HttpError('That file could not be read as a still image. Choose a JPG, PNG, WebP, or AVIF image.'); }
    const fileName = `${randomUUID()}.webp`;
    await put(`covers/${fileName}`, output, { access: 'private', contentType: 'image/webp', addRandomSuffix: false });
    return privateJson({ url: `/covers/${fileName}`, alt });
  } catch (error) { return apiFailure(error); }
}
