"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search as SearchIcon } from "lucide-react";
import type { SearchResults } from "@/server/home";
import { api } from "@/lib/client";
import { useAsyncData } from "@/lib/useAsyncData";
import { EmptyState, ErrorState, MomentSkeletonList, SectionHeading } from "@/components/ui";
import { MomentCard } from "@/components/moments";
import { formatDayShort } from "@/lib/formatDate";

const SENTIMENT_LABEL: Record<string, string> = {
  LOVE: "Loves",
  LIKE: "Likes",
  NEUTRAL: "Neutral on",
  DISLIKE: "Dislikes",
};

export default function SearchView() {
  const router = useRouter();
  const params = useSearchParams();
  const initial = params.get("q") ?? "";

  const [draft, setDraft] = useState(initial);

  const fetcher = useCallback(
    () =>
      initial.trim()
        ? api.get<SearchResults>(`/search?q=${encodeURIComponent(initial.trim())}`)
        : Promise.resolve(null),
    [initial],
  );
  const { data: results, error } = useAsyncData(fetcher, "Could not search just now.");
  const loading = Boolean(initial.trim()) && !results && !error;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    router.replace(draft.trim() ? `/app/search?q=${encodeURIComponent(draft.trim())}` : "/app/search");
  }

  const total = results
    ? results.moments.length +
      results.memories.length +
      results.preferences.length +
      results.bucketItems.length +
      results.importantDates.length
    : 0;

  return (
    <div className="space-y-6">
      <h1 className="display text-xl">Search</h1>

      <form onSubmit={submit} className="flex gap-2">
        <input
          className="field"
          type="search"
          placeholder="ramen, first trip, tulip…"
          aria-label="Search your space"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit" className="btn btn-primary shrink-0">
          <SearchIcon size={16} aria-hidden />
          Search
        </button>
      </form>

      {error ? <ErrorState message={error} /> : null}

      {loading ? <MomentSkeletonList count={2} /> : null}

      {!loading && results && total === 0 ? (
        <EmptyState
          title={`Nothing found for "${results.query}".`}
          hint="Search looks through captions, places, tags, memories, preferences and your bucket list."
        />
      ) : null}

      {!loading && results && total > 0 ? (
        <div className="space-y-8">
          {results.moments.length > 0 ? (
            <section>
              <SectionHeading title={`Moments (${results.moments.length})`} />
              <div className="space-y-4">
                {results.moments.map((m) => (
                  <MomentCard key={m.id} moment={m} showDate />
                ))}
              </div>
            </section>
          ) : null}

          {results.memories.length > 0 ? (
            <section>
              <SectionHeading title={`Memories (${results.memories.length})`} />
              <ul className="card divide-y divide-[var(--color-line)]">
                {results.memories.map((m) => (
                  <li key={m.id}>
                    <Link href={`/app/memories/${m.id}`} className="block px-4 py-3 hover:bg-[var(--color-paper-deep)]">
                      <p className="text-[0.9375rem] text-[var(--color-ink)]">{m.title}</p>
                      <p className="text-sm text-[var(--color-ink-faint)]">{formatDayShort(m.startDate)}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {results.preferences.length > 0 ? (
            <section>
              <SectionHeading title={`Preferences (${results.preferences.length})`} />
              <ul className="card divide-y divide-[var(--color-line)]">
                {results.preferences.map((p) => (
                  <li key={p.id} className="px-4 py-3 text-[0.9375rem]">
                    <span className="text-[var(--color-ink-soft)]">{SENTIMENT_LABEL[p.sentiment]} </span>
                    <span className="text-[var(--color-ink)]">{p.value}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-sm">
                <Link href="/app/about" className="text-[var(--color-rose)] hover:underline">
                  Open About us
                </Link>
              </p>
            </section>
          ) : null}

          {results.bucketItems.length > 0 ? (
            <section>
              <SectionHeading title={`Bucket list (${results.bucketItems.length})`} />
              <ul className="card divide-y divide-[var(--color-line)]">
                {results.bucketItems.map((b) => (
                  <li key={b.id} className="px-4 py-3 text-[0.9375rem] text-[var(--color-ink)]">
                    {b.title}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {results.importantDates.length > 0 ? (
            <section>
              <SectionHeading title={`Dates (${results.importantDates.length})`} />
              <ul className="card divide-y divide-[var(--color-line)]">
                {results.importantDates.map((d) => (
                  <li key={d.id} className="flex justify-between gap-3 px-4 py-3 text-[0.9375rem]">
                    <span className="text-[var(--color-ink)]">{d.title}</span>
                    <span className="text-[var(--color-ink-faint)]">{formatDayShort(d.eventDate)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
