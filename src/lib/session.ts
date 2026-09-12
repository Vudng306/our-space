import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { db } from "./db";
import { env } from "./env";
import { forbidden, unauthorized } from "./api";

export const SESSION_COOKIE = "os_session";
const SESSION_DAYS = 30;

const secret = new TextEncoder().encode(env.AUTH_SECRET);

export type SessionUser = {
  id: string;
  email: string;
  displayName: string;
  avatarMediaId: string | null;
};

/**
 * The cookie holds a signed JWT that only *references* a session row. The row
 * is what actually grants access, so revoking it (logout, password change)
 * takes effect immediately rather than at token expiry.
 */
export async function signSessionToken(sessionId: string, userId: string, expiresAt: Date) {
  return new SignJWT({ sid: sessionId, uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secret);
}

export async function verifySessionToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    const sid = payload.sid;
    const uid = payload.uid;
    if (typeof sid !== "string" || typeof uid !== "string") return null;
    return { sid, uid };
  } catch {
    return null;
  }
}

export async function createSession(userId: string, userAgent?: string | null) {
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const session = await db.session.create({
    data: { userId, expiresAt, userAgent: userAgent?.slice(0, 255) ?? null },
  });
  const token = await signSessionToken(session.id, userId, expiresAt);

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  return session;
}

export async function destroyCurrentSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    const payload = await verifySessionToken(token);
    if (payload) {
      await db.session.deleteMany({ where: { id: payload.sid } });
    }
  }
  store.delete(SESSION_COOKIE);
}

/** Ends every session for a user — used after a password reset. */
export async function destroyAllSessions(userId: string) {
  await db.session.deleteMany({ where: { userId } });
}

/** Returns the signed-in user, or null. Never throws. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = await verifySessionToken(token);
  if (!payload) return null;

  const session = await db.session.findUnique({
    where: { id: payload.sid },
    include: {
      user: { select: { id: true, email: true, displayName: true, avatarMediaId: true } },
    },
  });

  if (!session || session.userId !== payload.uid) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await db.session.deleteMany({ where: { id: session.id } });
    return null;
  }

  // Cheap activity tracking, at most once an hour.
  if (Date.now() - session.lastSeenAt.getTime() > 60 * 60 * 1000) {
    await db.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
  }

  return session.user;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  return user;
}

/**
 * CSRF defence for cookie auth: a cross-site form post will not carry a
 * matching Origin. Combined with SameSite=Lax this covers the mutating routes.
 */
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return; // same-origin navigations and server-side calls omit it
  let allowed: string;
  try {
    allowed = new URL(env.appUrl).origin;
  } catch {
    allowed = env.appUrl;
  }
  const host = req.headers.get("host");
  const originHost = (() => {
    try {
      return new URL(origin).host;
    } catch {
      return null;
    }
  })();
  if (origin === allowed) return;
  if (originHost && host && originHost === host) return;
  throw forbidden("Request blocked: cross-site origin.");
}
