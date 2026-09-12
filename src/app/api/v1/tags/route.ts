import { handler, json } from "@/lib/api";
import { requireSpace } from "@/lib/space";
import { listSpaceTags } from "@/server/moments";

export const runtime = "nodejs";

export const GET = handler(async () => {
  const ctx = await requireSpace();
  return json({ tags: await listSpaceTags(ctx) });
});
