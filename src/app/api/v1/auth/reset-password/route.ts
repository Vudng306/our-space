import { handler, json, readJson } from "@/lib/api";
import { limit } from "@/lib/ratelimit";
import { assertSameOrigin } from "@/lib/session";
import { resetPassword } from "@/server/accounts";

export const runtime = "nodejs";

export const POST = handler(async (req) => {
  assertSameOrigin(req);
  limit(req, "passwordReset");

  await resetPassword(await readJson(req));
  return json({ ok: true });
});
