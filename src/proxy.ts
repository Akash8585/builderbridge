import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

const PUBLIC_PATHS = [
  "/sign-in",
  "/sign-up",
  "/invite",
  "/api/auth",
  // Stripe calls this server-to-server with no session cookie.
  "/api/webhooks/stripe",
  "/api/integrations/procore/callback",
  "/api/integrations/autodesk/callback",
  "/pricing",
  "/features",
  "/solutions",
  // PWA assets — must be fetchable without a session (browser/OS requests these).
  "/manifest.webmanifest",
  "/sw.js",
  "/offline.html",
  "/icons",
  "/videos",
  "/uploads",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestHeaders = new Headers(request.headers);
  const suppliedRequestId = request.headers.get("x-request-id")?.trim();
  const requestId = suppliedRequestId && /^[A-Za-z0-9._:-]{8,128}$/.test(suppliedRequestId)
    ? suppliedRequestId
    : crypto.randomUUID();
  requestHeaders.set("x-request-id", requestId);
  const next = () => {
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("X-Request-ID", requestId);
    return response;
  };

  // The marketing landing page is public (exact match — "/" prefixes everything).
  if (pathname === "/") return next();

  const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
  if (isPublic) return next();

  // Lightweight cookie presence check only (no DB call) — real session/org
  // validation happens in Server Components/Actions via lib/session.ts.
  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    const signInUrl = new URL("/sign-in", request.url);
    const response = NextResponse.redirect(signInUrl);
    response.headers.set("X-Request-ID", requestId);
    return response;
  }

  return next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
