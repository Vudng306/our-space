import { handler, json } from "@/lib/api";
import { limit } from "@/lib/ratelimit";
import { requireSpace } from "@/lib/space";
import { searchQuerySchema } from "@/lib/validation";
import { search } from "@/server/home";

export const runtime = "nodejs";

export const GET = handler(async (req) => {
  const ctx = await requireSpace();
  limit(req, "search", ctx.user.id);
  const { q, limit: max } = searchQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return json(await search(ctx, q, max));
});
