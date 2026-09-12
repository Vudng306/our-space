"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { CalendarHeart, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { CalendarDay } from "@/server/home";
import type { MomentDTO } from "@/server/moments";
import { api, mediaUrl } from "@/lib/client";
import { useAsyncData } from "@/lib/useAsyncData";
import { EmptyState, ErrorState, Modal, Skeleton } from "@/components/ui";
import { MomentCard } from "@/components/moments";
import { formatDay } from "@/lib/formatDate";

function monthKeyOf(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function todayKeyLocal() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** Every cell of the grid, including the blanks that pad the first week. */
function buildGrid(monthKey: string): (string | null)[] {
  const [year, month] = monthKey.split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  // Monday-first, which is what a Vietnamese or European calendar expects.
  const lead = (first.getUTCDay() + 6) % 7;

  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${monthKey}-${String(d).padStart(2, "0")}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function CalendarView() {
  const [monthKey, setMonthKey] = useState(() => monthKeyOf(new Date()));
  const [openDay, setOpenDay] = useState<string | null>(null);

  const [year, month] = monthKey.split("-").map(Number);
  const from = `${monthKey}-01`;
  const to = `${monthKey}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, "0")}`;

  const fetcher = useCallback(
    () => api.get<{ days: CalendarDay[] }>(`/calendar?from=${from}&to=${to}`),
    [from, to],
  );
  const { data, error, reload } = useAsyncData(fetcher, "Could not load the calendar.");

  const days = useMemo(
    () => Object.fromEntries((data?.days ?? []).map((d) => [d.date, d])) as Record<string, CalendarDay>,
    [data],
  );
  const cells = useMemo(() => buildGrid(monthKey), [monthKey]);
  const today = todayKeyLocal();

  function shift(delta: number) {
    setMonthKey(monthKeyOf(new Date(year, month - 1 + delta, 1)));
  }

  const monthLabel = new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${monthKey}-01T00:00:00Z`));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="display text-xl">Calendar</h1>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => shift(-1)} className="btn btn-ghost p-2" aria-label="Previous month">
            <ChevronLeft size={20} aria-hidden />
          </button>
          <span className="min-w-[9rem] text-center text-sm font-medium">{monthLabel}</span>
          <button type="button" onClick={() => shift(1)} className="btn btn-ghost p-2" aria-label="Next month">
            <ChevronRight size={20} aria-hidden />
          </button>
        </div>
      </div>

      {error ? <ErrorState message={error} onRetry={reload} /> : null}

      <div className="card p-3 sm:p-4">
        <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs text-[var(--color-ink-faint)]">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((key, i) => {
            if (!key) return <div key={`pad-${i}`} className="aspect-square self-start" />;

            const entry = days[key];
            const dayNumber = Number(key.slice(8));
            const momentCount = entry?.momentCount ?? 0;
            const hasDate = (entry?.importantDates.length ?? 0) > 0;

            return (
              <button
                key={key}
                type="button"
                onClick={() => setOpenDay(key)}
                aria-label={`${formatDay(key)}${momentCount ? `, ${momentCount} moments` : ""}`}
                className={clsx(
                  "relative aspect-square w-full self-start overflow-hidden rounded-[10px] border text-left transition-colors",
                  key === today
                    ? "border-[var(--color-rose)]"
                    : "border-transparent hover:border-[var(--color-line-strong)]",
                  momentCount > 0 ? "bg-[var(--color-paper-deep)]" : "bg-transparent",
                )}
              >
                {entry?.coverMediaId ? (
                  // eslint-disable-next-line @next/next/no-img-element -- authenticated media proxy
                  <img
                    src={mediaUrl(entry.coverMediaId, "thumb")}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover opacity-70"
                  />
                ) : null}

                <span
                  className={clsx(
                    "absolute left-1 top-1 rounded px-1 text-xs font-medium",
                    entry?.coverMediaId
                      ? "bg-[var(--color-ink)]/55 text-white"
                      : key === today
                        ? "text-[var(--color-rose-deep)]"
                        : "text-[var(--color-ink-soft)]",
                  )}
                >
                  {dayNumber}
                </span>

                {hasDate ? (
                  <CalendarHeart
                    size={13}
                    aria-hidden
                    className="absolute right-1 top-1 text-[var(--color-rose)]"
                  />
                ) : null}

                {momentCount > 0 && !entry?.coverMediaId ? (
                  <span className="absolute bottom-1.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[var(--color-rose)]" />
                ) : null}
              </button>
            );
          })}
        </div>

        {!data && !error ? <Skeleton className="mt-3 h-1 w-full" /> : null}
      </div>

      <p className="flex flex-wrap items-center gap-4 text-xs text-[var(--color-ink-faint)]">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-rose)]" />
          A day with moments
        </span>
        <span className="flex items-center gap-1.5">
          <CalendarHeart size={13} aria-hidden className="text-[var(--color-rose)]" />
          An important date
        </span>
      </p>

      {openDay ? (
        <DayDrawer key={openDay} day={openDay} entry={days[openDay]} onClose={() => setOpenDay(null)} />
      ) : null}
    </div>
  );
}

function DayDrawer({
  day,
  entry,
  onClose,
}: {
  day: string;
  entry?: CalendarDay;
  onClose: () => void;
}) {
  const fetcher = useCallback(
    () => api.get<{ items: MomentDTO[] }>(`/moments?from=${day}&to=${day}&limit=50`),
    [day],
  );
  const { data, error } = useAsyncData(fetcher, "Could not load that day.");

  return (
    <Modal open onClose={onClose} title={formatDay(day)}>
      <div className="space-y-4">
        {entry?.importantDates.length ? (
          <ul className="space-y-1.5">
            {entry.importantDates.map((d) => (
              <li key={d.id} className="chip chip-active">
                <CalendarHeart size={13} aria-hidden />
                {d.title}
              </li>
            ))}
          </ul>
        ) : null}

        {error ? <ErrorState message={error} /> : null}

        {!data && !error ? (
          <Skeleton className="h-32 w-full" />
        ) : data && data.items.length === 0 ? (
          <EmptyState
            title="Nothing saved on this day."
            hint="Marks appear here once a moment is saved for a date."
            action={
              <Link href="/app/moments/new" className="btn btn-primary">
                <Plus size={16} aria-hidden />
                Add a moment
              </Link>
            }
          />
        ) : (
          <div className="space-y-4">
            {data?.items.map((m) => (
              <MomentCard key={m.id} moment={m} />
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
