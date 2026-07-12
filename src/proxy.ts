import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Server-side route protection middleware.
 * Runs on the Edge before any page is rendered, preventing any HTML
 * from being served to unauthenticated or unauthorised users.
 *
 * Reads two cookies:
 *  - auth_token  — presence indicates the user is logged in
 *  - user_role   — the role string stored at login (admin/superadmin/delivery/customer)
 *
 * Role-based redirect matrix:
 *  | Role            | Protected page hit | → Redirect to |
 *  |-----------------|-------------------|---------------|
 *  | admin/superadmin| /login /register  | /dashboard    |
 *  | delivery        | /login /register  | /delivery     |
 *  | customer / any  | /login /register  | /products     |
 *  | delivery        | /account          | /delivery     |
 *  | customer        | /delivery         | /products     |
 *  | unauthenticated | /dashboard        | /login        |
 *  | unauthenticated | /delivery         | /login        |
 *  | unauthenticated | /account          | /login        |
 */

const ADMIN_PATHS    = ['/dashboard'];
const DELIVERY_PATHS = ['/delivery'];
const ACCOUNT_PATHS  = ['/account'];
const AUTH_PATHS     = ['/login', '/register'];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('auth_token')?.value
    ?? request.headers.get('authorization')?.replace('Bearer ', '');
  const role = request.cookies.get('user_role')?.value ?? '';

  const isAdminPath    = ADMIN_PATHS.some((p)    => pathname.startsWith(p));
  const isDeliveryPath = DELIVERY_PATHS.some((p) => pathname.startsWith(p));
  const isAccountPath  = ACCOUNT_PATHS.some((p)  => pathname.startsWith(p));
  const isAuthPage     = AUTH_PATHS.some((p)     => pathname.startsWith(p));

  // ── Unauthenticated: protect private routes ──────────────────────────────
  if (!token) {
    if (isAdminPath || isDeliveryPath || isAccountPath) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // ── Authenticated: redirect away from login/register ────────────────────
  if (isAuthPage) {
    if (role === 'admin' || role === 'superadmin') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    if (role === 'delivery') {
      return NextResponse.redirect(new URL('/delivery', request.url));
    }
    // customer or unknown role
    return NextResponse.redirect(new URL('/products', request.url));
  }

  // ── Role enforcement on protected routes ─────────────────────────────────
  // Delivery driver trying to access customer account portal → send to delivery hub
  if (isAccountPath && role === 'delivery') {
    return NextResponse.redirect(new URL('/delivery', request.url));
  }
  // Delivery driver trying to access any non-delivery route (home, products, etc.) → send to delivery hub
  if (role === 'delivery' && !isDeliveryPath && !isAuthPage) {
    // Allow /change-password for account recovery
    if (!pathname.startsWith('/change-password')) {
      return NextResponse.redirect(new URL('/delivery', request.url));
    }
  }
  // Customer/admin trying to access delivery hub → send to products
  if (isDeliveryPath && role !== 'delivery' && role !== 'admin' && role !== 'superadmin') {
    return NextResponse.redirect(new URL('/products', request.url));
  }
  // Non-admin trying to access dashboard → send to products
  if (isAdminPath && role !== 'admin' && role !== 'superadmin') {
    return NextResponse.redirect(new URL('/products', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image  (image optimisation)
     * - favicon.ico
     * - /images/ and /assets/ (public asset folders)
     * - API routes (/api/...)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|images|assets).*)',
  ],
};
