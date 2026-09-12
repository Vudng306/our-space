import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "os_session";

/**
 * A cheap gate that keeps signed-out visitors off the app shell.
 *
 * It only checks that the cookie carries a signature we made — it deliberately
 * does not decide what anybody may read. Real authorisation happens in the
 * route handlers and server components, where the session row and space
 * membership can actually be looked up.
 */
const secret = new TextEncoder().encode(process.env.AUTH_SECRET ?? "");

const PROTECTED = ["/app", "/onboarding"];
const AUTH_PAGES = ["/login", "/register", "/forgot-password"];

async function hasValidToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, secret, { algorithms: ["HS256"] });
    return true;
  } catch {
    return false;
  }
}

export default async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const signedIn = await hasValidToken(token);

  if (PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`)) && !signedIn) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  if (AUTH_PAGES.includes(pathname) && signedIn) {
    const url = req.nextUrl.clone();
    url.pathname = "/app";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/onboarding", "/login", "/register", "/forgot-password"],
};
