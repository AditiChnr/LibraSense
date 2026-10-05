import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionToken = request.cookies.get('librasense_session')?.value;

  // Protected student paths
  const isStudentPath =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/map') ||
    pathname.startsWith('/reservations') ||
    pathname.startsWith('/scan') ||
    pathname.startsWith('/session') ||
    pathname.startsWith('/analytics');

  // Protected admin paths
  const isAdminPath = pathname.startsWith('/admin');

  // If attempting to access protected student or admin path without session token, redirect to login
  if ((isStudentPath || isAdminPath) && !sessionToken) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If already logged in and visiting login/register, redirect to dashboard
  if ((pathname === '/login' || pathname === '/register') && sessionToken) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/map/:path*',
    '/reservations/:path*',
    '/scan/:path*',
    '/session/:path*',
    '/analytics/:path*',
    '/admin/:path*',
    '/login',
    '/register',
  ],
};
