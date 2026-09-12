"use client";

import { useCallback, useState } from "react";
import clsx from "clsx";
import { ListChecks, Plus, Trash2 } from "lucide-react";
import type { BucketItemDTO } from "@/server/aboutUs";
import { api, ApiError } from "@/lib/client";
import { useAsyncData } from "@/lib/useAsyncData";
import { ConfirmDialog, EmptyState, ErrorState, Modal, Skeleton } from "@/components/ui";
import { formatDayShort } from "@/lib/formatDate";

const STATUSES = [
  { value: "WANT_TO_DO", label: "Want to do" },
  { value: "PLANNED", label: "Planned" },
  { value: "DONE", label: "Done" },
] as const;

export default function BucketListView() {
  const [adding, setAdding] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<BucketItemDTO | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetcher = useCallback(() => api.get<{ items: BucketItemDTO[] }>("/bucket-list"), []);
  const { data, error, reload, mutate } = useAsyncData(fetcher, "Could not load the bucket list.");
  const items = data?.items ?? null;

  async function setStatus(item: BucketItemDTO, status: string) {
    // Optimistic: ticking something off should feel instant.
    mutate((current) => ({
      items: current.items.map((i) =>
        i.id === item.id ? { ...i, status: status as BucketItemDTO["status"] } : i,
      ),
    }));
    setActionError(null);
    try {
      await api.patch(`/bucket-list/${item.id}`, { status });
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not update that.");
    } finally {
      reload();
    }
  }

  async function remove() {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      await api.del(`/bucket-list/${pendingDelete.id}`);
      reload();
    } finally {
      setBusy(false);
      setPendingDelete(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="display text-xl">Bucket list</h1>
          <p className="text-sm text-[var(--color-ink-soft)]">Things to do together, eventually.</p>
        </div>
        <button type="button" onClick={() => setAdding(true)} className="btn btn-primary shrink-0">
          <Plus size={16} aria-hidden />
          Add
        </button>
      </div>

      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      {actionError ? <ErrorState message={actionError} /> : null}

      {error ? null : items === null ? (
        <Skeleton className="h-40 w-full" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<ListChecks size={28} aria-hidden />}
          title="Add something you want to do together."
          hint="Big or small — a trip, a restaurant, learning to make bread."
          action={
            <button type="button" onClick={() => setAdding(true)} className="btn btn-primary">
              <Plus size={16} aria-hidden />
              Add the first one
            </button>
          }
        />
      ) : (
        <div className="space-y-6">
          {STATUSES.map((status) => {
            const group = items.filter((i) => i.status === status.value);
            if (group.length === 0) return null;
            return (
              <section key={status.value}>
                <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">
                  {status.label} ({group.length})
                </h2>
                <ul className="card divide-y divide-[var(--color-line)]">
                  {group.map((item) => (
                    <li key={item.id} className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <p
                            className={clsx(
                              "text-[0.9375rem]",
                              item.status === "DONE"
                                ? "text-[var(--color-ink-faint)] line-through"
                                : "text-[var(--color-ink)]",
                            )}
                          >
                            {item.title}
                          </p>
                          {item.note ? (
                            <p className="mt-0.5 text-sm text-[var(--color-ink-soft)]">{item.note}</p>
                          ) : null}
                          {item.targetDate ? (
                            <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">
                              Aiming for {formatDayShort(item.targetDate)}
                            </p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => setPendingDelete(item)}
                          className="btn btn-ghost shrink-0 p-1.5"
                          aria-label={`Remove ${item.title}`}
                        >
                          <Trash2 size={15} aria-hidden />
                        </button>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {STATUSES.map((s) => (
                          <button
                            key={s.value}
                            type="button"
                            aria-pressed={item.status === s.value}
                            onClick={() => void setStatus(item, s.value)}
                            className={clsx("chip text-xs", item.status === s.value && "chip-active")}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <BucketForm open={adding} onClose={() => setAdding(false)} onSaved={reload} />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Remove this item?"
        body={pendingDelete ? `"${pendingDelete.title}" will be removed from the list.` : ""}
        confirmLabel="Remove"
        busy={busy}
        onCancel={() => setPendingDelete(null)}
        onConfirm={remove}
      />
    </div>
  );
}

function BucketForm({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  // Mounted only while open, so every visit starts from a blank form.
  if (!open) return null;
  return <BucketFormBody onClose={onClose} onSaved={onSaved} />;
}

function BucketFormBody({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<string>("WANT_TO_DO");
  const [targetDate, setTargetDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/bucket-list", {
        title: title.trim(),
        note: note.trim() || null,
        status,
        targetDate: targetDate || null,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Add to the bucket list">
      <form onSubmit={save} className="space-y-4">
        {error ? <ErrorState message={error} /> : null}

        <div>
          <label className="label" htmlFor="bucket-title">
            What is it
          </label>
          <input
            id="bucket-title"
            className="field"
            required
            maxLength={160}
            placeholder="Watch the sunrise from Fansipan"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="bucket-note">
            Note (optional)
          </label>
          <textarea
            id="bucket-note"
            className="field min-h-20 resize-y"
            maxLength={1000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="bucket-date">
            Aiming for (optional)
          </label>
          <input
            id="bucket-date"
            type="date"
            className="field"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
          />
        </div>

        <div>
          <span className="label">Where it stands</span>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <button
                key={s.value}
                type="button"
                aria-pressed={status === s.value}
                onClick={() => setStatus(s.value)}
                className={clsx("chip", status === s.value && "chip-active")}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-quiet" disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
