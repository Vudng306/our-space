"use client";

import { useCallback, useState } from "react";
import clsx from "clsx";
import type { MemoryDTO } from "@/server/memories";
import type { MomentDTO } from "@/server/moments";
import { api, ApiError, mediaUrl } from "@/lib/client";
import { useAsyncData } from "@/lib/useAsyncData";
import MediaUploader, { type UploadedMedia } from "./MediaUploader";
import { ErrorState, Modal, Skeleton } from "./ui";
import { formatDayShort } from "./moments";

export type MemoryDraft = MemoryDTO & { momentIds?: string[] };

export default function MemoryEditor({
  open,
  memory,
  onClose,
  onSaved,
}: {
  open: boolean;
  memory?: MemoryDraft | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  // Mounted only while open, and keyed on the memory, so the form always
  // starts from the right values without an effect resetting them.
  if (!open) return null;
  return (
    <MemoryForm key={memory?.id ?? "new"} memory={memory} onClose={onClose} onSaved={onSaved} />
  );
}

function MemoryForm({
  memory,
  onClose,
  onSaved,
}: {
  memory?: MemoryDraft | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = Boolean(memory);

  const [title, setTitle] = useState(memory?.title ?? "");
  const [description, setDescription] = useState(memory?.description ?? "");
  const [startDate, setStartDate] = useState(memory?.startDate ?? new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(memory?.endDate ?? "");
  const [cover, setCover] = useState<UploadedMedia[]>(
    memory?.coverMediaId
      ? [{ id: memory.coverMediaId, width: 1, height: 1, mimeType: "image/jpeg" }]
      : [],
  );
  const [linked, setLinked] = useState<string[]>(memory?.momentIds ?? []);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      startDate,
      endDate: endDate || null,
      coverMediaId: cover[0]?.id ?? null,
      momentIds: linked,
    };
    try {
      if (editing && memory) await api.patch(`/memories/${memory.id}`, payload);
      else await api.post("/memories", payload);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save this memory.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={editing ? "Edit memory" : "New memory"}>
      <form onSubmit={save} className="space-y-4">
        {error ? <ErrorState message={error} /> : null}

        <div>
          <label className="label" htmlFor="memory-title">
            Title
          </label>
          <input
            id="memory-title"
            className="field"
            required
            maxLength={120}
            placeholder="First trip together"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="memory-start">
              Date
            </label>
            <input
              id="memory-start"
              type="date"
              className="field"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="memory-end">
              Until (optional)
            </label>
            <input
              id="memory-end"
              type="date"
              className="field"
              min={startDate}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="memory-description">
            The story (optional)
          </label>
          <textarea
            id="memory-description"
            className="field min-h-24 resize-y"
            maxLength={4000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <MediaUploader media={cover} onChange={setCover} max={1} label="Cover photo" addLabel="Choose a cover" />

        <MomentPicker selected={linked} onChange={setLinked} />

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn btn-quiet" disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save memory"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Ties existing moments to a milestone, so the memory carries its evidence. */
function MomentPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const fetcher = useCallback(() => api.get<{ items: MomentDTO[] }>("/moments?limit=40"), []);
  const { data, error } = useAsyncData(fetcher);
  const items = error ? [] : (data?.items ?? null);

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  return (
    <div>
      <span className="label">Moments to include (optional)</span>
      {items === null ? (
        <Skeleton className="h-20 w-full" />
      ) : items.length === 0 ? (
        <p className="text-sm text-[var(--color-ink-faint)]">
          Once you have saved some moments you can attach them here.
        </p>
      ) : (
        <ul className="max-h-48 space-y-1 overflow-y-auto rounded-[var(--radius-drawn)] border border-[var(--color-line)] p-1.5">
          {items.map((m) => {
            const active = selected.includes(m.id);
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => toggle(m.id)}
                  aria-pressed={active}
                  className={clsx(
                    "flex w-full items-center gap-2 rounded-[10px] p-1.5 text-left text-sm transition-colors",
                    active ? "bg-[var(--color-rose-soft)]" : "hover:bg-[var(--color-paper-deep)]",
                  )}
                >
                  {m.media[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element -- authenticated media proxy
                    <img
                      src={mediaUrl(m.media[0].id, "thumb")}
                      alt=""
                      className="h-9 w-9 shrink-0 rounded object-cover"
                    />
                  ) : (
                    <span className="h-9 w-9 shrink-0 rounded bg-[var(--color-paper-deep)]" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[var(--color-ink)]">
                      {m.caption?.slice(0, 60) || "No words"}
                    </span>
                    <span className="block text-xs text-[var(--color-ink-faint)]">
                      {formatDayShort(m.localDate)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
