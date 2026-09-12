import { notFound } from "next/navigation";
import { env } from "@/lib/env";
import { requireSpace } from "@/lib/space";
import { getMoment } from "@/server/moments";
import MomentEditor from "@/components/MomentEditor";
import { requireFeature } from "@/lib/requireFeature";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit moment · Our Space" };

export default async function EditMomentPage({ params }: { params: Promise<{ id: string }> }) {
  requireFeature("moments");

  const { id } = await params;
  const ctx = await requireSpace();

  const moment = await getMoment(ctx, id).catch(() => null);
  if (!moment) notFound();

  return <MomentEditor moment={moment} maxPhotos={env.MAX_PHOTOS_PER_MOMENT} />;
}
