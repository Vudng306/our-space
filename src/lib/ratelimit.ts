import { tooMany } from "./api";

type Bucket = { count: number; resetAt: number };

/**
 * Fixed-window limiter held in process memory.
 *
 * On a single server this is exact. On a serverless host each instance keeps
 * its own counters, so treat it as a brake on runaway clients rather than a
 * hard guarantee — swap in Redis/Upstash here if you ever need one.
 */
const buckets = new Map<string, Bucket>();

function sweep(now: number) {
  if (buckets.size < 5000) return;
  for (const [key, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(key);
  }
}

export type LimitRule = { limit: number; windowMs: number };

export const RULES = {
  login: { limit: 8, windowMs: 10 * 60 * 1000 },
  // Two people sign up once each, ever. The headroom is for the check
  // suite, which creates and deletes throwaway accounts.
  register: { limit: 10, windowMs: 60 * 60 * 1000 },
  passwordReset: { limit: 5, windowMs: 60 * 60 * 1000 },
  invite: { limit: 10, windowMs: 60 * 60 * 1000 },
  inviteAccept: { limit: 10, windowMs: 10 * 60 * 1000 },
  upload: { limit: 120, windowMs: 10 * 60 * 1000 },
  search: { limit: 60, windowMs: 60 * 1000 },
  export: { limit: 5, windowMs: 60 * 60 * 1000 },
  write: { limit: 240, windowMs: 10 * 60 * 1000 },
} satisfies Record<string, LimitRule>;

export function consume(key: string, rule: LimitRule): void {
  const now = Date.now();
  sweep(now);
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + rule.windowMs });
    return;
  }
  existing.count += 1;
  if (existing.count > rule.limit) {
    const seconds = Math.ceil((existing.resetAt - now) / 1000);
    throw tooMany(`Thử hơi nhiều lần rồi. Đợi khoảng ${seconds > 60 ? `${Math.ceil(seconds / 60)} phút` : `${seconds} giây`} rồi thử lại.`);
  }
}

/** Best-effort client identity for anonymous endpoints. */
export function clientKey(req: Request, scope: string): string {
  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  return `${scope}:${ip}`;
}

export function limit(req: Request, scope: keyof typeof RULES, identity?: string) {
  consume(identity ? `${scope}:${identity}` : clientKey(req, scope), RULES[scope]);
}
