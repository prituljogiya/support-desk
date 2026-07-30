import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { homeForRole, isDeskRole, isPortalRole } from "@/lib/permissions";

function sessionCookieOpts(request: NextRequest) {
  // Auth.js prefixes cookies with __Secure- on HTTPS (Vercel production/preview).
  const secure =
    request.nextUrl.protocol === "https:" || process.env.VERCEL === "1";
  const salt = secure
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";
  return { secureCookie: secure, salt, cookieName: salt };
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
    ...sessionCookieOpts(request),
  });

  const role = token?.membershipRole as string | null | undefined;
  const isSuperAdmin = Boolean(token?.isSuperAdmin);
  const home = homeForRole(role as never, isSuperAdmin);

  const isAuthPage =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/signup";
  const isInvite = pathname.startsWith("/invite");
  const isPortal = pathname.startsWith("/portal");
  const isDesk = pathname.startsWith("/desk");
  const isPlatform = pathname.startsWith("/platform");

  if (!token && (isPortal || isDesk || isPlatform)) {
    const url = new URL("/login", request.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  if (token && isAuthPage) {
    if (isSuperAdmin && !token.organizationId) {
      return NextResponse.redirect(new URL("/platform", request.url));
    }
    if (token.organizationId) {
      return NextResponse.redirect(new URL(home, request.url));
    }
    if (pathname === "/login" || pathname === "/register") {
      return NextResponse.redirect(new URL("/signup", request.url));
    }
    return NextResponse.next();
  }

  if (token && isPlatform && !isSuperAdmin) {
    if (!token.organizationId) {
      return NextResponse.redirect(new URL("/signup", request.url));
    }
    return NextResponse.redirect(new URL(home, request.url));
  }

  if (token && (isPortal || isDesk) && !token.organizationId) {
    if (isSuperAdmin) {
      return NextResponse.redirect(new URL("/platform", request.url));
    }
    return NextResponse.redirect(new URL("/signup", request.url));
  }

  if (
    token &&
    (isPortal || isDesk) &&
    token.organizationId &&
    !token.membershipRole
  ) {
    return NextResponse.redirect(new URL("/signup", request.url));
  }

  if (
    token &&
    isPortal &&
    role &&
    isDeskRole(role as never) &&
    !isPortalRole(role as never)
  ) {
    return NextResponse.redirect(new URL("/desk", request.url));
  }

  if (token && isDesk && role && isPortalRole(role as never)) {
    return NextResponse.redirect(new URL("/portal", request.url));
  }

  if (isInvite) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/portal/:path*",
    "/desk/:path*",
    "/platform/:path*",
    "/login",
    "/register",
    "/signup",
    "/invite/:path*",
  ],
};
