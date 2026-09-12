"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ListChecks } from "lucide-react";
import type { SheetsView } from "@/server/sheets";
import { api } from "@/lib/client";
import { features } from "@/lib/features";
import { formatDayShort } from "@/lib/formatDate";
import { useAsyncData } from "@/lib/useAsyncData";
import SheetForm from "@/components/SheetForm";
import SheetView, { LockedSheet } from "@/components/SheetView";
import { ErrorState, SectionHeading, Skeleton } from "@/components/ui";
import { SquiggleDoodle, TwoHearts } from "@/components/doodles";

type UsData = {
  sheets: SheetsView;
  space: { name: string; startDate: string | null };
};

async function fetchUs(): Promise<UsData> {
  const [sheets, spaceRes] = await Promise.all([
    api.get<SheetsView>("/sheets"),
    api.get<{ space: { name: string; startDate: string | null } }>("/spaces/current"),
  ]);
  return { sheets, space: spaceRes.space };
}

function daysSince(dateKey: string): number {
  const from = new Date(`${dateKey}T00:00:00Z`).getTime();
  const now = new Date();
  const to = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((to - from) / 86_400_000));
}

export default function UsView() {
  const fetcher = useCallback(() => fetchUs(), []);
  const { data, error, reload } = useAsyncData(fetcher, "Không tải được trang này.");
  const [editing, setEditing] = useState(false);

  if (error) return <ErrorState message={error} onRetry={reload} />;

  if (!data) {
    return (
      <div className="space-y-6">
        <Skeleton className="mx-auto h-10 w-56" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  const { sheets, space } = data;

  // Before the sheet is handed in there is nothing else to look at — the form
  // is the whole screen.
  if (!sheets.iHaveFinished) {
    return (
      <SheetForm
        sheet={sheets.me}
        onSaved={() => {
          setEditing(false);
          reload();
        }}
      />
    );
  }

  if (editing) {
    return (
      <SheetForm
        sheet={sheets.me}
        onSaved={() => {
          setEditing(false);
          reload();
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="space-y-10">
      <header className="flex flex-col items-center pt-2 text-center">
        <TwoHearts className="mb-2 block text-[var(--color-rose-line)]" />
        <h1 className="script text-4xl leading-tight text-[var(--color-rose-deep)] sm:text-5xl">
          {space.name}
        </h1>
        {space.startDate ? (
          <p className="display mt-2 text-lg text-[var(--color-ink-soft)]">
            {daysSince(space.startDate).toLocaleString("vi-VN")} ngày, tính từ{" "}
            {formatDayShort(space.startDate)}
          </p>
        ) : null}
        <SquiggleDoodle className="mt-3 text-[var(--color-line-strong)]" />
      </header>

      <section>
        <div className="grid gap-7 pt-2 sm:grid-cols-2 sm:gap-5">
          <SheetView sheet={sheets.me} isMine tilt="tilt-left" onEdit={() => setEditing(true)} />

          {sheets.partner ? (
            <SheetView sheet={sheets.partner} isMine={false} tilt="tilt-right" />
          ) : (
            <LockedSheet
              partnerName={sheets.partnerName}
              reason={sheets.lockedReason ?? "no_partner"}
              tilt="tilt-right"
            />
          )}
        </div>

        {sheets.lockedReason === "no_partner" ? (
          <p className="mt-5 text-center">
            <Link href="/app/settings" className="btn btn-quiet">
              Gửi link mời
            </Link>
          </p>
        ) : null}
      </section>

      {features.bucketList ? (
        <section>
          <SectionHeading title="Bucket list" />
          <Link
            href="/app/bucket-list"
            className="card flex items-center gap-3 px-4 py-4 hover:shadow-[var(--shadow-lift)]"
          >
            <ListChecks size={20} className="text-[var(--color-rose)]" aria-hidden />
            <span className="flex-1 text-[0.9375rem] text-[var(--color-ink)]">
              Những thứ muốn làm cùng nhau
            </span>
            <span className="text-sm text-[var(--color-rose)]">Mở</span>
          </Link>
        </section>
      ) : null}
    </div>
  );
}
