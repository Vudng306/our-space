import { handler, json, readJson } from "@/lib/api";
import { isValidTimeZone, todayKey } from "@/lib/datetime";
import { assertSameOrigin } from "@/lib/session";
import { requireSpace } from "@/lib/space";
import { createImportantDate, listImportantDates } from "@/server/aboutUs";

export const runtime = "nodejs";

function zoneOf(req: Request) {
  const tz = new URL(req.url).searchParams.get("tz");
  return tz && isValidTimeZone(tz) ? tz : "UTC";
}

export const GET = handler(async (req) => {
  const ctx = await requireSpace();
  return json({ items: await listImportantDates(ctx, todayKey(zoneOf(req))) });
});

export const POST = handler(async (req) => {
  assertSameOrigin(req);
  const ctx = await requireSpace();
  return json(await createImportantDate(ctx, await readJson(req), todayKey(zoneOf(req))), 201);
});
