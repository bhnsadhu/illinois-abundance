import { z } from 'zod';
import { apiFailure, guardRateLimit, HttpError, privateJson, readJson, requireOrigin } from '@/lib/api';
import { newToken, requestIp } from '@/lib/security';
import { hashSessionToken, REVIEWER_COOKIE, reviewerCookieOptions } from '@/lib/auth';
import { verifyPassword } from '@/lib/passwords';
import { serviceDatabase } from '@/lib/database/service';
import { emailSchema } from '@/lib/validation';
import { isAdminEmail } from '@/lib/admin-access';

export const runtime = 'nodejs';
const schema = z.object({
  email: emailSchema, password: z.string().min(1).max(128), role: z.enum(['admin', 'reviewer']),
  website: z.string().max(0).optional().default(''),
}).strict();
export async function POST(request: Request) {
  try {
    requireOrigin(request);
    const input = schema.parse(await readJson(request, 4096));
    if (!process.env.DATABASE_URL || (process.env.CODE_PEPPER?.length ?? 0) < 32) {
      throw new HttpError('Sign in is not connected yet. Please try again soon.', 503);
    }
    await guardRateLimit('password-login-ip', requestIp(request), 60, 900);
    await guardRateLimit('password-login-email', input.email, 10, 900);
    const db = serviceDatabase();
    const { data: reviewer, error } = await db.from<{ id: string; password_hash: string | null; is_active: boolean }>('reviewers')
      .select('id,password_hash,is_active').eq('email', input.email).maybeSingle();
    if (error) throw new HttpError('Please try again in a moment.', 503);
    const matches = await verifyPassword(input.password, reviewer?.password_hash);
    const isAdmin = isAdminEmail(input.email);
    if (!matches || !reviewer?.is_active || (input.role === 'admin' && !isAdmin)) {
      throw new HttpError('Email or password is incorrect for this sign in.', 401);
    }
    const token = newToken();
    const result = await db.rpc<{ status: string }>('create_password_session', {
      p_reviewer_id: reviewer.id, p_email: input.email, p_password_hash: reviewer.password_hash, p_session_hash: hashSessionToken(token),
    });
    if (result.error) throw new HttpError('Please try again in a moment.', 503);
    if (result.data?.status !== 'ok') throw new HttpError('Email or password is incorrect for this sign in.', 401);
    const response = privateJson({ ok: true, redirect: isAdmin ? '/admin' : '/review' });
    response.cookies.set(REVIEWER_COOKIE, token, reviewerCookieOptions());
    return response;
  } catch (error) { return apiFailure(error); }
}
