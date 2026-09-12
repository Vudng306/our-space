import { handler, json, readJson } from "@/lib/api";
import { assertSameOrigin, requireUser } from "@/lib/session";
import { createSpace } from "@/server/spaces";

export const runtime = "nodejs";

export const POST = handler(async (req) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const space = await createSpace(user, await readJson(req));
  return json({ space: { id: space.id, name: space.name } }, 201);
});
