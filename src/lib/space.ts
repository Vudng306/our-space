import { db } from "./db";
import { forbidden } from "./api";
import { dateKey } from "./datetime";
import { requireUser, type SessionUser } from "./session";
import type { MemberRole } from "../../generated/prisma/enums";

export type SpaceMemberView = {
  userId: string;
  displayName: string;
  email: string;
  avatarMediaId: string | null;
  birthday: string | null;
  hometown: string | null;
  occupation: string | null;
  bio: string | null;
  role: MemberRole;
  joinedAt: Date;
};

export type SpaceContext = {
  user: SessionUser;
  spaceId: string;
  space: { id: string; name: string; startDate: Date | null; createdById: string };
  role: MemberRole;
  members: SpaceMemberView[];
  partner: SpaceMemberView | null;
};

/**
 * The single gate every piece of space content passes through.
 *
 * Every read and write in the app derives its `spaceId` from here, never from
 * a URL or request body — that is what stops one couple reaching another's
 * data by guessing an id (spec §8, FR-04).
 */
export async function getSpaceContext(): Promise<SpaceContext | null> {
  const user = await requireUser();
  return getSpaceContextForUser(user);
}

export async function getSpaceContextForUser(user: SessionUser): Promise<SpaceContext | null> {
  const membership = await db.coupleMember.findFirst({
    where: { userId: user.id },
    orderBy: { joinedAt: "asc" },
    include: {
      space: {
        select: {
          id: true,
          name: true,
          startDate: true,
          createdById: true,
          members: {
            orderBy: { joinedAt: "asc" },
            include: {
              user: {
                select: {
                  id: true,
                  displayName: true,
                  email: true,
                  avatarMediaId: true,
                  birthday: true,
                  hometown: true,
                  occupation: true,
                  bio: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!membership) return null;

  const members: SpaceMemberView[] = membership.space.members.map((m) => ({
    userId: m.user.id,
    displayName: m.user.displayName,
    email: m.user.email,
    avatarMediaId: m.user.avatarMediaId,
    birthday: m.user.birthday ? dateKey(m.user.birthday) : null,
    hometown: m.user.hometown,
    occupation: m.user.occupation,
    bio: m.user.bio,
    role: m.role,
    joinedAt: m.joinedAt,
  }));

  return {
    user,
    spaceId: membership.space.id,
    space: {
      id: membership.space.id,
      name: membership.space.name,
      startDate: membership.space.startDate,
      createdById: membership.space.createdById,
    },
    role: membership.role,
    members,
    partner: members.find((m) => m.userId !== user.id) ?? null,
  };
}

/** Same as {@link getSpaceContext} but refuses to continue without a space. */
export async function requireSpace(): Promise<SpaceContext> {
  const ctx = await getSpaceContext();
  if (!ctx) throw forbidden("Bạn chưa thuộc không gian nào.");
  return ctx;
}

export async function requireOwner(): Promise<SpaceContext> {
  const ctx = await requireSpace();
  if (ctx.role !== "OWNER") throw forbidden("Chỉ người tạo không gian mới làm được việc này.");
  return ctx;
}

/** True when the id belongs to somebody in the caller's own space. */
export function isMemberOfSpace(ctx: SpaceContext, userId: string): boolean {
  return ctx.members.some((m) => m.userId === userId);
}
