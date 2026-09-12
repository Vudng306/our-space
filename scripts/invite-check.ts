/**
 * Two-account invite flow (spec §12.1 "Create space", "Join").
 *
 * Creates a throwaway space, invites a second account, and proves both people
 * end up looking at the same data — then checks the invite is single-use, the
 * space caps at two, and cleans everything up.
 *
 *   npx tsx scripts/invite-check.ts
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const BASE = process.env.CHECK_BASE_URL ?? "http://localhost:3000";
const PASSWORD = "invite-check-password";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

async function call<T>(path: string, cookie: string | null, init: RequestInit = {}) {
  const res = await fetch(`${BASE}/api/v1${path}`, {
    ...init,
    headers: {
      Origin: BASE,
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
      ...init.headers,
    },
    redirect: "manual",
  });
  const session = res.headers.getSetCookie?.().find((c) => c.startsWith("os_session="));
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body: body as T, cookie: session ? session.split(";")[0] : cookie };
}

async function register(email: string, displayName: string) {
  const res = await call<{ user: { id: string } }>("/auth/register", null, {
    method: "POST",
    body: JSON.stringify({ email, password: PASSWORD, displayName }),
  });
  return { status: res.status, cookie: res.cookie!, userId: res.body?.user?.id };
}

async function main() {
  const stamp = Date.now();
  const emailA = `invite-a-${stamp}@example.com`;
  const emailB = `invite-b-${stamp}@example.com`;
  const emailC = `invite-c-${stamp}@example.com`;

  const a = await register(emailA, "An");
  check("first account registers", a.status === 201, `status ${a.status}`);

  const space = await call<{ space: { id: string } }>("/spaces", a.cookie, {
    method: "POST",
    body: JSON.stringify({ name: "Invite Check", startDate: "2025-01-01" }),
  });
  check("creating a space works", space.status === 201, `status ${space.status}`);
  const spaceId = space.body?.space?.id;

  const second = await call("/spaces", a.cookie, {
    method: "POST",
    body: JSON.stringify({ name: "A second one" }),
  });
  check("one person cannot hold two spaces", second.status === 409, `status ${second.status}`);

  // A moment only the members should ever see.
  const moment = await call<{ id: string }>("/moments", a.cookie, {
    method: "POST",
    body: JSON.stringify({
      caption: "Điều đầu tiên chúng mình lưu lại",
      occurredAt: new Date().toISOString(),
      timezone: "Asia/Bangkok",
    }),
  });
  check("the first moment saves", moment.status === 201, `status ${moment.status}`);

  // --- invite ------------------------------------------------------------
  const invite = await call<{ invite: { token: string; url: string } }>(
    "/spaces/current/invites",
    a.cookie,
    { method: "POST" },
  );
  check("an invite is minted", invite.status === 201, `status ${invite.status}`);
  const token = invite.body?.invite?.token;

  const stored = await db.invite.findFirst({ where: { spaceId }, orderBy: { createdAt: "desc" } });
  check("the raw token is never stored", stored?.tokenHash !== token && Boolean(stored?.tokenHash));

  const peek = await call<{ valid: boolean; spaceName?: string }>(`/invites/${token}`, null);
  check("the invite page shows the space name", peek.body?.valid === true && peek.body.spaceName === "Invite Check");

  const b = await register(emailB, "Bình");
  const accept = await call(`/invites/${token}/accept`, b.cookie, { method: "POST" });
  check("the partner joins", accept.status === 200, `status ${accept.status}`);

  // --- both see the same thing -------------------------------------------
  const bTimeline = await call<{ items: { id: string; caption: string }[] }>("/moments", b.cookie);
  check(
    "both people see the same moment",
    bTimeline.body?.items?.[0]?.id === moment.body?.id,
    `partner sees ${bTimeline.body?.items?.length ?? 0} moment(s)`,
  );

  const bHome = await call<{ spaceName: string; daysTogether: number | null }>("/home?tz=Asia/Bangkok", b.cookie);
  check("the partner lands in the same space", bHome.body?.spaceName === "Invite Check");
  check("the day counter is set", (bHome.body?.daysTogether ?? 0) > 0, `${bHome.body?.daysTogether} days`);

  // --- the invite is spent ------------------------------------------------
  const c = await register(emailC, "Chi");
  const reuse = await call(`/invites/${token}/accept`, c.cookie, { method: "POST" });
  check("the invite cannot be used twice", reuse.status === 409, `status ${reuse.status}`);

  const another = await call("/spaces/current/invites", a.cookie, { method: "POST" });
  check("a full space refuses new invites", another.status === 409, `status ${another.status}`);

  // --- leaving hands over ownership --------------------------------------
  const leave = await call("/spaces/current/leave", a.cookie, { method: "POST" });
  check("a member can leave", leave.status === 204, `status ${leave.status}`);

  const bRole = await call<{ space: { role: string } | null }>("/me", b.cookie);
  check("ownership passes to whoever remains", bRole.body?.space?.role === "OWNER", `role ${bRole.body?.space?.role}`);

  const aAfter = await call<{ items: unknown[] }>("/moments", a.cookie);
  check("the person who left loses access", aAfter.status === 403, `status ${aAfter.status}`);

  const bStill = await call<{ items: unknown[] }>("/moments", b.cookie);
  check("their moments stay for the partner", (bStill.body?.items?.length ?? 0) === 1);

  // --- clean up -----------------------------------------------------------
  for (const email of [emailA, emailB, emailC]) {
    const user = await db.user.findUnique({ where: { email } });
    if (!user) continue;
    const membership = await db.coupleMember.findFirst({ where: { userId: user.id } });
    if (membership) await db.coupleSpace.delete({ where: { id: membership.spaceId } }).catch(() => {});
  }
  if (spaceId) await db.coupleSpace.delete({ where: { id: spaceId } }).catch(() => {});
  await db.user.deleteMany({ where: { email: { in: [emailA, emailB, emailC] } } });

  console.log(failures === 0 ? "\nAll invite checks passed." : `\n${failures} check(s) FAILED.`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
