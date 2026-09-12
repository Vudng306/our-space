import { handler, json, readJson } from "@/lib/api";
import { limit } from "@/lib/ratelimit";
import { assertSameOrigin } from "@/lib/session";
import { requireSpace } from "@/lib/space";
import { momentQuerySchema } from "@/lib/validation";
import { createMoment, listMoments } from "@/server/moments";

export const runtime = "nodejs";

export const GET = handler(async (req) => {
  const ctx = await requireSpace();
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const query = momentQuerySchema.parse(params);
  return json(await listMoments(ctx, query));
});

export const POST = handler(async (req) => {
  assertSameOrigin(req);
  const ctx = await requireSpace();
  limit(req, "write", ctx.user.id);
  return json(await createMoment(ctx, await readJson(req)), 201);
});
