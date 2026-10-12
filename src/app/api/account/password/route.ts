import { z } from 'zod';
import { cookies } from 'next/headers';
import { getReviewer, hashSessionToken, REVIEWER_COOKIE, reviewerCookieOptions } from '@/lib/auth';
import { apiFailure, guardRateLimit, HttpError, privateJson, readJson, requireOrigin } from '@/lib/api';
import { passwordSchema } from '@/lib/password-schema';
import { hashPassword, verifyPassword } from '@/lib/passwords';
import { newToken } from '@/lib/security';
import { serviceDatabase } from '@/lib/database/service';

export const runtime = 'nodejs';
const schema = z.object({ currentPassword: z.string().min(1).max(128), newPassword: passwordSchema,
  confirmPassword: z.string().max(128) }).strict()
  .refine(input => input.newPassword === input.confirmPassword, 'The new passwords do not match.')
  .refine(input => input.currentPassword !== input.newPassword, 'Choose a different new password.');
export async function POST(request: Request) {
  try {
    requireOrigin(request);
    const reviewer = await getReviewer();
    if (!reviewer) throw new HttpError('Sign in to change your password.', 401);
    const input = schema.parse(await readJson(request, 4096));
    await guardRateLimit('change-password', reviewer.id, 10, 900);
    const db = serviceDatabase();
    const { data, error } = await db.from<{ password_hash: string | null }>('reviewers')
      .select('password_hash').eq('id', reviewer.id).maybeSingle();
    if (error) throw new HttpError('Please try again in a moment.', 503);
    if (!await verifyPassword(input.currentPassword, data?.password_hash)) throw new HttpError('Your current password is incorrect.', 400);
    const token = newToken();
    const result = await db.rpc<{ status: string }>('change_reviewer_password', {
      p_reviewer_id: reviewer.id, p_current_session_hash: hashSessionToken((await cookies()).get(REVIEWER_COOKIE)!.value), p_current_hash: data!.password_hash,
      p_new_hash: await hashPassword(input.newPassword), p_session_hash: hashSessionToken(token),
    });
    if (result.error) throw new HttpError('We could not change your password. Please try again.', 503);
    if (result.data?.status !== 'ok') throw new HttpError('Your account changed. Sign in again and retry.', 409);
    const response = privateJson({ ok: true });
    response.cookies.set(REVIEWER_COOKIE, token, reviewerCookieOptions());
    return response;
  } catch (error) { return apiFailure(error); }
}
