import { handler, noContent } from "@/lib/api";
import { assertSameOrigin, destroyCurrentSession } from "@/lib/session";

export const runtime = "nodejs";

export const POST = handler(async (req) => {
  assertSameOrigin(req);
  await destroyCurrentSession();
  return noContent();
});
