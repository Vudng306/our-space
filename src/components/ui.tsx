"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { AlertCircle, Loader2, X } from "lucide-react";
import { RingDoodle, SquiggleDoodle } from "./doodles";

// ---------------------------------------------------------------------------
// States (spec §9.4, §12.2)
// ---------------------------------------------------------------------------

export function EmptyState({
  title,
  hint,
  action,
  icon,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col items-center gap-3 px-6 py-11 text-center"
      style={{
        border: "1.5px dashed var(--color-line-strong)",
        borderRadius: "var(--radius-drawn)",
        background: "rgb(255 253 248 / 0.55)",
      }}
    >
      {icon ? <div className="text-[var(--color-rose-line)]">{icon}</div> : null}
      <p className="display text-xl text-[var(--color-ink)]">{title}</p>
      {hint ? <p className="max-w-sm text-[0.9375rem] text-[var(--color-ink-soft)]">{hint}</p> : null}
      <SquiggleDoodle className="text-[var(--color-line-strong)]" />
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-[var(--radius-drawn)] border-[1.5px] border-[var(--color-danger)]/35 bg-[var(--color-danger-soft)] px-4 py-3"
    >
      <AlertCircle size={18} className="mt-0.5 shrink-0 text-[var(--color-danger)]" aria-hidden />
      <div className="flex-1 text-sm text-[var(--color-ink)]">
        <p>{message}</p>
        {onRetry ? (
          <button type="button" onClick={onRetry} className="mt-1 font-medium underline underline-offset-2">
            Thử lại
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function InlineError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1.5 text-sm text-[var(--color-danger)]">
      {message}
    </p>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("skeleton", className)} aria-hidden />;
}

export function MomentSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Đang tải">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card overflow-hidden p-4">
          <Skeleton className="mb-3 h-48 w-full" />
          <Skeleton className="mb-2 h-4 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      ))}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-[var(--color-ink-soft)]">
      <Loader2 size={16} className="animate-spin" aria-hidden />
      {label ?? "Đang xử lý…"}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Dialog
// ---------------------------------------------------------------------------

export function Modal({
  open,
  onClose,
  title,
  children,
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  labelledBy?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Đóng"
        onClick={onClose}
        className="absolute inset-0 bg-[var(--color-ink)]/30 backdrop-blur-[2px]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={labelledBy ? undefined : title}
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className="fade-up card relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-b-none p-5 shadow-[var(--shadow-lift)] sm:max-w-lg sm:rounded-[var(--radius-drawn)]"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="display text-xl">{title}</h2>
          <button type="button" onClick={onClose} className="btn btn-ghost -mr-2 -mt-1 p-2" aria-label="Đóng">
            <X size={18} aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * Destructive actions always ask first, and anything that would remove both
 * people's history asks them to type the name back (spec §6.4).
 */
export function ConfirmDialog(props: {
  open: boolean;
  title: string;
  body: React.ReactNode;
  confirmLabel?: string;
  requirePhrase?: string;
  phraseHint?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (phrase: string) => void;
}) {
  // Mounted only while open, so the typed phrase starts empty every time
  // without an effect having to clear it.
  if (!props.open) return null;
  return <ConfirmDialogBody {...props} />;
}

function ConfirmDialogBody({
  title,
  body,
  confirmLabel = "Xoá",
  requirePhrase,
  phraseHint,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: React.ReactNode;
  confirmLabel?: string;
  requirePhrase?: string;
  phraseHint?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (phrase: string) => void;
}) {
  const [phrase, setPhrase] = useState("");
  const blocked = Boolean(requirePhrase) && phrase.trim() !== requirePhrase?.trim();

  return (
    <Modal open onClose={onCancel} title={title}>
      <div className="space-y-4 text-sm text-[var(--color-ink-soft)]">
        <div>{body}</div>

        {requirePhrase ? (
          <div>
            <label className="label" htmlFor="confirm-phrase">
              {phraseHint ?? `Gõ ${requirePhrase} để xác nhận`}
            </label>
            <input
              id="confirm-phrase"
              className="field"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              autoComplete="off"
placeholder={requirePhrase}
            />
          </div>
        ) : null}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-quiet" onClick={onCancel} disabled={busy}>
            Huỷ
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => onConfirm(phrase)}
            disabled={blocked || busy}
          >
            {busy ? "Đang xử lý…" : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

export function Avatar({
  name,
  mediaId,
  size = 32,
}: {
  name: string;
  mediaId?: string | null;
  size?: number;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      title={name}
    >
      {mediaId ? (
        // eslint-disable-next-line @next/next/no-img-element -- served through the authenticated media proxy
        <img
          src={`/api/v1/media/${mediaId}?variant=thumb`}
          alt={name}
          width={size}
          height={size}
          className="rounded-full object-cover"
          style={{ width: size, height: size }}
        />
      ) : (
        <span
          aria-hidden
          className="display flex h-full w-full items-center justify-center rounded-full bg-[var(--color-rose-soft)] text-[var(--color-rose-deep)]"
          style={{ fontSize: size * 0.44 }}
        >
          {initials || "?"}
        </span>
      )}

      {/* the circle drawn round it, always a little off-centre */}
      <RingDoodle
        size={size + 6}
        className="pointer-events-none absolute -left-[3px] -top-[3px] text-[var(--color-rose)]"
      />
    </span>
  );
}

export function SectionHeading({
  title,
  action,
  hint,
}: {
  title: string;
  action?: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="display underlined text-xl text-[var(--color-ink)]">{title}</h2>
        {hint ? <p className="mt-2 text-[0.9375rem] text-[var(--color-ink-soft)]">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}
