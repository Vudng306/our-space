import { handler, json, noContent, readJson } from "@/lib/api";
import { assertSameOrigin } from "@/lib/session";
import { requireSpace } from "@/lib/space";
import { deleteMoment, getMoment, updateMoment } from "@/server/moments";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: Request, p: Ctx) => {
  const ctx = await requireSpace();
  const { id } = await p.params;
  return json(await getMoment(ctx, id));
});

export const PATCH = handler(async (req: Request, p: Ctx) => {
  assertSameOrigin(req);
  const ctx = await requireSpace();
  const { id } = await p.params;
  return json(await updateMoment(ctx, id, await readJson(req)));
});

export const DELETE = handler(async (req: Request, p: Ctx) => {
  assertSameOrigin(req);
  const ctx = await requireSpace();
  const { id } = await p.params;
  await deleteMoment(ctx, id);
  return noContent();
});
