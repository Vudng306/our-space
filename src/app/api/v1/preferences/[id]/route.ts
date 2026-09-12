import { handler, json, noContent, readJson } from "@/lib/api";
import { assertSameOrigin } from "@/lib/session";
import { requireSpace } from "@/lib/space";
import { deletePreference, updatePreference } from "@/server/aboutUs";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler(async (req: Request, p: Ctx) => {
  assertSameOrigin(req);
  const ctx = await requireSpace();
  return json(await updatePreference(ctx, (await p.params).id, await readJson(req)));
});

export const DELETE = handler(async (req: Request, p: Ctx) => {
  assertSameOrigin(req);
  const ctx = await requireSpace();
  await deletePreference(ctx, (await p.params).id);
  return noContent();
});
