"use client";

import { useCallback } from "react";
import Link from "next/link";
import { CalendarHeart, Plus } from "lucide-react";
import type { HomeSummary } from "@/server/home";
import { api, browserTimeZone } from "@/lib/client";
import { useAsyncData } from "@/lib/useAsyncData";
import { EmptyState, ErrorState, MomentSkeletonList, SectionHeading, Skeleton } from "@/components/ui";
import { MomentCard } from "@/components/moments";
import { formatDay, formatDayShort } from "@/lib/formatDate";

export default function HomeToday() {
  // The reader time zone decides which day "today" is (spec §5.1).
  const fetcher = useCallback(
    () => api.get<HomeSummary>(`/home?tz=${encodeURIComponent(browserTimeZone())}`),
    [],
  );
  const { data, error, reload } = useAsyncData(fetcher, "Could not load your space.");

  if (error) return <ErrorState message={error} onRetry={reload} />;

  if (!data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full" />
        <MomentSkeletonList count={2} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Header data={data} />

      <section>
        <SectionHeading
          title="Today"
          hint={formatDay(data.today)}
          action={
            <Link href="/app/moments/new" className="btn btn-quiet hidden lg:inline-flex">
              <Plus size={16} aria-hidden />
              Add moment
            </Link>
          }
        />

        {data.todayMoments.length === 0 ? (
          <EmptyState
            title="Start with one small thing from today."
            hint="A photo and a few words is plenty. It only takes a moment."
            action={
              <Link href="/app/moments/new" className="btn btn-primary">
                <Plus size={16} aria-hidden />
                Add today&apos;s moment
              </Link>
            }
          />
        ) : (
          <div className="space-y-4">
            {data.todayMoments.map((m) => (
              <MomentCard key={m.id} moment={m} />
            ))}
          </div>
        )}
      </section>

      {data.upcomingDates.length > 0 ? (
        <section>
          <SectionHeading
            title="Coming up"
            action={
              <Link href="/app/about" className="text-sm text-[var(--color-rose)] hover:underline">
                All dates
              </Link>
            }
          />
          <ul className="card divide-y divide-[var(--color-line)]">
            {data.upcomingDates.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[0.9375rem] text-[var(--color-ink)]">{d.title}</p>
                  <p className="text-sm text-[var(--color-ink-faint)]">
                    {d.nextOccurrence ? formatDayShort(d.nextOccurrence) : ""}
                  </p>
                </div>
                <span className="chip shrink-0">
                  <CalendarHeart size={14} aria-hidden />
                  {d.daysUntil === 0
                    ? "Today"
                    : d.daysUntil === 1
                      ? "Tomorrow"
                      : `${d.daysUntil} days`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.onThisDay ? (
        <section>
          <SectionHeading title="On this day" hint={formatDayShort(data.onThisDay.localDate)} />
          <MomentCard moment={data.onThisDay} />
        </section>
      ) : data.randomMemory ? (
        <section>
          <SectionHeading title="Remember this" hint={formatDayShort(data.randomMemory.localDate)} />
          <MomentCard moment={data.randomMemory} />
        </section>
      ) : null}
    </div>
  );
}

function Header({ data }: { data: HomeSummary }) {
  return (
    <header className="card px-5 py-5">
      <p className="display text-xl text-[var(--color-ink)]">{data.spaceName}</p>

      {data.daysTogether !== null ? (
        <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
          <span className="font-medium text-[var(--color-rose)]">
            {data.daysTogether.toLocaleString()}
          </span>{" "}
          {data.daysTogether === 1 ? "day" : "days"} since {formatDayShort(data.startDate!)}
        </p>
      ) : (
        <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
          <Link href="/app/settings" className="text-[var(--color-rose)] underline underline-offset-2">
            Add the day it started
          </Link>{" "}
          to see the counter here.
        </p>
      )}

      <dl className="mt-4 flex gap-6 border-t border-[var(--color-line)] pt-4 text-sm">
        <div>
          <dt className="text-xs text-[var(--color-ink-faint)]">Moments</dt>
          <dd className="text-[var(--color-ink)]">{data.totals.moments.toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--color-ink-faint)]">Photos</dt>
          <dd className="text-[var(--color-ink)]">{data.totals.photos.toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--color-ink-faint)]">Memories</dt>
          <dd className="text-[var(--color-ink)]">{data.totals.memories.toLocaleString()}</dd>
        </div>
      </dl>
    </header>
  );
}
