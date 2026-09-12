import { db } from "@/lib/db";
import { badRequest, conflict, forbidden, notFound } from "@/lib/api";
import { dateFromKey } from "@/lib/datetime";
import { env } from "@/lib/env";
import { generateToken, hashToken } from "@/lib/password";
import type { SpaceContext } from "@/lib/space";
import type { SessionUser } from "@/lib/session";
import { createSpaceSchema, updateSpaceSchema } from "@/lib/validation";

const INVITE_TTL_DAYS = 7;
export const MAX_MEMBERS = 2;

// ---------------------------------------------------------------------------
// Creating and editing the space
// ---------------------------------------------------------------------------

export async function createSpace(user: SessionUser, input: unknown) {
  const data = createSpaceSchema.parse(input);

  // FR-02: one active space per person.
  const existing = await db.coupleMember.findFirst({ where: { userId: user.id } });
  if (existing) throw conflict("Bạn đã ở trong một không gian rồi.");

  return db.$transaction(async (tx) => {
    const space = await tx.coupleSpace.create({
      data: {
        name: data.name,
        startDate: data.startDate ? dateFromKey(data.startDate) : null,
        createdById: user.id,
        members: { create: { userId: user.id, role: "OWNER" } },
      },
    });
    await tx.auditEvent.create({
      data: { spaceId: space.id, actorUserId: user.id, action: "space.created", targetType: "space", targetId: space.id },
    });
    return space;
  });
}

export async function updateSpace(ctx: SpaceContext, input: unknown) {
  const data = updateSpaceSchema.parse(input);
  return db.coupleSpace.update({
    where: { id: ctx.spaceId },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.startDate !== undefined
        ? { startDate: data.startDate ? dateFromKey(data.startDate) : null }
        : {}),
    },
  });
}

// ---------------------------------------------------------------------------
// Invitations (FR-03)
// ---------------------------------------------------------------------------

export type CreatedInvite = { id: string; url: string; token: string; expiresAt: Date };

/**
 * Mints a single-use invite. The raw token is returned exactly once, here —
 * only its SHA-256 hash is stored, so a database leak cannot be replayed into
 * somebody's space.
 */
export async function createInvite(ctx: SpaceContext): Promise<CreatedInvite> {
  const memberCount = await db.coupleMember.count({ where: { spaceId: ctx.spaceId } });
  if (memberCount >= MAX_MEMBERS) {
    throw conflict("Không gian này đã đủ hai người.");
  }

  // Only one invite can be outstanding at a time.
  await db.invite.updateMany({
    where: { spaceId: ctx.spaceId, acceptedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  const token = generateToken(32);
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

  const invite = await db.invite.create({
    data: {
      spaceId: ctx.spaceId,
      tokenHash: hashToken(token),
      createdById: ctx.user.id,
      expiresAt,
    },
  });

  return { id: invite.id, token, url: `${env.appUrl}/invite/${token}`, expiresAt };
}

export async function listInvites(ctx: SpaceContext) {
  const invites = await db.invite.findMany({
    where: { spaceId: ctx.spaceId },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, createdAt: true, expiresAt: true, acceptedAt: true, revokedAt: true },
  });
  return invites.map((i) => ({
    ...i,
    status: i.acceptedAt
      ? ("accepted" as const)
      : i.revokedAt
        ? ("revoked" as const)
        : i.expiresAt.getTime() < Date.now()
          ? ("expired" as const)
          : ("pending" as const),
  }));
}

export async function revokeInvite(ctx: SpaceContext, id: string) {
  const result = await db.invite.updateMany({
    where: { id, spaceId: ctx.spaceId, acceptedAt: null },
    data: { revokedAt: new Date() },
  });
  if (result.count === 0) throw notFound("Lời mời này không tồn tại.");
}

/** Public preview shown on the invite landing page — no private content. */
export async function peekInvite(token: string) {
  const invite = await db.invite.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      space: { select: { name: true, _count: { select: { members: true } } } },
      createdBy: { select: { displayName: true } },
    },
  });
  if (!invite) return { valid: false as const, reason: "unknown" as const };
  if (invite.acceptedAt) return { valid: false as const, reason: "used" as const };
  if (invite.revokedAt) return { valid: false as const, reason: "revoked" as const };
  if (invite.expiresAt.getTime() < Date.now()) return { valid: false as const, reason: "expired" as const };
  if (invite.space._count.members >= MAX_MEMBERS) {
    return { valid: false as const, reason: "full" as const };
  }
  return {
    valid: true as const,
    spaceName: invite.space.name,
    invitedBy: invite.createdBy.displayName,
    expiresAt: invite.expiresAt,
  };
}

export async function acceptInvite(user: SessionUser, token: string) {
  const tokenHash = hashToken(token);

  return db.$transaction(async (tx) => {
    const invite = await tx.invite.findUnique({ where: { tokenHash } });
    if (!invite) throw notFound("Link mời không hợp lệ.");
    if (invite.acceptedAt) throw conflict("Link mời này đã được dùng rồi.");
    if (invite.revokedAt) throw conflict("Link mời này đã bị huỷ.");
    if (invite.expiresAt.getTime() < Date.now()) throw conflict("Link mời đã hết hạn.");

    const existingMembership = await tx.coupleMember.findFirst({ where: { userId: user.id } });
    if (existingMembership) {
      if (existingMembership.spaceId === invite.spaceId) {
        throw conflict("Bạn đã ở trong không gian này rồi.");
      }
      throw conflict("Bạn đang ở trong một không gian khác.");
    }

    const memberCount = await tx.coupleMember.count({ where: { spaceId: invite.spaceId } });
    if (memberCount >= MAX_MEMBERS) throw conflict("Không gian này đã đủ người.");

    await tx.coupleMember.create({
      data: { spaceId: invite.spaceId, userId: user.id, role: "MEMBER" },
    });
    await tx.invite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date(), acceptedById: user.id },
    });
    await tx.auditEvent.create({
      data: {
        spaceId: invite.spaceId,
        actorUserId: user.id,
        action: "space.joined",
        targetType: "space",
        targetId: invite.spaceId,
      },
    });

    return tx.coupleSpace.findUniqueOrThrow({ where: { id: invite.spaceId } });
  });
}

// ---------------------------------------------------------------------------
// Leaving and deleting (FR-14, spec §5.1)
// ---------------------------------------------------------------------------

/**
 * Leaving keeps every shared memory in place — they belong to both of you.
 * If the owner leaves, ownership passes to whoever remains so the space is
 * never left without somebody who can manage it.
 */
export async function leaveSpace(ctx: SpaceContext) {
  const others = ctx.members.filter((m) => m.userId !== ctx.user.id);
  if (others.length === 0) {
    throw badRequest("Ở đây chỉ có mình bạn — hãy xoá cả không gian thay vì rời đi.");
  }

  await db.$transaction(async (tx) => {
    await tx.coupleMember.deleteMany({ where: { spaceId: ctx.spaceId, userId: ctx.user.id } });
    if (ctx.role === "OWNER") {
      await tx.coupleMember.updateMany({
        where: { spaceId: ctx.spaceId, userId: others[0].userId },
        data: { role: "OWNER" },
      });
    }
    await tx.auditEvent.create({
      data: {
        spaceId: ctx.spaceId,
        actorUserId: ctx.user.id,
        action: "space.left",
        targetType: "space",
        targetId: ctx.spaceId,
        metadata: { ownershipTransferredTo: ctx.role === "OWNER" ? others[0].userId : null },
      },
    });
  });
}

/**
 * Deletes the space and everything in it. Owner only, and the caller has to
 * retype the space name — the confirmation exists so one mistaken tap cannot
 * erase both people's history (spec §6.4).
 */
export async function deleteSpace(ctx: SpaceContext, confirmationPhrase: string) {
  if (ctx.role !== "OWNER") {
    throw forbidden("Chỉ người tạo không gian mới xoá được.");
  }
  if (confirmationPhrase.trim() !== ctx.space.name.trim()) {
    throw badRequest(`Gõ đúng tên không gian (${ctx.space.name}) để xác nhận.`);
  }

  const mediaKeys = await db.mediaAsset.findMany({
    where: { spaceId: ctx.spaceId },
    select: { objectKey: true, thumbKey: true },
  });

  await db.auditEvent.create({
    data: {
      actorUserId: ctx.user.id,
      action: "space.deleted",
      targetType: "space",
      targetId: ctx.spaceId,
      metadata: { name: ctx.space.name, members: ctx.members.map((m) => m.userId) },
    },
  });

  // Cascades clear moments, memories, preferences, media rows and members.
  await db.coupleSpace.delete({ where: { id: ctx.spaceId } });

  return mediaKeys.flatMap((m) => [m.objectKey, m.thumbKey].filter((k): k is string => Boolean(k)));
}
