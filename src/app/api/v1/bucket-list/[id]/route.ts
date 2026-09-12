import { handler, noContent, readJson } from "@/lib/api";
import { assertSameOrigin } from "@/lib/session";
import { requireSpace } from "@/lib/space";
import { deleteBucketItem, updateBucketItem } from "@/server/aboutUs";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler(async (req: Request, p: Ctx) => {
  assertSameOrigin(req);
  const ctx = await requireSpace();
  await updateBucketItem(ctx, (await p.params).id, await readJson(req));
  return noContent();
});

export const DELETE = handler(async (req: Request, p: Ctx) => {
  assertSameOrigin(req);
  const ctx = await requireSpace();
  await deleteBucketItem(ctx, (await p.params).id);
  return noContent();
});
