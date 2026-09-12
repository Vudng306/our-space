import { handler, json, noContent, readJson } from "@/lib/api";
import { assertSameOrigin } from "@/lib/session";
import { requireSpace } from "@/lib/space";
import { deleteMemory, getMemory, updateMemory } from "@/server/memories";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: Request, p: Ctx) => {
  const ctx = await requireSpace();
  return json(await getMemory(ctx, (await p.params).id));
});

export const PATCH = handler(async (req: Request, p: Ctx) => {
  assertSameOrigin(req);
  const ctx = await requireSpace();
  return json(await updateMemory(ctx, (await p.params).id, await readJson(req)));
});

export const DELETE = handler(async (req: Request, p: Ctx) => {
  assertSameOrigin(req);
  const ctx = await requireSpace();
  await deleteMemory(ctx, (await p.params).id);
  return noContent();
});
