import { cookies } from 'next/headers';
import { apiFailure, HttpError, privateJson, requireOrigin } from '@/lib/api';
import { hashSessionToken, REVIEWER_COOKIE, reviewerCookieOptions } from '@/lib/auth';
import { serviceDatabase } from '@/lib/database/service';

export async function POST(request: Request) {
  try {
    requireOrigin(request);
    const store = await cookies();
    const token = store.get(REVIEWER_COOKIE)?.value;
    if (token && /^[a-f0-9]{64}$/.test(token)) {
      const { error } = await serviceDatabase().from('reviewer_sessions').delete().eq('token_hash', hashSessionToken(token));
      if (error) throw new HttpError('We could not finish signing out. Please try again.', 503);
    }
    // Keep the token available for a retry if server invalidation fails.
    store.set(REVIEWER_COOKIE, '', { ...reviewerCookieOptions(), maxAge: 0 });
    return privateJson({ ok: true });
  } catch (error) { return apiFailure(error); }
}
