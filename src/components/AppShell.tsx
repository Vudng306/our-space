"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  CalendarDays,
  Heart,
  Home,
  ListChecks,
  Plus,
  Search,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import { features } from "@/lib/features";
import { Avatar } from "./ui";

type Person = { id: string; displayName: string; avatarMediaId: string | null };

/**
 * Only what is switched on appears here. With the daily loop off, that leaves
 * a single destination and the navigation disappears entirely — which is the
 * point: the app should look like the one thing it currently does.
 */
const NAV = [
  {
    href: "/app",
    label: features.moments ? "Hôm nay" : "Hai chúng mình",
    icon: features.moments ? Home : Users,
    exact: true,
    on: true,
  },
  { href: "/app/timeline", label: "Dòng thời gian", icon: Sparkles, exact: false, on: features.timeline },
  { href: "/app/calendar", label: "Lịch", icon: CalendarDays, exact: false, on: features.calendar },
  { href: "/app/memories", label: "Kỷ niệm", icon: Heart, exact: false, on: features.memories },
  { href: "/app/bucket-list", label: "Muốn làm", icon: ListChecks, exact: false, on: features.bucketList },
].filter((item) => item.on);

function isActive(pathname: string, href: string, exact: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppShell({
  spaceName,
  me,
  partner,
  children,
}: {
  spaceName: string;
  me: Person;
  partner: Person | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // The composer is a full screen of its own; the chrome would only crowd it.
  const composing = pathname.startsWith("/app/moments/new") || pathname.endsWith("/edit");

  return (
    <div className="min-h-dvh">
      {/* Desktop navigation */}
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-dashed border-[var(--color-line-strong)] bg-[var(--color-sheet)]/70 px-4 py-6",
          NAV.length > 1 && "lg:flex",
        )}
      >
        <Link href="/app" className="mb-8 block px-2">
          <span className="script text-2xl text-[var(--color-rose-deep)]">{spaceName}</span>
          <span className="display mt-0.5 block text-sm text-[var(--color-ink-faint)]">Our Space</span>
        </Link>

        <nav className="flex flex-1 flex-col gap-1" aria-label="Main">
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(pathname, href, exact);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "display flex items-center gap-3 rounded-[var(--radius-pill)] px-3 py-2 text-[1.0625rem] transition-colors",
                  active
                    ? "bg-[var(--color-rose-soft)] text-[var(--color-rose-deep)]"
                    : "text-[var(--color-ink-soft)] hover:bg-[var(--color-paper-deep)] hover:text-[var(--color-ink)]",
                )}
              >
                <Icon size={18} aria-hidden />
                {label}
              </Link>
            );
          })}

          {features.search ? (
            <Link
              href="/app/search"
              className="display mt-1 flex items-center gap-3 rounded-[var(--radius-pill)] px-3 py-2 text-[1.0625rem] text-[var(--color-ink-soft)] transition-colors hover:bg-[var(--color-paper-deep)] hover:text-[var(--color-ink)]"
            >
              <Search size={18} aria-hidden />
              Tìm kiếm
            </Link>
          ) : null}
        </nav>

        {features.moments ? (
          <Link href="/app/moments/new" className="btn btn-primary mb-4 w-full" aria-label="Thêm khoảnh khắc">
            <Plus size={18} aria-hidden />
            Thêm khoảnh khắc
          </Link>
        ) : null}

        <div className="flex items-center justify-between gap-2 border-t border-dashed border-[var(--color-line-strong)] pt-4">
          <div className="flex items-center gap-2 overflow-hidden">
            <Avatar name={me.displayName} mediaId={me.avatarMediaId} size={28} />
            {partner ? <Avatar name={partner.displayName} mediaId={partner.avatarMediaId} size={28} /> : null}
            <span className="display truncate text-sm text-[var(--color-ink-soft)]">
              {partner ? `${me.displayName} & ${partner.displayName}` : me.displayName}
            </span>
          </div>
          <Link href="/app/settings" className="btn btn-ghost p-2" aria-label="Cài đặt">
            <Settings size={18} aria-hidden />
          </Link>
        </div>
      </aside>

      {/* Mobile header */}
      <header
        className={clsx(
          "sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-dashed border-[var(--color-line-strong)] bg-[var(--color-paper)]/85 px-4 py-2.5 backdrop-blur",
          NAV.length > 1 && "lg:hidden",
        )}
      >
        <Link href="/app" className="script truncate text-2xl text-[var(--color-rose-deep)]">
          {spaceName}
        </Link>
        <div className="flex items-center gap-1">
          {features.search ? (
            <Link href="/app/search" className="btn btn-ghost p-2" aria-label="Tìm kiếm">
              <Search size={20} aria-hidden />
            </Link>
          ) : null}
          <Link href="/app/settings" className="btn btn-ghost p-2" aria-label="Cài đặt">
            <Settings size={20} aria-hidden />
          </Link>
        </div>
      </header>

      <main className={clsx(NAV.length > 1 && "lg:pl-60")}>
        <div
          className={clsx(
            "mx-auto w-full max-w-[1100px] px-4 py-5 sm:px-6 lg:py-8",
            composing || NAV.length <= 1 ? "pb-8" : "pb-28 lg:pb-8",
          )}
        >
          {children}
        </div>
      </main>

      {/* Mobile bottom navigation + primary action */}
      {!composing && NAV.length > 1 ? (
        <>
          {features.moments ? (
            <Link
              href="/app/moments/new"
              aria-label="Thêm khoảnh khắc"
              className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-rose)] text-white shadow-[var(--shadow-lift)] transition-colors hover:bg-[var(--color-rose-deep)] lg:hidden"
            >
              <Plus size={24} aria-hidden />
            </Link>
          ) : null}

          <nav
            aria-label="Main"
            className="fixed inset-x-0 bottom-0 z-30 border-t border-dashed border-[var(--color-line-strong)] bg-[var(--color-sheet)]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
          >
            <ul className="flex">
              {NAV.map(({ href, label, icon: Icon, exact }) => {
                const active = isActive(pathname, href, exact);
                return (
                  <li key={href} className="flex-1">
                    <Link
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={clsx(
                        "display flex flex-col items-center gap-1 px-1 py-2.5 text-[0.8125rem] transition-colors",
                        active ? "text-[var(--color-rose-deep)]" : "text-[var(--color-ink-faint)]",
                      )}
                    >
                      <Icon size={20} aria-hidden />
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </>
      ) : null}
    </div>
  );
}
