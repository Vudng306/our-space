import { handler, json, readJson } from "@/lib/api";
import { limit } from "@/lib/ratelimit";
import { assertSameOrigin } from "@/lib/session";
import { requestPasswordReset } from "@/server/accounts";

export const runtime = "nodejs";

export const POST = handler(async (req) => {
  assertSameOrigin(req);
  limit(req, "passwordReset");

  const result = await requestPasswordReset(await readJson(req));
  // The response never reveals whether the address had an account.
  return json({ ok: true, ...result });
});
