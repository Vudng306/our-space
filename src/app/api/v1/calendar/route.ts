import { handler, json } from "@/lib/api";
import { requireSpace } from "@/lib/space";
import { calendarQuerySchema } from "@/lib/validation";
import { getCalendar } from "@/server/home";

export const runtime = "nodejs";

export const GET = handler(async (req) => {
  const ctx = await requireSpace();
  const { from, to } = calendarQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return json({ days: await getCalendar(ctx, from, to) });
});
