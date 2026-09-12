import { handler, json, readJson } from "@/lib/api";
import { assertSameOrigin } from "@/lib/session";
import { requireSpace } from "@/lib/space";
import { createMemory, listMemories } from "@/server/memories";

export const runtime = "nodejs";

export const GET = handler(async () => {
  const ctx = await requireSpace();
  return json({ items: await listMemories(ctx) });
});

export const POST = handler(async (req) => {
  assertSameOrigin(req);
  const ctx = await requireSpace();
  return json(await createMemory(ctx, await readJson(req)), 201);
});
