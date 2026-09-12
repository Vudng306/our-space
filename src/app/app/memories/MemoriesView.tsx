"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Heart, Plus } from "lucide-react";
import type { MemoryDTO } from "@/server/memories";
import { api, mediaUrl } from "@/lib/client";
import { useAsyncData } from "@/lib/useAsyncData";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { formatDayShort } from "@/lib/formatDate";
import MemoryEditor from "@/components/MemoryEditor";

export default function MemoriesView() {
  const [editorOpen, setEditorOpen] = useState(false);

  const fetcher = useCallback(() => api.get<{ items: MemoryDTO[] }>("/memories"), []);
  const { data, error, reload } = useAsyncData(fetcher, "Could not load your memories.");
  const items = data?.items ?? null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="display text-xl">Memories</h1>
          <p className="text-sm text-[var(--color-ink-soft)]">
            The milestones, kept apart from the everyday.
          </p>
        </div>
        <button type="button" onClick={() => setEditorOpen(true)} className="btn btn-primary shrink-0">
          <Plus size={16} aria-hidden />
          New
        </button>
      </div>

      {error ? <ErrorState message={error} onRetry={reload} /> : null}

      {error ? null : items === null ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Heart size={28} aria-hidden />}
          title="No memories saved yet."
          hint="First date, first trip, a graduation — the ones you want to find again without scrolling."
          action={
            <button type="button" onClick={() => setEditorOpen(true)} className="btn btn-primary">
              <Plus size={16} aria-hidden />
              Add the first one
            </button>
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {items.map((m) => (
            <li key={m.id}>
              <Link
                href={`/app/memories/${m.id}`}
                className="card fade-up block h-full overflow-hidden transition-shadow hover:shadow-[var(--shadow-lift)]"
              >
                {m.coverMediaId ? (
                  // eslint-disable-next-line @next/next/no-img-element -- authenticated media proxy
                  <img
                    src={mediaUrl(m.coverMediaId, "thumb")}
                    alt=""
                    loading="lazy"
                    className="h-40 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-40 items-center justify-center bg-[var(--color-rose-soft)]">
                    <Heart size={26} className="text-[var(--color-rose)]" aria-hidden />
                  </div>
                )}

                <div className="space-y-1 p-4">
                  <p className="display text-base text-[var(--color-ink)]">{m.title}</p>
                  <p className="text-sm text-[var(--color-ink-faint)]">
                    {formatDayShort(m.startDate)}
                    {m.endDate ? ` – ${formatDayShort(m.endDate)}` : ""}
                  </p>
                  {m.momentCount > 0 ? (
                    <p className="text-xs text-[var(--color-ink-faint)]">
                      {m.momentCount} {m.momentCount === 1 ? "moment" : "moments"} attached
                    </p>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <MemoryEditor open={editorOpen} onClose={() => setEditorOpen(false)} onSaved={reload} />
    </div>
  );
}
