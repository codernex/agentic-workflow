import { NextResponse, type NextRequest } from "next/server";

export const PROTECTED_ROUTES = ["/dashboard", "/workflows", "/credentials", "/tools"];
export const AUTH_ROUTES = ["/login"];

/**
 * Next.js 16 Proxy Convention for Server-Side Route Guarding & Instant Auth Redirects
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("access_token")?.value;

  const isProtectedRoute = PROTECTED_ROUTES.some((route) =>
    pathname.startsWith(route)
  );
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));

  // Redirect unauthenticated visitors trying to access protected paths
  if (isProtectedRoute && !token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users trying to access login page to workflows
  if (isAuthRoute && token) {
    return NextResponse.redirect(new URL("/workflows", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/workflows/:path*",
    "/credentials/:path*",
    "/tools/:path*",
    "/login",
  ],
};
