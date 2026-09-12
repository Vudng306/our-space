import { handler, noContent } from "@/lib/api";
import { assertSameOrigin } from "@/lib/session";
import { requireSpace } from "@/lib/space";
import { restoreMoment } from "@/server/moments";

export const runtime = "nodejs";

export const POST = handler(async (req: Request, p: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const ctx = await requireSpace();
  const { id } = await p.params;
  await restoreMoment(ctx, id);
  return noContent();
});
