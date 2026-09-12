import { Suspense } from "react";
import { MomentSkeletonList } from "@/components/ui";
import SearchView from "./SearchView";
import { requireFeature } from "@/lib/requireFeature";

export const dynamic = "force-dynamic";
export const metadata = { title: "Search · Our Space" };

export default function SearchPage() {
  requireFeature("search");

  return (
    <Suspense fallback={<MomentSkeletonList count={1} />}>
      <SearchView />
    </Suspense>
  );
}
