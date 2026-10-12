import { NextRequest, NextResponse } from 'next/server';
import { hashLoginToken, hashSessionToken, REVIEWER_COOKIE, reviewerCookieOptions } from '@/lib/auth';
import { site } from '@/lib/config';
import { newToken } from '@/lib/security';
import { serviceDatabase } from '@/lib/database/service';

export async function GET(request: NextRequest) {
  let destination = '/login?error=expired';
  let session: string | null = null;
  const token = request.nextUrl.searchParams.get('token');
  if (token && /^[a-f0-9]{64}$/.test(token)) {
    try {
      const proposedSession = newToken();
      const { data, error } = await serviceDatabase().rpc<{ status: string }>('consume_login', {
        p_token_hash: hashLoginToken(token), p_session_hash: hashSessionToken(proposedSession),
        p_admin_email: process.env.ADMIN_EMAIL?.trim().toLowerCase() || null,
      });
      if (!error && data?.status === 'ok') { destination = '/review'; session = proposedSession; }
    } catch { /* Expired and invalid links share the same safe sign-in state. */ }
  }
  const response = NextResponse.redirect(new URL(destination, site.url));
  if (session) response.cookies.set(REVIEWER_COOKIE, session, reviewerCookieOptions());
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
