import { handler, noContent } from "@/lib/api";
import { assertSameOrigin } from "@/lib/session";
import { requireSpace } from "@/lib/space";
import { revokeInvite } from "@/server/spaces";

export const runtime = "nodejs";

export const DELETE = handler(async (req: Request, ctxParam: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const ctx = await requireSpace();
  const { id } = await ctxParam.params;
  await revokeInvite(ctx, id);
  return noContent();
});
