import { handler, json, readJson } from "@/lib/api";
import { assertSameOrigin } from "@/lib/session";
import { requireSpace } from "@/lib/space";
import { updatePersonProfile } from "@/server/accounts";

export const runtime = "nodejs";

/** Edits the shared "about this person" details for either member. */
export const PATCH = handler(async (req: Request, p: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const ctx = await requireSpace();
  const { id } = await p.params;
  return json({ person: await updatePersonProfile(ctx, id, await readJson(req)) });
});
