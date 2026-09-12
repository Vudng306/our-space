import { handler, json } from "@/lib/api";
import { requireSpace } from "@/lib/space";
import { isValidTimeZone, todayKey } from "@/lib/datetime";
import { getHomeSummary } from "@/server/home";

export const runtime = "nodejs";

export const GET = handler(async (req) => {
  const ctx = await requireSpace();
  const tz = new URL(req.url).searchParams.get("tz");
  const zone = tz && isValidTimeZone(tz) ? tz : "UTC";
  return json(await getHomeSummary(ctx, todayKey(zone)));
});
