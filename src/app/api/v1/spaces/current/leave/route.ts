import { handler, noContent } from "@/lib/api";
import { assertSameOrigin } from "@/lib/session";
import { requireSpace } from "@/lib/space";
import { leaveSpace } from "@/server/spaces";

export const runtime = "nodejs";

export const POST = handler(async (req) => {
  assertSameOrigin(req);
  const ctx = await requireSpace();
  await leaveSpace(ctx);
  return noContent();
});
