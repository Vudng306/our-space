import { handler, json, readJson } from "@/lib/api";
import { limit } from "@/lib/ratelimit";
import { assertSameOrigin, createSession } from "@/lib/session";
import { authenticate } from "@/server/accounts";

export const runtime = "nodejs";

export const POST = handler(async (req) => {
  assertSameOrigin(req);
  limit(req, "login");

  const user = await authenticate(await readJson(req));
  await createSession(user.id, req.headers.get("user-agent"));
  return json({ user });
});
