"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { Filter, Plus, X } from "lucide-react";
import type { MomentDTO } from "@/server/moments";
import { api, ApiError } from "@/lib/client";
import { useAsyncData } from "@/lib/useAsyncData";
import { EmptyState, ErrorState, MomentSkeletonList, Spinner } from "@/components/ui";
import { MOODS, MomentCard } from "@/components/moments";

type Page = { items: MomentDTO[]; nextCursor: string | null };
type Member = { userId: string; displayName: string };

const PAGE_SIZE = 12;

export default function TimelineView() {
  const router = useRouter();
  const params = useSearchParams();

  const filters = useMemo(
    () => ({
      tag: params.get("tag") ?? "",
      authorId: params.get("authorId") ?? "",
      mood: params.get("mood") ?? "",
      from: params.get("from") ?? "",
      to: params.get("to") ?? "",
    }),
    [params],
  );
  const activeCount = Object.values(filters).filter(Boolean).length;

  const [showFilters, setShowFilters] = useState(false);

  const membersFetcher = useCallback(
    () => api.get<{ space: { members: Member[] } | null }>("/me"),
    [],
  );
  const { data: meData } = useAsyncData(membersFetcher);
  const members = meData?.space?.members ?? [];

  const tagsFetcher = useCallback(() => api.get<{ tags: string[] }>("/tags"), []);
  const { data: tagData } = useAsyncData(tagsFetcher);
  const tagOptions = tagData?.tags ?? [];

  const queryString = useMemo(() => {
    const q = new URLSearchParams({ limit: String(PAGE_SIZE) });
    for (const [key, value] of Object.entries(filters)) {
      if (value) q.set(key, value);
    }
    return q.toString();
  }, [filters]);

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`/app/timeline${next.toString() ? `?${next}` : ""}`);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="display text-xl">Timeline</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            className={clsx("btn", activeCount ? "btn-primary" : "btn-quiet")}
          >
            <Filter size={16} aria-hidden />
            Filter{activeCount ? ` (${activeCount})` : ""}
          </button>
          <Link href="/app/moments/new" className="btn btn-quiet hidden lg:inline-flex">
            <Plus size={16} aria-hidden />
            Add
          </Link>
        </div>
      </div>

      {showFilters ? (
        <div className="card space-y-4 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="f-from">
                From
              </label>
              <input
                id="f-from"
                type="date"
                className="field"
                value={filters.from}
                onChange={(e) => setFilter("from", e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="f-to">
                To
              </label>
              <input
                id="f-to"
                type="date"
                className="field"
                value={filters.to}
                onChange={(e) => setFilter("to", e.target.value)}
              />
            </div>
          </div>

          {members.length > 1 ? (
            <div>
              <span className="label">Who wrote it</span>
              <div className="flex flex-wrap gap-2">
                {members.map((m) => (
                  <button
                    key={m.userId}
                    type="button"
                    aria-pressed={filters.authorId === m.userId}
                    onClick={() => setFilter("authorId", filters.authorId === m.userId ? "" : m.userId)}
                    className={clsx("chip", filters.authorId === m.userId && "chip-active")}
                  >
                    {m.displayName}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div>
            <span className="label">Mood</span>
            <div className="flex flex-wrap gap-2">
              {MOODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  aria-pressed={filters.mood === m.value}
                  onClick={() => setFilter("mood", filters.mood === m.value ? "" : m.value)}
                  className={clsx("chip", filters.mood === m.value && "chip-active")}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {tagOptions.length > 0 ? (
            <div>
              <span className="label">Tag</span>
              <div className="flex flex-wrap gap-2">
                {tagOptions.slice(0, 24).map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={filters.tag === t}
                    onClick={() => setFilter("tag", filters.tag === t ? "" : t)}
                    className={clsx("chip", filters.tag === t && "chip-active")}
                  >
                    #{t}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {activeCount > 0 ? (
            <button type="button" onClick={() => router.replace("/app/timeline")} className="btn btn-ghost">
              <X size={15} aria-hidden />
              Clear filters
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Keyed on the query so changing a filter starts a clean list rather
          than mixing pages from two different searches. */}
      <MomentList key={queryString} queryString={queryString} hasFilters={activeCount > 0} />
    </div>
  );
}

function MomentList({ queryString, hasFilters }: { queryString: string; hasFilters: boolean }) {
  const router = useRouter();

  const fetcher = useCallback(() => api.get<Page>(`/moments?${queryString}`), [queryString]);
  const { data, error, reload } = useAsyncData(fetcher, "Could not load the timeline.");

  // Pages after the first are appended here; the first page stays with the hook.
  const [extra, setExtra] = useState<MomentDTO[]>([]);
  const [cursorOverride, setCursorOverride] = useState<string | null | undefined>(undefined);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);

  const items = useMemo(() => [...(data?.items ?? []), ...extra], [data, extra]);
  const cursor = cursorOverride === undefined ? (data?.nextCursor ?? null) : cursorOverride;

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const page = await api.get<Page>(`/moments?${queryString}&cursor=${encodeURIComponent(cursor)}`);
      // The cursor is (occurredAt, id), so pages never overlap or skip.
      setExtra((prev) => [...prev, ...page.items]);
      setCursorOverride(page.nextCursor);
    } catch (err) {
      setMoreError(err instanceof ApiError ? err.message : "Could not load more.");
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore, queryString]);

  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !cursor) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "600px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [cursor, loadMore]);

  const grouped = useMemo(() => groupByMonth(items), [items]);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <MomentSkeletonList />;

  if (items.length === 0) {
    return (
      <EmptyState
        title={hasFilters ? "Nothing matches those filters." : "Your timeline starts with one moment."}
        hint={
          hasFilters
            ? "Try widening the dates, or clear the filters."
            : "Everything the two of you save shows up here, newest first."
        }
        action={
          hasFilters ? (
            <button type="button" onClick={() => router.replace("/app/timeline")} className="btn btn-quiet">
              Clear filters
            </button>
          ) : (
            <Link href="/app/moments/new" className="btn btn-primary">
              <Plus size={16} aria-hidden />
              Add a moment
            </Link>
          )
        }
      />
    );
  }

  return (
    <>
      <div className="space-y-8">
        {grouped.map(([month, group]) => (
          <section key={month}>
            <h2 className="display sticky top-14 z-10 mb-3 bg-[var(--color-paper)]/95 py-1 text-sm text-[var(--color-ink-soft)] backdrop-blur lg:top-0">
              {month}
            </h2>
            <div className="space-y-4">
              {group.map((m) => (
                <MomentCard key={m.id} moment={m} showDate />
              ))}
            </div>
          </section>
        ))}
      </div>

      {moreError ? <ErrorState message={moreError} onRetry={() => void loadMore()} /> : null}

      <div ref={sentinel} className="flex justify-center py-4">
        {loadingMore ? <Spinner label="Loading more…" /> : null}
        {!cursor ? <p className="text-sm text-[var(--color-ink-faint)]">That is everything so far.</p> : null}
      </div>
    </>
  );
}

function groupByMonth(items: MomentDTO[]): [string, MomentDTO[]][] {
  const map = new Map<string, MomentDTO[]>();
  for (const item of items) {
    const key = item.localDate.slice(0, 7);
    const bucket = map.get(key);
    if (bucket) bucket.push(item);
    else map.set(key, [item]);
  }
  return [...map.entries()].map(([key, group]) => [
    new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric", timeZone: "UTC" }).format(
      new Date(`${key}-01T00:00:00Z`),
    ),
    group,
  ]);
}
