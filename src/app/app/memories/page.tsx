import MemoriesView from "./MemoriesView";
import { requireFeature } from "@/lib/requireFeature";

export const dynamic = "force-dynamic";
export const metadata = { title: "Memories · Our Space" };

export default function MemoriesPage() {
  requireFeature("memories");

  return <MemoriesView />;
}
