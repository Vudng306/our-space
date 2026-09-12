import { z } from "zod";
import { db } from "@/lib/db";
import { badRequest, notFound } from "@/lib/api";
import { dateFromKey, dateKey, localDateValue } from "@/lib/datetime";
import type { SpaceContext } from "@/lib/space";
import { createMomentSchema, momentQuerySchema, updateMomentSchema } from "@/lib/validation";
import type { Mood } from "../../generated/prisma/enums";

export type MomentMediaDTO = {
  id: string;
  width: number;
  height: number;
  mimeType: string;
};

export type MomentDTO = {
  id: string;
  caption: string | null;
  occurredAt: string;
  timezone: string;
  localDate: string;
  mood: Mood | null;
  locationText: string | null;
  createdAt: string;
  updatedAt: string;
  author: { id: string; displayName: string; avatarMediaId: string | null };
  media: MomentMediaDTO[];
  tags: string[];
};

const momentInclude = {
  createdBy: { select: { id: true, displayName: true, avatarMediaId: true } },
  media: {
    orderBy: { sortOrder: "asc" as const },
    include: { media: { select: { id: true, width: true, height: true, mimeType: true } } },
  },
  tags: { include: { tag: { select: { name: true } } } },
};

type MomentRow = Awaited<ReturnType<typeof db.moment.findFirstOrThrow<{ include: typeof momentInclude }>>>;

export function toMomentDTO(row: MomentRow): MomentDTO {
  return {
    id: row.id,
    caption: row.caption,
    occurredAt: row.occurredAt.toISOString(),
    timezone: row.timezone,
    localDate: dateKey(row.localDate),
    mood: row.mood,
    locationText: row.locationText,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    author: {
      id: row.createdBy.id,
      displayName: row.createdBy.displayName,
      avatarMediaId: row.createdBy.avatarMediaId,
    },
    media: row.media.map((m) => ({
      id: m.media.id,
      width: m.media.width,
      height: m.media.height,
      mimeType: m.media.mimeType,
    })),
    tags: row.tags.map((t) => t.tag.name),
  };
}

// ---------------------------------------------------------------------------
// Cursor pagination
// ---------------------------------------------------------------------------

/**
 * The sort key is (occurredAt, id) so that adding a moment while somebody is
 * scrolling cannot make a row appear twice or vanish (spec §7.2).
 */
function encodeCursor(occurredAt: Date, id: string): string {
  return Buffer.from(`${occurredAt.toISOString()}|${id}`).toString("base64url");
}

function decodeCursor(cursor: string): { occurredAt: Date; id: string } {
  try {
    const [iso, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
    const occurredAt = new Date(iso);
    if (!id || Number.isNaN(occurredAt.getTime())) throw new Error("bad cursor");
    return { occurredAt, id };
  } catch {
    throw badRequest("That pagination cursor is not valid.");
  }
}

export type MomentQuery = z.infer<typeof momentQuerySchema>;

export async function listMoments(ctx: SpaceContext, query: MomentQuery) {
  const { cursor, limit, from, to, authorId, mood, tag, q } = query;

  const where: NonNullable<Parameters<typeof db.moment.findMany>[0]>["where"] = {
    spaceId: ctx.spaceId,
    deletedAt: null,
    ...(authorId ? { createdById: authorId } : {}),
    ...(mood ? { mood } : {}),
    ...(from || to
      ? {
          localDate: {
            ...(from ? { gte: dateFromKey(from) } : {}),
            ...(to ? { lte: dateFromKey(to) } : {}),
          },
        }
      : {}),
    ...(tag ? { tags: { some: { tag: { name: tag.toLowerCase() } } } } : {}),
    ...(q
      ? {
          OR: [
            { caption: { contains: q, mode: "insensitive" as const } },
            { locationText: { contains: q, mode: "insensitive" as const } },
            { tags: { some: { tag: { name: { contains: q.toLowerCase() } } } } },
          ],
        }
      : {}),
  };

  if (cursor) {
    const c = decodeCursor(cursor);
    where.AND = [
      {
        OR: [{ occurredAt: { lt: c.occurredAt } }, { occurredAt: c.occurredAt, id: { lt: c.id } }],
      },
    ];
  }

  const rows = await db.moment.findMany({
    where,
    include: momentInclude,
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page.at(-1);

  return {
    items: page.map(toMomentDTO),
    nextCursor: hasMore && last ? encodeCursor(last.occurredAt, last.id) : null,
  };
}

export async function getMoment(ctx: SpaceContext, id: string): Promise<MomentDTO> {
  const row = await db.moment.findFirst({
    // spaceId in the filter is what makes an id from another couple a 404.
    where: { id, spaceId: ctx.spaceId, deletedAt: null },
    include: momentInclude,
  });
  if (!row) throw notFound("That moment does not exist.");
  return toMomentDTO(row);
}

export async function getMomentsForDay(ctx: SpaceContext, day: string): Promise<MomentDTO[]> {
  const rows = await db.moment.findMany({
    where: { spaceId: ctx.spaceId, deletedAt: null, localDate: dateFromKey(day) },
    include: momentInclude,
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
  });
  return rows.map(toMomentDTO);
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/** Refuses media that was not uploaded into this space. */
async function assertMediaInSpace(ctx: SpaceContext, mediaIds: string[]) {
  if (!mediaIds.length) return;
  const count = await db.mediaAsset.count({
    where: { id: { in: mediaIds }, spaceId: ctx.spaceId, deletedAt: null },
  });
  if (count !== new Set(mediaIds).size) {
    throw badRequest("One of those photos is not available in this space.");
  }
}

async function resolveTagIds(spaceId: string, names: string[]): Promise<string[]> {
  const ids: string[] = [];
  for (const name of names) {
    const tag = await db.tag.upsert({
      where: { spaceId_name: { spaceId, name } },
      create: { spaceId, name },
      update: {},
      select: { id: true },
    });
    ids.push(tag.id);
  }
  return ids;
}

export async function createMoment(ctx: SpaceContext, input: unknown): Promise<MomentDTO> {
  const data = createMomentSchema.parse(input);

  if (!data.caption && data.mediaIds.length === 0) {
    throw badRequest("Add a photo or a few words — an empty moment has nothing to remember.");
  }
  await assertMediaInSpace(ctx, data.mediaIds);

  const occurredAt = new Date(data.occurredAt);
  const tagIds = await resolveTagIds(ctx.spaceId, data.tags ?? []);

  const created = await db.$transaction(async (tx) => {
    const moment = await tx.moment.create({
      data: {
        spaceId: ctx.spaceId,
        createdById: ctx.user.id,
        caption: data.caption ?? null,
        occurredAt,
        timezone: data.timezone,
        localDate: localDateValue(occurredAt, data.timezone),
        mood: data.mood ?? null,
        locationText: data.locationText ?? null,
        media: {
          create: data.mediaIds.map((mediaId, i) => ({ mediaId, sortOrder: i })),
        },
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
      },
      include: momentInclude,
    });
    return moment;
  });

  return toMomentDTO(created);
}

export async function updateMoment(ctx: SpaceContext, id: string, input: unknown): Promise<MomentDTO> {
  const data = updateMomentSchema.parse(input);

  const existing = await db.moment.findFirst({
    where: { id, spaceId: ctx.spaceId, deletedAt: null },
    include: { media: { select: { mediaId: true } } },
  });
  if (!existing) throw notFound("That moment does not exist.");

  if (data.mediaIds) await assertMediaInSpace(ctx, data.mediaIds);

  const occurredAt = data.occurredAt ? new Date(data.occurredAt) : existing.occurredAt;
  const timezone = data.timezone ?? existing.timezone;

  const updated = await db.$transaction(async (tx) => {
    if (data.mediaIds) {
      await tx.momentMedia.deleteMany({ where: { momentId: id } });
      await tx.momentMedia.createMany({
        data: data.mediaIds.map((mediaId, i) => ({ momentId: id, mediaId, sortOrder: i })),
      });
    }
    if (data.tags) {
      const tagIds = await resolveTagIds(ctx.spaceId, data.tags);
      await tx.momentTag.deleteMany({ where: { momentId: id } });
      if (tagIds.length) {
        await tx.momentTag.createMany({ data: tagIds.map((tagId) => ({ momentId: id, tagId })) });
      }
    }
    return tx.moment.update({
      where: { id },
      data: {
        ...(data.caption !== undefined ? { caption: data.caption } : {}),
        ...(data.mood !== undefined ? { mood: data.mood } : {}),
        ...(data.locationText !== undefined ? { locationText: data.locationText } : {}),
        ...(data.occurredAt || data.timezone
          ? { occurredAt, timezone, localDate: localDateValue(occurredAt, timezone) }
          : {}),
      },
      include: momentInclude,
    });
  });

  return toMomentDTO(updated);
}

/** Soft delete: recoverable for 30 days, then swept by the cleanup job. */
export async function deleteMoment(ctx: SpaceContext, id: string): Promise<void> {
  const result = await db.moment.updateMany({
    where: { id, spaceId: ctx.spaceId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  if (result.count === 0) throw notFound("That moment does not exist.");
}

export async function restoreMoment(ctx: SpaceContext, id: string): Promise<void> {
  const result = await db.moment.updateMany({
    where: { id, spaceId: ctx.spaceId, deletedAt: { not: null } },
    data: { deletedAt: null },
  });
  if (result.count === 0) throw notFound("There is nothing to restore.");
}

export async function listDeletedMoments(ctx: SpaceContext): Promise<MomentDTO[]> {
  const rows = await db.moment.findMany({
    where: { spaceId: ctx.spaceId, deletedAt: { not: null } },
    include: momentInclude,
    orderBy: { deletedAt: "desc" },
    take: 100,
  });
  return rows.map(toMomentDTO);
}

export async function listSpaceTags(ctx: SpaceContext): Promise<string[]> {
  const tags = await db.tag.findMany({
    where: { spaceId: ctx.spaceId, moments: { some: { moment: { deletedAt: null } } } },
    orderBy: { name: "asc" },
    select: { name: true },
  });
  return tags.map((t) => t.name);
}
