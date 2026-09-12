import { notFound } from "next/navigation";
import { requireSpace } from "@/lib/space";
import { getMemory } from "@/server/memories";
import MemoryDetail from "./MemoryDetail";
import { requireFeature } from "@/lib/requireFeature";

export const dynamic = "force-dynamic";
export const metadata = { title: "Memory · Our Space" };

export default async function MemoryPage({ params }: { params: Promise<{ id: string }> }) {
  requireFeature("memories");

  const { id } = await params;
  const ctx = await requireSpace();

  const memory = await getMemory(ctx, id).catch(() => null);
  if (!memory) notFound();

  return <MemoryDetail memory={memory} />;
}
