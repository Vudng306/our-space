import bcrypt from "bcryptjs";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const BCRYPT_ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * A dummy compare run when the email does not exist, so that sign-in takes
 * roughly the same time whether or not the account is real.
 */
const DUMMY_HASH = bcrypt.hashSync("our-space-timing-equaliser", BCRYPT_ROUNDS);
export async function burnPasswordTime(): Promise<void> {
  await bcrypt.compare("our-space-timing-equaliser", DUMMY_HASH);
}

/** URL-safe random token used for invites and password resets. */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Only the hash of a token is ever stored (spec §6.2). */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
