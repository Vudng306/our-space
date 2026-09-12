import BucketListView from "./BucketListView";
import { requireFeature } from "@/lib/requireFeature";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bucket list · Our Space" };

export default function BucketListPage() {
  requireFeature("bucketList");

  return <BucketListView />;
}
