import { handler, json, readJson } from "@/lib/api";
import { assertSameOrigin } from "@/lib/session";
import { requireSpace } from "@/lib/space";
import { preferenceCategorySchema } from "@/lib/validation";
import { createPreference, listPreferences } from "@/server/aboutUs";

export const runtime = "nodejs";

export const GET = handler(async (req) => {
  const ctx = await requireSpace();
  const params = new URL(req.url).searchParams;
  const rawCategory = params.get("category");
  const category = rawCategory ? preferenceCategorySchema.parse(rawCategory) : undefined;
  return json({
    items: await listPreferences(ctx, {
      personUserId: params.get("personUserId") ?? undefined,
      category,
    }),
  });
});

export const POST = handler(async (req) => {
  assertSameOrigin(req);
  const ctx = await requireSpace();
  return json(await createPreference(ctx, await readJson(req)), 201);
});
