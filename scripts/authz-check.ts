/**
 * Cross-space authorisation check (spec §12.1 "Security", §12.2).
 *
 * Signs in as a member of the seeded space, notes a real moment/media id, then
 * proves an outsider and an anonymous caller cannot reach either one by id.
 * Run against a dev server: npx tsx scripts/authz-check.ts
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const BASE = process.env.CHECK_BASE_URL ?? "http://localhost:3000";
const ORIGIN = { Origin: BASE, "Content-Type": "application/json" };

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

let failures = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  (got ${String(actual)}, expected ${String(expected)})`);
}

async function post(path: string, body: unknown, cookie?: string) {
  return fetch(`${BASE}${path}`, {
    method: "POST",
    headers: cookie ? { ...ORIGIN, Cookie: cookie } : ORIGIN,
    body: JSON.stringify(body),
    redirect: "manual",
  });
}

function cookieFrom(res: Response): string {
  const raw = res.headers.getSetCookie?.() ?? [];
  const session = raw.find((c) => c.startsWith("os_session="));
  if (!session) throw new Error("No session cookie in response");
  return session.split(";")[0];
}

async function main() {
  const insider = await db.user.findUnique({ where: { email: "mai@example.com" } });
  if (!insider) throw new Error("Seed data missing — run: npx tsx prisma/seed.ts");

  // Pick a moment that actually has a photo, so the media checks run too.
  const moment = await db.moment.findFirstOrThrow({
    where: { deletedAt: null, media: { some: {} } },
    include: { media: { take: 1 } },
  });
  const mediaId = moment.media[0]?.mediaId;
  const memory = await db.memory.findFirst({ where: { spaceId: moment.spaceId } });

  // --- anonymous ---------------------------------------------------------
  const anonMoment = await fetch(`${BASE}/api/v1/moments/${moment.id}`, { redirect: "manual" });
  check("anonymous cannot read a moment", anonMoment.status, 401);

  if (mediaId) {
    const anonMedia = await fetch(`${BASE}/api/v1/media/${mediaId}`, { redirect: "manual" });
    check("anonymous cannot read a photo", anonMedia.status, 401);
  }

  // --- insider (control: these must succeed) -----------------------------
  const login = await post("/api/v1/auth/login", {
    email: "mai@example.com",
    password: "ourspace-dev-2026",
  });
  check("member can sign in", login.status, 200);
  const insiderCookie = cookieFrom(login);

  const insiderMoment = await fetch(`${BASE}/api/v1/moments/${moment.id}`, {
    headers: { Cookie: insiderCookie },
    redirect: "manual",
  });
  check("member can read their own moment", insiderMoment.status, 200);

  if (mediaId) {
    const insiderMedia = await fetch(`${BASE}/api/v1/media/${mediaId}`, {
      headers: { Cookie: insiderCookie },
      redirect: "manual",
    });
    check("member can read their own photo", insiderMedia.status, 200);
  }

  // --- outsider ----------------------------------------------------------
  const email = `outsider-${Date.now()}@example.com`;
  const register = await post("/api/v1/auth/register", {
    email,
    password: "outsider-password-123",
    displayName: "Outsider",
  });
  check("outsider can register", register.status, 201);
  const outsiderCookie = cookieFrom(register);

  const spaceless = await fetch(`${BASE}/api/v1/moments/${moment.id}`, {
    headers: { Cookie: outsiderCookie },
    redirect: "manual",
  });
  check("outsider with no space cannot read a moment", spaceless.status, 403);

  const spacelessSheets = await fetch(`${BASE}/api/v1/sheets`, {
    headers: { Cookie: outsiderCookie },
    redirect: "manual",
  });
  check("a user with no space cannot read any sheet", spacelessSheets.status, 403);

  await post("/api/v1/spaces", { name: "Somebody Else" }, outsiderCookie);

  const byId = await fetch(`${BASE}/api/v1/moments/${moment.id}`, {
    headers: { Cookie: outsiderCookie },
    redirect: "manual",
  });
  check("outsider cannot read a moment by id", byId.status, 404);

  const patch = await fetch(`${BASE}/api/v1/moments/${moment.id}`, {
    method: "PATCH",
    headers: { ...ORIGIN, Cookie: outsiderCookie },
    body: JSON.stringify({ caption: "hacked" }),
    redirect: "manual",
  });
  check("outsider cannot edit a moment", patch.status, 404);

  const del = await fetch(`${BASE}/api/v1/moments/${moment.id}`, {
    method: "DELETE",
    headers: { ...ORIGIN, Cookie: outsiderCookie },
    redirect: "manual",
  });
  check("outsider cannot delete a moment", del.status, 404);

  if (mediaId) {
    const media = await fetch(`${BASE}/api/v1/media/${mediaId}`, {
      headers: { Cookie: outsiderCookie },
      redirect: "manual",
    });
    check("outsider cannot read a photo by id", media.status, 403);
  }

  if (memory) {
    const mem = await fetch(`${BASE}/api/v1/memories/${memory.id}`, {
      headers: { Cookie: outsiderCookie },
      redirect: "manual",
    });
    check("outsider cannot read a memory by id", mem.status, 404);
  }

  // In their own space they get their own blank sheet — what matters is that
  // it is theirs, and that the other couple sheet never appears in it.
  const outsiderSheets = await fetch(`${BASE}/api/v1/sheets`, {
    headers: { Cookie: outsiderCookie },
    redirect: "manual",
  });
  const outsiderBody = (await outsiderSheets.json()) as {
    me: { displayName: string; favFood: string | null };
    partner: unknown | null;
  };
  check("outsider sees only their own sheet", outsiderBody.me.displayName, "Outsider");
  check("outsider sees no partner sheet", outsiderBody.partner, null);
  check("outsider sheet carries none of the other couple answers", outsiderBody.me.favFood, null);

  const editPerson = await fetch(`${BASE}/api/v1/people/${insider.id}`, {
    method: "PATCH",
    headers: { ...ORIGIN, Cookie: outsiderCookie },
    body: JSON.stringify({ hometown: "hacked" }),
    redirect: "manual",
  });
  check("outsider cannot edit a profile in another space", editPerson.status, 400);

  const outsiderTimeline = await fetch(`${BASE}/api/v1/moments`, {
    headers: { Cookie: outsiderCookie },
    redirect: "manual",
  });
  const outsiderItems = (await outsiderTimeline.json()) as { items: unknown[] };
  check("outsider timeline is empty", outsiderItems.items.length, 0);

  // --- CSRF --------------------------------------------------------------
  const crossSite = await fetch(`${BASE}/api/v1/moments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://evil.example", Cookie: insiderCookie },
    body: JSON.stringify({ caption: "csrf", occurredAt: new Date().toISOString(), timezone: "UTC" }),
    redirect: "manual",
  });
  check("cross-site POST is refused", crossSite.status, 403);

  // --- invite tokens -----------------------------------------------------
  const badInvite = await fetch(`${BASE}/api/v1/invites/not-a-real-token`, { redirect: "manual" });
  const badBody = (await badInvite.json()) as { valid: boolean };
  check("unknown invite token is not valid", badBody.valid, false);

  // clean up the throwaway account and its space
  const outsider = await db.user.findUnique({ where: { email } });
  if (outsider) {
    const membership = await db.coupleMember.findFirst({ where: { userId: outsider.id } });
    if (membership) await db.coupleSpace.delete({ where: { id: membership.spaceId } });
    await db.user.delete({ where: { id: outsider.id } });
  }

  console.log(failures === 0 ? "\nAll authorisation checks passed." : `\n${failures} check(s) FAILED.`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
