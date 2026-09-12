import { handler, json } from "@/lib/api";
import { limit } from "@/lib/ratelimit";
import { assertSameOrigin } from "@/lib/session";
import { requireSpace } from "@/lib/space";
import { createInvite, listInvites } from "@/server/spaces";

export const runtime = "nodejs";

export const GET = handler(async () => {
  const ctx = await requireSpace();
  return json({ invites: await listInvites(ctx) });
});

export const POST = handler(async (req) => {
  assertSameOrigin(req);
  const ctx = await requireSpace();
  limit(req, "invite", ctx.user.id);

  // The raw token is returned here and nowhere else.
  const invite = await createInvite(ctx);
  return json({ invite }, 201);
});
