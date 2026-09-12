"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, MapPin, X } from "lucide-react";
import type { MomentDTO } from "@/server/moments";
import { mediaUrl } from "@/lib/client";
import { formatDay, formatDayShort, formatTime } from "@/lib/formatDate";
import { Avatar } from "./ui";

export const MOODS = [
  { value: "HAPPY", label: "Happy" },
  { value: "LOVED", label: "Loved" },
  { value: "CALM", label: "Calm" },
  { value: "EXCITED", label: "Excited" },
  { value: "TIRED", label: "Tired" },
  { value: "SAD", label: "Sad" },
] as const;

export const MOOD_LABEL: Record<string, string> = Object.fromEntries(
  MOODS.map((m) => [m.value, m.label]),
);

export { formatDay, formatDayShort, formatTime };

// ---------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------

/**
 * Layout follows the count: one photo keeps its own shape, more than one falls
 * into a square grid so a row of cards stays level.
 */
export function PhotoGrid({
  media,
  onOpen,
}: {
  media: MomentDTO["media"];
  onOpen?: (index: number) => void;
}) {
  if (media.length === 0) return null;

  if (media.length === 1) {
    const photo = media[0];
    const ratio = photo.width && photo.height ? photo.width / photo.height : 4 / 3;
    return (
      <button
        type="button"
        onClick={() => onOpen?.(0)}
        className="block w-full overflow-hidden rounded-[var(--radius-drawn)] bg-[var(--color-paper-deep)]"
        style={{ aspectRatio: String(Math.min(Math.max(ratio, 0.6), 1.9)) }}
        aria-label="Open photo"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- authenticated media proxy */}
        <img
          src={mediaUrl(photo.id, "thumb")}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
        />
      </button>
    );
  }

  const shown = media.slice(0, 4);
  const extra = media.length - shown.length;

  return (
    <div className={clsx("grid gap-1.5", media.length === 2 ? "grid-cols-2" : "grid-cols-2")}>
      {shown.map((photo, i) => (
        <button
          key={photo.id}
          type="button"
          onClick={() => onOpen?.(i)}
          className="relative aspect-square overflow-hidden rounded-[var(--radius-drawn)] bg-[var(--color-paper-deep)]"
          aria-label={`Open photo ${i + 1}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- authenticated media proxy */}
          <img
            src={mediaUrl(photo.id, "thumb")}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
          {i === shown.length - 1 && extra > 0 ? (
            <span className="absolute inset-0 flex items-center justify-center bg-[var(--color-ink)]/45 text-lg font-medium text-white">
              +{extra}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export function Lightbox({
  media,
  index,
  onClose,
  onIndex,
}: {
  media: MomentDTO["media"];
  index: number | null;
  onClose: () => void;
  onIndex: (i: number) => void;
}) {
  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onIndex(Math.min(index + 1, media.length - 1));
      if (e.key === "ArrowLeft") onIndex(Math.max(index - 1, 0));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [index, media.length, onClose, onIndex]);

  if (index === null || !media[index]) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Photo"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-ink)]/92 p-4"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
      >
        <X size={22} aria-hidden />
      </button>

      {index > 0 ? (
        <button
          type="button"
          onClick={() => onIndex(index - 1)}
          aria-label="Previous photo"
          className="absolute left-3 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
        >
          <ChevronLeft size={24} aria-hidden />
        </button>
      ) : null}

      {/* eslint-disable-next-line @next/next/no-img-element -- authenticated media proxy */}
      <img
        src={mediaUrl(media[index].id)}
        alt=""
        className="max-h-full max-w-full rounded-[var(--radius-drawn)] object-contain"
      />

      {index < media.length - 1 ? (
        <button
          type="button"
          onClick={() => onIndex(index + 1)}
          aria-label="Next photo"
          className="absolute right-3 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
        >
          <ChevronRight size={24} aria-hidden />
        </button>
      ) : null}

      {media.length > 1 ? (
        <p className="absolute bottom-5 text-sm text-white/70">
          {index + 1} of {media.length}
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

export function MomentCard({
  moment,
  showDate = false,
  clamp = true,
}: {
  moment: MomentDTO;
  showDate?: boolean;
  clamp?: boolean;
}) {
  const [lightbox, setLightbox] = useState<number | null>(null);

  return (
    <article className="card fade-up overflow-hidden">
      {moment.media.length > 0 ? (
        <div className="p-1.5">
          <PhotoGrid media={moment.media} onOpen={setLightbox} />
        </div>
      ) : null}

      <div className="space-y-2.5 px-4 pb-4 pt-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--color-ink-faint)]">
          <Avatar name={moment.author.displayName} mediaId={moment.author.avatarMediaId} size={22} />
          <span className="text-[var(--color-ink-soft)]">{moment.author.displayName}</span>
          <span aria-hidden>·</span>
          <time dateTime={moment.occurredAt}>
            {showDate
              ? `${formatDayShort(moment.localDate)}, ${formatTime(moment.occurredAt, moment.timezone)}`
              : formatTime(moment.occurredAt, moment.timezone)}
          </time>
          {moment.mood ? (
            <>
              <span aria-hidden>·</span>
              <span className="text-[var(--color-rose)]">{MOOD_LABEL[moment.mood]}</span>
            </>
          ) : null}
        </div>

        {moment.caption ? (
          <p
            className={clsx(
              "whitespace-pre-wrap text-[0.9375rem] leading-relaxed text-[var(--color-ink)]",
              clamp && "line-clamp-6",
            )}
          >
            {moment.caption}
          </p>
        ) : null}

        {moment.locationText ? (
          <p className="flex items-center gap-1.5 text-sm text-[var(--color-ink-soft)]">
            <MapPin size={14} aria-hidden />
            {moment.locationText}
          </p>
        ) : null}

        {moment.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {moment.tags.map((tag) => (
              <Link key={tag} href={`/app/timeline?tag=${encodeURIComponent(tag)}`} className="chip">
                #{tag}
              </Link>
            ))}
          </div>
        ) : null}

        <div className="pt-1">
          <Link
            href={`/app/moments/${moment.id}`}
            className="text-sm font-medium text-[var(--color-rose)] underline-offset-2 hover:underline"
          >
            Open
          </Link>
        </div>
      </div>

      <Lightbox media={moment.media} index={lightbox} onClose={() => setLightbox(null)} onIndex={setLightbox} />
    </article>
  );
}
