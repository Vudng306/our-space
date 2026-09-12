import { handler, json, readJson } from "@/lib/api";
import { limit } from "@/lib/ratelimit";
import { assertSameOrigin, createSession } from "@/lib/session";
import { registerUser } from "@/server/accounts";
import { acceptInvite } from "@/server/spaces";
import { registerSchema } from "@/lib/validation";

export const runtime = "nodejs";

export const POST = handler(async (req) => {
  assertSameOrigin(req);
  limit(req, "register");

  const body = await readJson(req);
  const parsed = registerSchema.parse(body);
  const user = await registerUser(parsed);
  await createSession(user.id, req.headers.get("user-agent"));

  // Signing up through an invite link joins the space in the same step.
  let joinedSpace = false;
  if (parsed.inviteToken) {
    await acceptInvite(user, parsed.inviteToken);
    joinedSpace = true;
  }

  return json({ user, joinedSpace }, 201);
});
