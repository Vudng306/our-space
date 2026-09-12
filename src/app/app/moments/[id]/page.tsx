import { notFound } from "next/navigation";
import { requireSpace } from "@/lib/space";
import { getMoment } from "@/server/moments";
import MomentDetail from "./MomentDetail";
import { requireFeature } from "@/lib/requireFeature";

export const dynamic = "force-dynamic";
export const metadata = { title: "Moment · Our Space" };

export default async function MomentPage({ params }: { params: Promise<{ id: string }> }) {
  requireFeature("moments");

  const { id } = await params;
  const ctx = await requireSpace();

  // A moment from another space resolves to a 404 here, not a 403 — there is
  // nothing to confirm to somebody guessing ids (spec §8).
  const moment = await getMoment(ctx, id).catch(() => null);
  if (!moment) notFound();

  return <MomentDetail moment={moment} canEdit={moment.author.id === ctx.user.id} />;
}
