import { env } from "@/lib/env";
import MomentEditor from "@/components/MomentEditor";
import { requireFeature } from "@/lib/requireFeature";

export const dynamic = "force-dynamic";
export const metadata = { title: "Add a moment · Our Space" };

export default function NewMomentPage() {
  requireFeature("moments");

  return <MomentEditor maxPhotos={env.MAX_PHOTOS_PER_MOMENT} />;
}
