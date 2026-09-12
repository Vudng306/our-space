import { handler, json, readJson } from "@/lib/api";
import { assertSameOrigin, createSession, requireUser } from "@/lib/session";
import { changePassword } from "@/server/accounts";

export const runtime = "nodejs";

export const POST = handler(async (req) => {
  assertSameOrigin(req);
  const user = await requireUser();

  await changePassword(user, await readJson(req));
  // changePassword revokes every session, so issue a fresh one for this device.
  await createSession(user.id, req.headers.get("user-agent"));
  return json({ ok: true });
});
