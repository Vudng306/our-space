import { handler, json } from "@/lib/api";
import { requireSpace } from "@/lib/space";
import { listDeletedMoments } from "@/server/moments";

export const runtime = "nodejs";

/** The 30-day grace window, so a mistaken delete can be undone. */
export const GET = handler(async () => {
  const ctx = await requireSpace();
  return json({ items: await listDeletedMoments(ctx) });
});
