import { z } from "zod";
import { handler, json, noContent, readJson } from "@/lib/api";
import { assertSameOrigin } from "@/lib/session";
import { requireSpace } from "@/lib/space";
import { storage } from "@/lib/storage";
import { deleteSpace, updateSpace } from "@/server/spaces";

export const runtime = "nodejs";

export const GET = handler(async () => {
  const ctx = await requireSpace();
  return json({
    space: { ...ctx.space, startDate: ctx.space.startDate?.toISOString().slice(0, 10) ?? null },
    role: ctx.role,
    members: ctx.members,
  });
});

export const PATCH = handler(async (req) => {
  assertSameOrigin(req);
  const ctx = await requireSpace();
  const space = await updateSpace(ctx, await readJson(req));
  return json({ space: { id: space.id, name: space.name } });
});

const deleteSchema = z.object({ confirmName: z.string().min(1) });

export const DELETE = handler(async (req) => {
  assertSameOrigin(req);
  const ctx = await requireSpace();
  const { confirmName } = deleteSchema.parse(await readJson(req));
  const keys = await deleteSpace(ctx, confirmName);
  for (const key of keys) await storage.delete(key);
  return noContent();
});
