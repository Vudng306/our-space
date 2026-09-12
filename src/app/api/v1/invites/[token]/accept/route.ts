import { handler, json } from "@/lib/api";
import { limit } from "@/lib/ratelimit";
import { assertSameOrigin, requireUser } from "@/lib/session";
import { acceptInvite } from "@/server/spaces";

export const runtime = "nodejs";

export const POST = handler(async (req: Request, ctxParam: { params: Promise<{ token: string }> }) => {
  assertSameOrigin(req);
  limit(req, "inviteAccept");

  const user = await requireUser();
  const { token } = await ctxParam.params;
  const space = await acceptInvite(user, token);
  return json({ space: { id: space.id, name: space.name } });
});
