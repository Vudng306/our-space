import { handler, json } from "@/lib/api";
import { assertSameOrigin } from "@/lib/session";
import { requireSpace } from "@/lib/space";
import { completeMySheet } from "@/server/sheets";

export const runtime = "nodejs";

/** Hands the sheet in, which is what unlocks the other one. */
export const POST = handler(async (req) => {
  assertSameOrigin(req);
  const ctx = await requireSpace();
  return json({ sheet: await completeMySheet(ctx) });
});
