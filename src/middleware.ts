import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Server-side route protection middleware.
 * Runs on the Edge before any page is rendered, preventing any HTML
 * from being served to unauthenticated or unauthorised users.
 *
 * NOTE: The auth_token cookie is set by the browser when Sanctum returns
 * it. Until we complete the full migration to HTTP-only cookies this
 * middleware reads the token presence only to decide redirection —
 * actual token validity is still verified server-side by Sanctum on
 * every API call.
 */

const DASHBOARD_PATHS = ['/dashboard'];
const AUTH_PATHS = ['/login', '/register'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('auth_token')?.value
    ?? request.headers.get('authorization')?.replace('Bearer ', '');

  const isDashboard = DASHBOARD_PATHS.some((p) => pathname.startsWith(p));
  const isAuthPage  = AUTH_PATHS.some((p) => pathname.startsWith(p));

  // Redirect unauthenticated users away from the dashboard
  if (isDashboard && !token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect already-authenticated users away from login / register
  if (isAuthPage && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Only run on dashboard and auth pages — skip static assets and API routes
  matcher: [
    '/dashboard/:path*',
    '/login',
    '/register',
  ],
};
