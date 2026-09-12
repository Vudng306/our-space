import { db } from "@/lib/db";
import { badRequest, notFound } from "@/lib/api";
import { dateFromKey, dateKey } from "@/lib/datetime";
import type { SpaceContext } from "@/lib/space";
import { createMemorySchema, updateMemorySchema } from "@/lib/validation";
import { toMomentDTO, type MomentDTO } from "./moments";

export type MemoryDTO = {
  id: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string | null;
  coverMediaId: string | null;
  momentCount: number;
  createdAt: string;
};

export type MemoryDetailDTO = MemoryDTO & { moments: MomentDTO[] };

const listInclude = {
  _count: { select: { moments: true } },
};

const detailInclude = {
  _count: { select: { moments: true } },
  moments: {
    include: {
      moment: {
        include: {
          createdBy: { select: { id: true, displayName: true, avatarMediaId: true } },
          media: {
            orderBy: { sortOrder: "asc" as const },
            include: { media: { select: { id: true, width: true, height: true, mimeType: true } } },
          },
          tags: { include: { tag: { select: { name: true } } } },
        },
      },
    },
  },
};

export async function listMemories(ctx: SpaceContext): Promise<MemoryDTO[]> {
  const rows = await db.memory.findMany({
    where: { spaceId: ctx.spaceId, deletedAt: null },
    include: listInclude,
    orderBy: [{ startDate: "desc" }, { id: "desc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    startDate: dateKey(r.startDate),
    endDate: r.endDate ? dateKey(r.endDate) : null,
    coverMediaId: r.coverMediaId,
    momentCount: r._count.moments,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function getMemory(ctx: SpaceContext, id: string): Promise<MemoryDetailDTO> {
  const row = await db.memory.findFirst({
    where: { id, spaceId: ctx.spaceId, deletedAt: null },
    include: detailInclude,
  });
  if (!row) throw notFound("That memory does not exist.");

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    startDate: dateKey(row.startDate),
    endDate: row.endDate ? dateKey(row.endDate) : null,
    coverMediaId: row.coverMediaId,
    momentCount: row._count.moments,
    createdAt: row.createdAt.toISOString(),
    moments: row.moments
      .filter((link) => link.moment.deletedAt === null)
      .map((link) => toMomentDTO(link.moment))
      .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1)),
  };
}

/** Both cover art and linked moments have to already belong to this space. */
async function assertReferences(ctx: SpaceContext, coverMediaId?: string | null, momentIds?: string[]) {
  if (coverMediaId) {
    const cover = await db.mediaAsset.count({
      where: { id: coverMediaId, spaceId: ctx.spaceId, deletedAt: null },
    });
    if (cover === 0) throw badRequest("That cover photo is not available in this space.");
  }
  if (momentIds?.length) {
    const count = await db.moment.count({
      where: { id: { in: momentIds }, spaceId: ctx.spaceId, deletedAt: null },
    });
    if (count !== new Set(momentIds).size) {
      throw badRequest("One of those moments is not available in this space.");
    }
  }
}

export async function createMemory(ctx: SpaceContext, input: unknown): Promise<MemoryDTO> {
  const data = createMemorySchema.parse(input);
  await assertReferences(ctx, data.coverMediaId, data.momentIds);

  const created = await db.memory.create({
    data: {
      spaceId: ctx.spaceId,
      title: data.title,
      description: data.description ?? null,
      startDate: dateFromKey(data.startDate),
      endDate: data.endDate ? dateFromKey(data.endDate) : null,
      coverMediaId: data.coverMediaId ?? null,
      moments: { create: (data.momentIds ?? []).map((momentId) => ({ momentId })) },
    },
    include: listInclude,
  });

  return {
    id: created.id,
    title: created.title,
    description: created.description,
    startDate: dateKey(created.startDate),
    endDate: created.endDate ? dateKey(created.endDate) : null,
    coverMediaId: created.coverMediaId,
    momentCount: created._count.moments,
    createdAt: created.createdAt.toISOString(),
  };
}

export async function updateMemory(ctx: SpaceContext, id: string, input: unknown): Promise<MemoryDTO> {
  const data = updateMemorySchema.parse(input);

  const existing = await db.memory.findFirst({ where: { id, spaceId: ctx.spaceId, deletedAt: null } });
  if (!existing) throw notFound("That memory does not exist.");

  await assertReferences(ctx, data.coverMediaId, data.momentIds);

  const updated = await db.$transaction(async (tx) => {
    if (data.momentIds) {
      await tx.memoryMoment.deleteMany({ where: { memoryId: id } });
      if (data.momentIds.length) {
        await tx.memoryMoment.createMany({
          data: data.momentIds.map((momentId) => ({ memoryId: id, momentId })),
        });
      }
    }
    return tx.memory.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.startDate ? { startDate: dateFromKey(data.startDate) } : {}),
        ...(data.endDate !== undefined
          ? { endDate: data.endDate ? dateFromKey(data.endDate) : null }
          : {}),
        ...(data.coverMediaId !== undefined ? { coverMediaId: data.coverMediaId } : {}),
      },
      include: listInclude,
    });
  });

  return {
    id: updated.id,
    title: updated.title,
    description: updated.description,
    startDate: dateKey(updated.startDate),
    endDate: updated.endDate ? dateKey(updated.endDate) : null,
    coverMediaId: updated.coverMediaId,
    momentCount: updated._count.moments,
    createdAt: updated.createdAt.toISOString(),
  };
}

export async function deleteMemory(ctx: SpaceContext, id: string): Promise<void> {
  const result = await db.memory.updateMany({
    where: { id, spaceId: ctx.spaceId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  if (result.count === 0) throw notFound("That memory does not exist.");
}
