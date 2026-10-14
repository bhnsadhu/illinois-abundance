import { NextRequest, NextResponse } from 'next/server';
import { hiddenDestination } from '@/hidden/features';
import { getUncachedVisibility } from '@/lib/site-visibility';

export async function proxy(request: NextRequest) {
  const destination = hiddenDestination(request.nextUrl.pathname) ? hiddenDestination(request.nextUrl.pathname,await getUncachedVisibility()) : null;
  if (destination) {
    const response = request.nextUrl.pathname.startsWith('/api/') || !['GET', 'HEAD'].includes(request.method)
      ? NextResponse.json({ error: 'Not found.' }, { status: 404 })
      : NextResponse.redirect(new URL(destination, request.url));
    response.headers.set('Cache-Control', 'private, no-store');
    response.headers.set('Referrer-Policy', 'no-referrer');
    response.headers.set('X-Robots-Tag', 'noindex');
    return response;
  }
  if (request.nextUrl.pathname === '/unsubscribe' && request.method === 'POST') {
    const target = request.nextUrl.clone();
    target.pathname = '/api/unsubscribe';
    const response = NextResponse.rewrite(target);
    response.headers.set('Cache-Control', 'private, no-store');
    response.headers.set('Referrer-Policy', 'no-referrer');
    return response;
  }
  const response = NextResponse.next({ request });
  // Every private page and mutation still checks the database session and current
  // reviewer list itself. Proxy only prevents sensitive responses being cached.
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
export const config = {
  matcher: ['/account/:path*', '/api/account/:path*', '/login/:path*', '/api/login', '/review/:path*', '/admin/:path*', '/auth/callback', '/api/review/:path*', '/api/admin/:path*', '/api/covers', '/api/logout', '/learn/:path*', '/show-up/:path*', '/subscribe/:path*', '/api/subscribe/:path*', '/unsubscribe'],
};
