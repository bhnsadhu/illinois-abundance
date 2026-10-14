import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { serviceDatabase } from '@/lib/database/service';
import { privateHash } from '@/lib/security';
import { site } from '@/lib/config';
import { isAdminEmail } from '@/lib/admin-access';

export type Reviewer = { id: string; name: string; email: string; isAdmin: boolean };
type ReviewerRow = { id: string; name: string; email: string; is_active: boolean };
type SessionRow = { email: string; expires_at: string };
export const REVIEWER_COOKIE = 'ia_reviewer_session';
export const REVIEWER_SESSION_SECONDS = 7 * 24 * 60 * 60;
export const reviewerCookieOptions = () => ({
  httpOnly: true, sameSite: 'lax' as const, path: '/',
  secure: process.env.NODE_ENV === 'production' || site.url.startsWith('https://'),
  maxAge: REVIEWER_SESSION_SECONDS,
});
export const hashSessionToken = (token: string) => privateHash(`reviewer-session:${token}`);

export async function getReviewer(): Promise<Reviewer | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    const token = (await cookies()).get(REVIEWER_COOKIE)?.value;
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    const db = serviceDatabase();
    const { data: session, error } = await db.from<SessionRow>('reviewer_sessions').select('email,expires_at')
      .eq('token_hash', hashSessionToken(token)).gt('expires_at', new Date().toISOString()).maybeSingle();
    if (error || !session) return null;
    // The opaque cookie proves possession of an unexpired server session; the
    // current membership list, not cached claims, grants editorial permissions.
    const email = String(session.email).trim().toLowerCase();
    const isAdmin = isAdminEmail(email);
    const { data, error: lookupError } = await db.from<ReviewerRow>('reviewers').select('id,name,email,is_active')
      .eq('email', email).eq('is_active', true).maybeSingle();
    return !lookupError && data ? { id: data.id, name: data.name, email, isAdmin } : null;
  } catch { return null; }
}

export async function requireReviewer(): Promise<Reviewer> {
  const reviewer = await getReviewer();
  if (!reviewer) redirect('/login');
  return reviewer;
}
export async function requireAdmin(): Promise<Reviewer> {
  const reviewer = await getReviewer();
  if (!reviewer) redirect('/login/admin');
  if (!reviewer.isAdmin) redirect('/review');
  return reviewer;
}
