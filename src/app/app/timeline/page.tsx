import { Suspense } from "react";
import { MomentSkeletonList } from "@/components/ui";
import TimelineView from "./TimelineView";
import { requireFeature } from "@/lib/requireFeature";

export const dynamic = "force-dynamic";
export const metadata = { title: "Timeline · Our Space" };

export default function TimelinePage() {
  requireFeature("timeline");

  return (
    <Suspense fallback={<MomentSkeletonList />}>
      <TimelineView />
    </Suspense>
  );
}
