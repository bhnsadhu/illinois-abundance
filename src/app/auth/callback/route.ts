import { NextResponse } from 'next/server';
import { site } from '@/lib/config';

/** Old bookmarks and email links now lead to password sign-in. */
export async function GET() {
  const response = NextResponse.redirect(new URL('/login?error=password', site.url));
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
