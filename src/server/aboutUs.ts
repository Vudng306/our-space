import { db } from "@/lib/db";
import { badRequest, notFound } from "@/lib/api";
import { dateFromKey, dateKey, nextOccurrenceKey, daysBetweenKeys } from "@/lib/datetime";
import { isMemberOfSpace, type SpaceContext } from "@/lib/space";
import {
  createBucketItemSchema,
  createImportantDateSchema,
  createPreferenceSchema,
  updateBucketItemSchema,
  updateImportantDateSchema,
  updatePreferenceSchema,
} from "@/lib/validation";
import type {
  BucketStatus,
  PreferenceCategory,
  Recurrence,
  Sentiment,
} from "../../generated/prisma/enums";

// ---------------------------------------------------------------------------
// Preferences
// ---------------------------------------------------------------------------

export type PreferenceDTO = {
  id: string;
  personUserId: string;
  category: PreferenceCategory;
  value: string;
  sentiment: Sentiment;
  note: string | null;
  createdById: string;
  updatedAt: string;
};

export async function listPreferences(
  ctx: SpaceContext,
  filter?: { personUserId?: string; category?: PreferenceCategory },
): Promise<PreferenceDTO[]> {
  const rows = await db.preference.findMany({
    where: {
      spaceId: ctx.spaceId,
      ...(filter?.personUserId ? { personUserId: filter.personUserId } : {}),
      ...(filter?.category ? { category: filter.category } : {}),
    },
    orderBy: [{ category: "asc" }, { value: "asc" }],
  });
  return rows.map(toPreferenceDTO);
}

function toPreferenceDTO(r: {
  id: string;
  personUserId: string;
  category: PreferenceCategory;
  value: string;
  sentiment: Sentiment;
  note: string | null;
  createdById: string;
  updatedAt: Date;
}): PreferenceDTO {
  return {
    id: r.id,
    personUserId: r.personUserId,
    category: r.category,
    value: r.value,
    sentiment: r.sentiment,
    note: r.note,
    createdById: r.createdById,
    updatedAt: r.updatedAt.toISOString(),
  };
}

export async function createPreference(ctx: SpaceContext, input: unknown): Promise<PreferenceDTO> {
  const data = createPreferenceSchema.parse(input);
  // A preference can only ever describe one of the two people in this space.
  if (!isMemberOfSpace(ctx, data.personUserId)) {
    throw badRequest("Chỉ lưu được sở thích của bạn hoặc người kia.");
  }
  const created = await db.preference.create({
    data: {
      spaceId: ctx.spaceId,
      personUserId: data.personUserId,
      createdById: ctx.user.id,
      category: data.category,
      value: data.value,
      sentiment: data.sentiment,
      note: data.note ?? null,
    },
  });
  return toPreferenceDTO(created);
}

export async function updatePreference(
  ctx: SpaceContext,
  id: string,
  input: unknown,
): Promise<PreferenceDTO> {
  const data = updatePreferenceSchema.parse(input);
  const existing = await db.preference.findFirst({ where: { id, spaceId: ctx.spaceId } });
  if (!existing) throw notFound("Mục này không tồn tại.");

  const updated = await db.preference.update({
    where: { id },
    data: {
      ...(data.category !== undefined ? { category: data.category } : {}),
      ...(data.value !== undefined ? { value: data.value } : {}),
      ...(data.sentiment !== undefined ? { sentiment: data.sentiment } : {}),
      ...(data.note !== undefined ? { note: data.note } : {}),
    },
  });
  return toPreferenceDTO(updated);
}

export async function deletePreference(ctx: SpaceContext, id: string): Promise<void> {
  const result = await db.preference.deleteMany({ where: { id, spaceId: ctx.spaceId } });
  if (result.count === 0) throw notFound("Mục này không tồn tại.");
}

// ---------------------------------------------------------------------------
// Important dates
// ---------------------------------------------------------------------------

export type ImportantDateDTO = {
  id: string;
  title: string;
  eventDate: string;
  recurrence: Recurrence;
  note: string | null;
  /** Next time it comes round, or null for a one-off already in the past. */
  nextOccurrence: string | null;
  daysUntil: number | null;
};

export async function listImportantDates(ctx: SpaceContext, todayKey: string): Promise<ImportantDateDTO[]> {
  const rows = await db.importantDate.findMany({
    where: { spaceId: ctx.spaceId },
    orderBy: { eventDate: "asc" },
  });

  return rows
    .map((r) => {
      const eventKey = dateKey(r.eventDate);
      const next = nextOccurrenceKey(eventKey, r.recurrence, todayKey);
      return {
        id: r.id,
        title: r.title,
        eventDate: eventKey,
        recurrence: r.recurrence,
        note: r.note,
        nextOccurrence: next,
        daysUntil: next ? daysBetweenKeys(todayKey, next) : null,
      };
    })
    .sort((a, b) => {
      if (a.daysUntil === null && b.daysUntil === null) return a.eventDate < b.eventDate ? 1 : -1;
      if (a.daysUntil === null) return 1;
      if (b.daysUntil === null) return -1;
      return a.daysUntil - b.daysUntil;
    });
}

export async function createImportantDate(ctx: SpaceContext, input: unknown, todayKey: string) {
  const data = createImportantDateSchema.parse(input);
  const created = await db.importantDate.create({
    data: {
      spaceId: ctx.spaceId,
      title: data.title,
      eventDate: dateFromKey(data.eventDate),
      recurrence: data.recurrence,
      note: data.note ?? null,
    },
  });
  const eventKey = dateKey(created.eventDate);
  const next = nextOccurrenceKey(eventKey, created.recurrence, todayKey);
  return {
    id: created.id,
    title: created.title,
    eventDate: eventKey,
    recurrence: created.recurrence,
    note: created.note,
    nextOccurrence: next,
    daysUntil: next ? daysBetweenKeys(todayKey, next) : null,
  } satisfies ImportantDateDTO;
}

export async function updateImportantDate(ctx: SpaceContext, id: string, input: unknown) {
  const data = updateImportantDateSchema.parse(input);
  const existing = await db.importantDate.findFirst({ where: { id, spaceId: ctx.spaceId } });
  if (!existing) throw notFound("Ngày này không tồn tại.");

  await db.importantDate.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.eventDate ? { eventDate: dateFromKey(data.eventDate) } : {}),
      ...(data.recurrence !== undefined ? { recurrence: data.recurrence } : {}),
      ...(data.note !== undefined ? { note: data.note } : {}),
    },
  });
}

export async function deleteImportantDate(ctx: SpaceContext, id: string): Promise<void> {
  const result = await db.importantDate.deleteMany({ where: { id, spaceId: ctx.spaceId } });
  if (result.count === 0) throw notFound("Ngày này không tồn tại.");
}

// ---------------------------------------------------------------------------
// Bucket list
// ---------------------------------------------------------------------------

export type BucketItemDTO = {
  id: string;
  title: string;
  note: string | null;
  status: BucketStatus;
  targetDate: string | null;
  completedAt: string | null;
  createdById: string;
};

export async function listBucketItems(ctx: SpaceContext): Promise<BucketItemDTO[]> {
  const rows = await db.bucketListItem.findMany({
    where: { spaceId: ctx.spaceId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    note: r.note,
    status: r.status,
    targetDate: r.targetDate ? dateKey(r.targetDate) : null,
    completedAt: r.completedAt?.toISOString() ?? null,
    createdById: r.createdById,
  }));
}

export async function createBucketItem(ctx: SpaceContext, input: unknown): Promise<BucketItemDTO> {
  const data = createBucketItemSchema.parse(input);
  const created = await db.bucketListItem.create({
    data: {
      spaceId: ctx.spaceId,
      createdById: ctx.user.id,
      title: data.title,
      note: data.note ?? null,
      status: data.status,
      targetDate: data.targetDate ? dateFromKey(data.targetDate) : null,
      completedAt: data.status === "DONE" ? new Date() : null,
    },
  });
  return {
    id: created.id,
    title: created.title,
    note: created.note,
    status: created.status,
    targetDate: created.targetDate ? dateKey(created.targetDate) : null,
    completedAt: created.completedAt?.toISOString() ?? null,
    createdById: created.createdById,
  };
}

export async function updateBucketItem(ctx: SpaceContext, id: string, input: unknown): Promise<void> {
  const data = updateBucketItemSchema.parse(input);
  const existing = await db.bucketListItem.findFirst({ where: { id, spaceId: ctx.spaceId } });
  if (!existing) throw notFound("Mục này không tồn tại.");

  // completedAt tracks status rather than being set by the client.
  const completedAt =
    data.status === undefined
      ? undefined
      : data.status === "DONE"
        ? (existing.completedAt ?? new Date())
        : null;

  await db.bucketListItem.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.note !== undefined ? { note: data.note } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.targetDate !== undefined
        ? { targetDate: data.targetDate ? dateFromKey(data.targetDate) : null }
        : {}),
      ...(completedAt !== undefined ? { completedAt } : {}),
    },
  });
}

export async function deleteBucketItem(ctx: SpaceContext, id: string): Promise<void> {
  const result = await db.bucketListItem.deleteMany({ where: { id, spaceId: ctx.spaceId } });
  if (result.count === 0) throw notFound("Mục này không tồn tại.");
}
