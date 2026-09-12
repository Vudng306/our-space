import CalendarView from "./CalendarView";
import { requireFeature } from "@/lib/requireFeature";

export const dynamic = "force-dynamic";
export const metadata = { title: "Calendar · Our Space" };

export default function CalendarPage() {
  requireFeature("calendar");

  return <CalendarView />;
}
