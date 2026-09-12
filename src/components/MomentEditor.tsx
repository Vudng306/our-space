"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { X } from "lucide-react";
import type { MomentDTO } from "@/server/moments";
import { api, ApiError, browserTimeZone } from "@/lib/client";
import MediaUploader, { type UploadedMedia } from "./MediaUploader";
import { MOODS } from "./moments";
import { ConfirmDialog, ErrorState } from "./ui";

const CAPTION_MAX = 2000;

/** "2026-09-10T19:20" in the reader local time, for datetime-local inputs. */
function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Sends the instant *with* its offset so the server can keep the local day. */
function toOffsetISO(local: string): string {
  const date = new Date(local);
  const pad = (n: number) => String(n).padStart(2, "0");
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

export default function MomentEditor({
  moment,
  maxPhotos = 10,
}: {
  moment?: MomentDTO;
  maxPhotos?: number;
}) {
  const router = useRouter();
  const editing = Boolean(moment);

  const [media, setMedia] = useState<UploadedMedia[]>(moment?.media ?? []);
  const [caption, setCaption] = useState(moment?.caption ?? "");
  const [occurredAt, setOccurredAt] = useState(
    toLocalInput(moment ? new Date(moment.occurredAt) : new Date()),
  );
  const [mood, setMood] = useState<string | null>(moment?.mood ?? null);
  const [locationText, setLocationText] = useState(moment?.locationText ?? "");
  const [tags, setTags] = useState<string[]>(moment?.tags ?? []);
  const [tagDraft, setTagDraft] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  // Snapshot of what was last saved; comparing against it is what "unsaved
  // changes" means. It only moves forward on a successful save.
  const [baseline, setBaseline] = useState(() =>
    JSON.stringify({
      media: moment?.media ?? [],
      caption: moment?.caption ?? "",
      occurredAt: toLocalInput(moment ? new Date(moment.occurredAt) : new Date()),
      mood: moment?.mood ?? null,
      locationText: moment?.locationText ?? "",
      tags: moment?.tags ?? [],
    }),
  );
  const dirty = useMemo(
    () => JSON.stringify({ media, caption, occurredAt, mood, locationText, tags }) !== baseline,
    [baseline, media, caption, occurredAt, mood, locationText, tags],
  );

  // Nothing typed here should be lost to a stray back-swipe (spec §4.2).
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function commitTag(raw: string) {
    const value = raw.trim().replace(/^#/, "").toLowerCase();
    if (!value || tags.includes(value) || tags.length >= 15) return;
    setTags([...tags, value]);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!caption.trim() && media.length === 0) {
      setError("Add a photo or a few words — an empty moment has nothing to remember.");
      return;
    }

    setBusy(true);
    const payload = {
      caption: caption.trim() || null,
      occurredAt: toOffsetISO(occurredAt),
      timezone: browserTimeZone(),
      mood,
      locationText: locationText.trim() || null,
      mediaIds: media.map((m) => m.id),
      tags,
    };

    try {
      const saved = editing
        ? await api.patch<MomentDTO>(`/moments/${moment!.id}`, payload)
        : await api.post<MomentDTO>("/moments", payload);

      setBaseline(JSON.stringify({ media, caption, occurredAt, mood, locationText, tags }));
      router.replace(`/app/moments/${saved.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save this moment.");
      setBusy(false);
    }
  }

  function leave() {
    if (dirty) {
      setConfirmLeave(true);
      return;
    }
    router.back();
  }

  return (
    <form onSubmit={save} className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="display text-xl">{editing ? "Edit moment" : "Add a moment"}</h1>
        <button type="button" onClick={leave} className="btn btn-ghost p-2" aria-label="Close">
          <X size={20} aria-hidden />
        </button>
      </div>

      {error ? <ErrorState message={error} /> : null}

      <div className="card space-y-5 p-4 sm:p-5">
        <MediaUploader media={media} onChange={setMedia} max={maxPhotos} />

        <div>
          <label className="label" htmlFor="caption">
            What happened
          </label>
          <textarea
            id="caption"
            className="field min-h-28 resize-y"
            maxLength={CAPTION_MAX}
            placeholder="A few words is enough."
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
          <p className="mt-1 text-right text-xs text-[var(--color-ink-faint)]">
            {caption.length}/{CAPTION_MAX}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="occurredAt">
              When
            </label>
            <input
              id="occurredAt"
              type="datetime-local"
              className="field"
              required
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
            />
            <p className="mt-1.5 text-xs text-[var(--color-ink-faint)]">
              Defaults to now. Set it back for something you are catching up on.
            </p>
          </div>

          <div>
            <label className="label" htmlFor="location">
              Where (optional)
            </label>
            <input
              id="location"
              className="field"
              maxLength={120}
              placeholder="Hà Nội"
              value={locationText}
              onChange={(e) => setLocationText(e.target.value)}
            />
          </div>
        </div>

        <fieldset>
          <legend className="label">How it felt (optional)</legend>
          <div className="flex flex-wrap gap-2">
            {MOODS.map((m) => (
              <button
                key={m.value}
                type="button"
                aria-pressed={mood === m.value}
                onClick={() => setMood(mood === m.value ? null : m.value)}
                className={clsx("chip", mood === m.value && "chip-active")}
              >
                {m.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div>
          <label className="label" htmlFor="tags">
            Tags (optional)
          </label>
          {tags.length > 0 ? (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span key={t} className="chip chip-active">
                  #{t}
                  <button
                    type="button"
                    onClick={() => setTags(tags.filter((x) => x !== t))}
                    aria-label={`Remove tag ${t}`}
                  >
                    <X size={12} aria-hidden />
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          <input
            id="tags"
            className="field"
            placeholder="ramen, date — press enter after each"
            value={tagDraft}
            onChange={(e) => {
              const v = e.target.value;
              if (v.includes(",")) {
                v.split(",").forEach(commitTag);
                setTagDraft("");
              } else {
                setTagDraft(v);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitTag(tagDraft);
                setTagDraft("");
              }
            }}
            onBlur={() => {
              commitTag(tagDraft);
              setTagDraft("");
            }}
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={leave} className="btn btn-quiet" disabled={busy}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Saving…" : editing ? "Save changes" : "Save moment"}
        </button>
      </div>

      <ConfirmDialog
        open={confirmLeave}
        title="Leave without saving?"
        body="What you have written here will not be kept."
        confirmLabel="Discard"
        onCancel={() => setConfirmLeave(false)}
        onConfirm={() => {
          setConfirmLeave(false);
          router.back();
        }}
      />
    </form>
  );
}
