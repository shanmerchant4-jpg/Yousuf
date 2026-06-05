import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? "dev-insecure-secret-change-me",
);

const PUBLIC_PATHS = ["/login"];

const isDev = process.env.NODE_ENV !== "production";

/**
 * Per-request Content Security Policy.
 * Production: scripts must carry the request nonce; 'strict-dynamic' lets the
 *   nonce'd bootstrap load the rest of Next's chunks.
 * Development: Turbopack HMR uses eval + un-nonced inline scripts and a
 *   websocket, so script-src is relaxed and ws: is allowed. Dev only.
 */
function buildCsp(nonce: string): string {
  const scriptSrc = isDev
    ? "script-src 'self' 'unsafe-eval' 'unsafe-inline'"
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`;
  const connectSrc = isDev ? "connect-src 'self' ws:" : "connect-src 'self'";
  return [
    "default-src 'self'",
    scriptSrc,
    // 'unsafe-inline' needed by Next.js SSR style injection (fonts/critical CSS).
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    connectSrc,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

/**
 * Attach the CSP to a passthrough response and forward the nonce to Next via
 * the request headers so Next stamps its own inline scripts with it.
 */
function pass(req: NextRequest): NextResponse {
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce);
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("content-security-policy", csp);
  return res;
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // let API cron + next internals through (cron guards itself with CRON_SECRET)
  if (pathname.startsWith("/api")) return NextResponse.next();
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return pass(req);

  const token = req.cookies.get("isp_session")?.value;
  let valid = false;
  if (token) {
    try {
      await jwtVerify(token, secret);
      valid = true;
    } catch {
      valid = false;
    }
  }

  if (!valid) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return pass(req);
}

export const config = {
  // run on everything except next static assets + favicon
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
