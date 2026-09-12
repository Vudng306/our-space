"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import type { MemoryDetailDTO } from "@/server/memories";
import { api, ApiError, mediaUrl } from "@/lib/client";
import { ConfirmDialog, ErrorState, SectionHeading } from "@/components/ui";
import { MomentCard } from "@/components/moments";
import { formatDayShort } from "@/lib/formatDate";
import MemoryEditor from "@/components/MemoryEditor";

export default function MemoryDetail({ memory }: { memory: MemoryDetailDTO }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await api.del(`/memories/${memory.id}`);
      router.replace("/app/memories");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete this memory.");
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => router.back()} className="btn btn-ghost -ml-2">
          <ArrowLeft size={18} aria-hidden />
          Back
        </button>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setEditing(true)} className="btn btn-ghost">
            <Pencil size={16} aria-hidden />
            Edit
          </button>
          <button type="button" onClick={() => setConfirming(true)} className="btn btn-ghost">
            <Trash2 size={16} aria-hidden />
            Delete
          </button>
        </div>
      </div>

      {error ? <ErrorState message={error} /> : null}

      <article className="card overflow-hidden">
        {memory.coverMediaId ? (
          // eslint-disable-next-line @next/next/no-img-element -- authenticated media proxy
          <img src={mediaUrl(memory.coverMediaId)} alt="" className="max-h-96 w-full object-cover" />
        ) : null}

        <div className="space-y-3 p-5">
          <h1 className="display text-2xl">{memory.title}</h1>
          <p className="text-sm text-[var(--color-ink-soft)]">
            {formatDayShort(memory.startDate)}
            {memory.endDate ? ` – ${formatDayShort(memory.endDate)}` : ""}
          </p>
          {memory.description ? (
            <p className="whitespace-pre-wrap leading-relaxed text-[var(--color-ink)]">
              {memory.description}
            </p>
          ) : null}
        </div>
      </article>

      {memory.moments.length > 0 ? (
        <section>
          <SectionHeading title={`Moments from this (${memory.moments.length})`} />
          <div className="space-y-4">
            {memory.moments.map((m) => (
              <MomentCard key={m.id} moment={m} showDate />
            ))}
          </div>
        </section>
      ) : null}

      <MemoryEditor
        open={editing}
        memory={{ ...memory, momentIds: memory.moments.map((m) => m.id) }}
        onClose={() => setEditing(false)}
        onSaved={() => router.refresh()}
      />

      <ConfirmDialog
        open={confirming}
        title="Delete this memory?"
        body="The moments attached to it stay in your timeline — only the memory itself is removed."
        busy={busy}
        onCancel={() => setConfirming(false)}
        onConfirm={remove}
      />
    </div>
  );
}
