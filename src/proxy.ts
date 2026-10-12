import { NextRequest, NextResponse } from 'next/server';

export function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });
  // Every private page and mutation still checks the database session and current
  // reviewer list itself. Proxy only prevents sensitive responses being cached.
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  return response;
}
export const config = {
  matcher: ['/review/:path*', '/admin/:path*', '/auth/callback', '/api/review/:path*', '/api/admin/:path*', '/api/covers', '/api/logout'],
};
