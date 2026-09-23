import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get('pnp_session');

  // Protected paths that strictly require an active authenticated session
  const isProtectedPath =
    pathname === '/admin' ||
    pathname.startsWith('/admin/') ||
    pathname === '/team' ||
    pathname.startsWith('/team/') ||
    pathname === '/team-submission' ||
    pathname.startsWith('/team-submission/') ||
    pathname === '/portfolio' ||
    pathname.startsWith('/portfolio/') ||
    pathname === '/dashboard' ||
    pathname.startsWith('/dashboard/') ||
    pathname === '/arena' ||
    pathname.startsWith('/arena/') ||
    pathname === '/investment' ||
    pathname.startsWith('/investment/') ||
    pathname === '/results' ||
    pathname.startsWith('/results/');

  if (isProtectedPath && !sessionCookie?.value) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin',
    '/admin/:path*',
    '/team',
    '/team/:path*',
    '/team-submission',
    '/team-submission/:path*',
    '/portfolio',
    '/portfolio/:path*',
    '/dashboard',
    '/dashboard/:path*',
    '/arena',
    '/arena/:path*',
    '/investment/:path*',
    '/results',
    '/results/:path*',
  ],
};
