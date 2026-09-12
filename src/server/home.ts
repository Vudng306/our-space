import { db } from "@/lib/db";
import { dateFromKey, dateKey, daysBetweenKeys } from "@/lib/datetime";
import type { SpaceContext } from "@/lib/space";
import { listImportantDates, type ImportantDateDTO } from "./aboutUs";
import { getMomentsForDay, toMomentDTO, type MomentDTO } from "./moments";

export type HomeSummary = {
  spaceName: string;
  startDate: string | null;
  daysTogether: number | null;
  today: string;
  todayMoments: MomentDTO[];
  upcomingDates: ImportantDateDTO[];
  /** A moment from a previous year on this date, if one exists. */
  onThisDay: MomentDTO | null;
  /** Otherwise, something from the archive worth seeing again. */
  randomMemory: MomentDTO | null;
  totals: { moments: number; memories: number; photos: number };
};

const momentInclude = {
  createdBy: { select: { id: true, displayName: true, avatarMediaId: true } },
  media: {
    orderBy: { sortOrder: "asc" as const },
    include: { media: { select: { id: true, width: true, height: true, mimeType: true } } },
  },
  tags: { include: { tag: { select: { name: true } } } },
};

export async function getHomeSummary(ctx: SpaceContext, todayKey: string): Promise<HomeSummary> {
  const startKey = ctx.space.startDate ? dateKey(ctx.space.startDate) : null;

  const [todayMoments, upcomingDates, totals, onThisDay] = await Promise.all([
    getMomentsForDay(ctx, todayKey),
    listImportantDates(ctx, todayKey),
    getTotals(ctx),
    findOnThisDay(ctx, todayKey),
  ]);

  const randomMemory = onThisDay ? null : await findRandomMoment(ctx, todayKey);

  return {
    spaceName: ctx.space.name,
    startDate: startKey,
    daysTogether: startKey ? daysBetweenKeys(startKey, todayKey) : null,
    today: todayKey,
    todayMoments,
    upcomingDates: upcomingDates.filter((d) => d.daysUntil !== null && d.daysUntil <= 365).slice(0, 3),
    onThisDay,
    randomMemory,
    totals,
  };
}

async function getTotals(ctx: SpaceContext) {
  const [moments, memories, photos] = await Promise.all([
    db.moment.count({ where: { spaceId: ctx.spaceId, deletedAt: null } }),
    db.memory.count({ where: { spaceId: ctx.spaceId, deletedAt: null } }),
    db.momentMedia.count({ where: { moment: { spaceId: ctx.spaceId, deletedAt: null } } }),
  ]);
  return { moments, memories, photos };
}

/** Same month and day, any earlier year. */
async function findOnThisDay(ctx: SpaceContext, todayKey: string): Promise<MomentDTO | null> {
  const monthDay = todayKey.slice(5);
  const thisYear = Number(todayKey.slice(0, 4));

  const candidateKeys: Date[] = [];
  for (let y = thisYear - 1; y >= thisYear - 25; y--) {
    candidateKeys.push(dateFromKey(`${y}-${monthDay}`));
  }

  const row = await db.moment.findFirst({
    where: { spaceId: ctx.spaceId, deletedAt: null, localDate: { in: candidateKeys } },
    include: momentInclude,
    orderBy: { occurredAt: "desc" },
  });
  return row ? toMomentDTO(row) : null;
}

/**
 * A light "remember this?" card. Picks by offset rather than SQL RANDOM() so
 * it stays portable, and skips today so Home does not echo itself.
 */
async function findRandomMoment(ctx: SpaceContext, todayKey: string): Promise<MomentDTO | null> {
  const where = {
    spaceId: ctx.spaceId,
    deletedAt: null,
    localDate: { lt: dateFromKey(todayKey) },
  };
  const total = await db.moment.count({ where });
  if (total === 0) return null;

  const row = await db.moment.findFirst({
    where,
    include: momentInclude,
    orderBy: { id: "asc" },
    skip: Math.floor(Math.random() * total),
  });
  return row ? toMomentDTO(row) : null;
}

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

export type CalendarDay = {
  date: string;
  momentCount: number;
  /** First photo of the day, for the thumbnail indicator. */
  coverMediaId: string | null;
  importantDates: { id: string; title: string; recurrence: string }[];
};

/**
 * Returns one entry per day that has something on it. Deliberately does not
 * load captions or full moments — the calendar only needs indicators (FR-08).
 */
export async function getCalendar(ctx: SpaceContext, fromKey: string, toKey: string): Promise<CalendarDay[]> {
  const from = dateFromKey(fromKey);
  const to = dateFromKey(toKey);

  const [moments, dates] = await Promise.all([
    db.moment.findMany({
      where: { spaceId: ctx.spaceId, deletedAt: null, localDate: { gte: from, lte: to } },
      select: {
        id: true,
        localDate: true,
        occurredAt: true,
        media: {
          orderBy: { sortOrder: "asc" },
          take: 1,
          select: { mediaId: true },
        },
      },
      orderBy: { occurredAt: "asc" },
    }),
    db.importantDate.findMany({ where: { spaceId: ctx.spaceId } }),
  ]);

  const byDay = new Map<string, CalendarDay>();
  const dayOf = (date: string): CalendarDay => {
    let entry = byDay.get(date);
    if (!entry) {
      entry = { date, momentCount: 0, coverMediaId: null, importantDates: [] };
      byDay.set(date, entry);
    }
    return entry;
  };

  for (const m of moments) {
    const entry = dayOf(dateKey(m.localDate));
    entry.momentCount += 1;
    if (!entry.coverMediaId && m.media[0]) entry.coverMediaId = m.media[0].mediaId;
  }

  // Yearly dates are expanded across every year the requested range touches.
  const fromYear = Number(fromKey.slice(0, 4));
  const toYear = Number(toKey.slice(0, 4));
  for (const d of dates) {
    const eventKey = dateKey(d.eventDate);
    const occurrences: string[] =
      d.recurrence === "YEARLY"
        ? Array.from({ length: toYear - fromYear + 1 }, (_, i) =>
            dateKey(
              new Date(
                Date.UTC(fromYear + i, Number(eventKey.slice(5, 7)) - 1, Number(eventKey.slice(8, 10))),
              ),
            ),
          )
        : [eventKey];

    for (const key of occurrences) {
      if (key >= fromKey && key <= toKey) {
        dayOf(key).importantDates.push({ id: d.id, title: d.title, recurrence: d.recurrence });
      }
    }
  }

  return [...byDay.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

// ---------------------------------------------------------------------------
// Search (FR-12) — database text matching, no external index
// ---------------------------------------------------------------------------

export type SearchResults = {
  query: string;
  moments: MomentDTO[];
  memories: { id: string; title: string; startDate: string; description: string | null }[];
  preferences: { id: string; personUserId: string; category: string; value: string; sentiment: string }[];
  bucketItems: { id: string; title: string; status: string }[];
  importantDates: { id: string; title: string; eventDate: string }[];
};

export async function search(ctx: SpaceContext, q: string, limit: number): Promise<SearchResults> {
  const like = { contains: q, mode: "insensitive" as const };

  const [moments, memories, preferences, bucketItems, importantDates] = await Promise.all([
    db.moment.findMany({
      where: {
        spaceId: ctx.spaceId,
        deletedAt: null,
        OR: [
          { caption: like },
          { locationText: like },
          { tags: { some: { tag: { name: { contains: q.toLowerCase() } } } } },
        ],
      },
      include: momentInclude,
      orderBy: { occurredAt: "desc" },
      take: limit,
    }),
    db.memory.findMany({
      where: {
        spaceId: ctx.spaceId,
        deletedAt: null,
        OR: [{ title: like }, { description: like }],
      },
      orderBy: { startDate: "desc" },
      take: limit,
    }),
    db.preference.findMany({
      where: { spaceId: ctx.spaceId, OR: [{ value: like }, { note: like }] },
      take: limit,
    }),
    db.bucketListItem.findMany({
      where: { spaceId: ctx.spaceId, OR: [{ title: like }, { note: like }] },
      take: limit,
    }),
    db.importantDate.findMany({
      where: { spaceId: ctx.spaceId, OR: [{ title: like }, { note: like }] },
      take: limit,
    }),
  ]);

  return {
    query: q,
    moments: moments.map(toMomentDTO),
    memories: memories.map((m) => ({
      id: m.id,
      title: m.title,
      startDate: dateKey(m.startDate),
      description: m.description,
    })),
    preferences: preferences.map((p) => ({
      id: p.id,
      personUserId: p.personUserId,
      category: p.category,
      value: p.value,
      sentiment: p.sentiment,
    })),
    bucketItems: bucketItems.map((b) => ({ id: b.id, title: b.title, status: b.status })),
    importantDates: importantDates.map((d) => ({
      id: d.id,
      title: d.title,
      eventDate: dateKey(d.eventDate),
    })),
  };
}
