import { handler, json, readJson } from "@/lib/api";
import { assertSameOrigin } from "@/lib/session";
import { requireSpace } from "@/lib/space";
import { createBucketItem, listBucketItems } from "@/server/aboutUs";

export const runtime = "nodejs";

export const GET = handler(async () => {
  const ctx = await requireSpace();
  return json({ items: await listBucketItems(ctx) });
});

export const POST = handler(async (req) => {
  assertSameOrigin(req);
  const ctx = await requireSpace();
  return json(await createBucketItem(ctx, await readJson(req)), 201);
});
