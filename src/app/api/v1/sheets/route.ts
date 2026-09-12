import { handler, json, readJson } from "@/lib/api";
import { assertSameOrigin } from "@/lib/session";
import { requireSpace } from "@/lib/space";
import { getSheets, saveMySheet } from "@/server/sheets";

export const runtime = "nodejs";

/** Your sheet, plus your partner if the exchange has happened. */
export const GET = handler(async () => {
  const ctx = await requireSpace();
  return json(await getSheets(ctx));
});

/** Saves a draft of your own sheet. There is no way to write anyone else. */
export const PATCH = handler(async (req) => {
  assertSameOrigin(req);
  const ctx = await requireSpace();
  return json({ sheet: await saveMySheet(ctx, await readJson(req)) });
});
