"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, MapPin, Pencil, Trash2 } from "lucide-react";
import type { MomentDTO } from "@/server/moments";
import { api, ApiError, mediaUrl } from "@/lib/client";
import { Avatar, ConfirmDialog, ErrorState } from "@/components/ui";
import { Lightbox, MOOD_LABEL } from "@/components/moments";
import { formatDay, formatTime } from "@/lib/formatDate";

export default function MomentDetail({ moment, canEdit }: { moment: MomentDTO; canEdit: boolean }) {
  const router = useRouter();
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await api.del(`/moments/${moment.id}`);
      router.replace("/app/timeline");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete this moment.");
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <article className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => router.back()} className="btn btn-ghost -ml-2">
          <ArrowLeft size={18} aria-hidden />
          Back
        </button>

        <div className="flex items-center gap-1">
          {canEdit ? (
            <Link href={`/app/moments/${moment.id}/edit`} className="btn btn-ghost">
              <Pencil size={16} aria-hidden />
              Edit
            </Link>
          ) : null}
          <button type="button" onClick={() => setConfirming(true)} className="btn btn-ghost">
            <Trash2 size={16} aria-hidden />
            Delete
          </button>
        </div>
      </div>

      {error ? <ErrorState message={error} /> : null}

      {moment.media.length > 0 ? (
        <div className="space-y-2">
          {moment.media.map((photo, i) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setLightbox(i)}
              className="block w-full overflow-hidden rounded-[var(--radius-drawn)] bg-[var(--color-paper-deep)]"
              aria-label={`Open photo ${i + 1} full size`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- authenticated media proxy */}
              <img
                src={mediaUrl(photo.id)}
                alt=""
                width={photo.width}
                height={photo.height}
                className="h-auto w-full object-contain"
              />
            </button>
          ))}
        </div>
      ) : null}

      <div className="card space-y-4 p-5">
        <header className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--color-ink-soft)]">
          <Avatar name={moment.author.displayName} mediaId={moment.author.avatarMediaId} size={26} />
          <span>{moment.author.displayName}</span>
          <span aria-hidden>·</span>
          <time dateTime={moment.occurredAt}>
            {formatDay(moment.localDate)} at {formatTime(moment.occurredAt, moment.timezone)}
          </time>
        </header>

        {moment.caption ? (
          <p className="whitespace-pre-wrap text-[1.0625rem] leading-relaxed text-[var(--color-ink)]">
            {moment.caption}
          </p>
        ) : (
          <p className="text-sm italic text-[var(--color-ink-faint)]">No words on this one.</p>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {moment.mood ? <span className="chip chip-active">{MOOD_LABEL[moment.mood]}</span> : null}
          {moment.locationText ? (
            <span className="chip">
              <MapPin size={13} aria-hidden />
              {moment.locationText}
            </span>
          ) : null}
          {moment.tags.map((tag) => (
            <Link key={tag} href={`/app/timeline?tag=${encodeURIComponent(tag)}`} className="chip">
              #{tag}
            </Link>
          ))}
        </div>
      </div>

      <Lightbox media={moment.media} index={lightbox} onClose={() => setLightbox(null)} onIndex={setLightbox} />

      <ConfirmDialog
        open={confirming}
        title="Delete this moment?"
        body="It moves out of your timeline. You have 30 days to change your mind, from Settings."
        busy={busy}
        onCancel={() => setConfirming(false)}
        onConfirm={remove}
      />
    </article>
  );
}
