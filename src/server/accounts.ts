import { db } from "@/lib/db";
import { badRequest, conflict, forbidden, notFound, unauthorized } from "@/lib/api";
import { dateFromKey } from "@/lib/datetime";
import { isMemberOfSpace, type SpaceContext } from "@/lib/space";
import { env } from "@/lib/env";
import {
  burnPasswordTime,
  generateToken,
  hashPassword,
  hashToken,
  verifyPassword,
} from "@/lib/password";
import { destroyAllSessions, type SessionUser } from "@/lib/session";
import { storage } from "@/lib/storage";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updatePersonSchema,
  updateProfileSchema,
} from "@/lib/validation";

const RESET_TTL_MINUTES = 60;

export async function registerUser(input: unknown) {
  const data = registerSchema.parse(input);

  if (env.registrationDisabled) {
    throw forbidden("Bản này đã đóng đăng ký mới.");
  }

  const existing = await db.user.findUnique({ where: { email: data.email } });
  if (existing) throw conflict("Email này đã có tài khoản rồi.");

  const user = await db.user.create({
    data: {
      email: data.email,
      passwordHash: await hashPassword(data.password),
      displayName: data.displayName,
    },
    select: { id: true, email: true, displayName: true, avatarMediaId: true },
  });

  return user satisfies SessionUser;
}

export async function authenticate(input: unknown): Promise<SessionUser> {
  const data = loginSchema.parse(input);

  const user = await db.user.findUnique({ where: { email: data.email } });
  if (!user || user.deletedAt) {
    // Keep the timing similar whether or not the account exists.
    await burnPasswordTime();
    throw unauthorized("Email hoặc mật khẩu không đúng.");
  }

  const ok = await verifyPassword(data.password, user.passwordHash);
  if (!ok) throw unauthorized("Email hoặc mật khẩu không đúng.");

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarMediaId: user.avatarMediaId,
  };
}

export async function updateProfile(user: SessionUser, input: unknown) {
  const data = updateProfileSchema.parse(input);

  if (data.avatarMediaId) {
    const owned = await db.mediaAsset.count({
      where: { id: data.avatarMediaId, uploadedById: user.id, deletedAt: null },
    });
    if (owned === 0) throw badRequest("Ảnh này không dùng được.");
  }

  return db.user.update({
    where: { id: user.id },
    data: {
      ...(data.displayName !== undefined ? { displayName: data.displayName } : {}),
      ...(data.avatarMediaId !== undefined ? { avatarMediaId: data.avatarMediaId } : {}),
    },
    select: { id: true, email: true, displayName: true, avatarMediaId: true },
  });
}

/**
 * Updates the "about this person" fields.
 *
 * Either member may edit either person, so one of you can write down the
 * other birthday or where they grew up before they have ever signed in. The
 * account identity — display name, avatar, email — stays self-service.
 */
export async function updatePersonProfile(ctx: SpaceContext, personUserId: string, input: unknown) {
  if (!isMemberOfSpace(ctx, personUserId)) {
    throw badRequest("Chỉ sửa được hồ sơ của hai người trong không gian này.");
  }
  const data = updatePersonSchema.parse(input);

  return db.user.update({
    where: { id: personUserId },
    data: {
      ...(data.birthday !== undefined
        ? { birthday: data.birthday ? dateFromKey(data.birthday) : null }
        : {}),
      ...(data.hometown !== undefined ? { hometown: data.hometown } : {}),
      ...(data.occupation !== undefined ? { occupation: data.occupation } : {}),
      ...(data.bio !== undefined ? { bio: data.bio } : {}),
    },
    select: {
      id: true,
      displayName: true,
      birthday: true,
      hometown: true,
      occupation: true,
      bio: true,
    },
  });
}

export async function changePassword(user: SessionUser, input: unknown) {
  const data = changePasswordSchema.parse(input);
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });

  if (!(await verifyPassword(data.currentPassword, row.passwordHash))) {
    throw unauthorized("Mật khẩu hiện tại không đúng.");
  }

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(data.newPassword) },
  });
  // Every other device is signed out; the caller gets a fresh session.
  await destroyAllSessions(user.id);
}

// ---------------------------------------------------------------------------
// Password reset (FR-01)
// ---------------------------------------------------------------------------

/**
 * Always reports success, so the endpoint cannot be used to find out which
 * addresses have accounts. With no SMTP configured the link is written to the
 * server log — enough for a two-person instance.
 */
export async function requestPasswordReset(input: unknown): Promise<{ devLink?: string }> {
  const data = forgotPasswordSchema.parse(input);
  const user = await db.user.findUnique({ where: { email: data.email } });
  if (!user || user.deletedAt) return {};

  await db.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const token = generateToken(32);
  await db.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000),
    },
  });

  const link = `${env.appUrl}/reset-password/${token}`;
  if (env.SMTP_URL) {
    await sendResetEmail(user.email, link);
  } else {
    console.info(`[auth] password reset link for ${user.email}: ${link}`);
  }

  // Only ever surfaced outside production, so local setup does not need SMTP.
  return env.isProduction ? {} : { devLink: link };
}

async function sendResetEmail(to: string, link: string) {
  const { createTransport } = await import("nodemailer");
  const transport = createTransport(env.SMTP_URL!);
  await transport.sendMail({
    to,
    from: env.SMTP_FROM,
    subject: "Đặt lại mật khẩu Our Space",
    text: `Mở link này để chọn mật khẩu mới. Link hết hạn sau ${RESET_TTL_MINUTES} phút.\n\n${link}\n\nNếu bạn không yêu cầu, bỏ qua email này là được.`,
  });
}

export async function resetPassword(input: unknown): Promise<void> {
  const data = resetPasswordSchema.parse(input);

  const record = await db.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(data.token) },
    include: { user: true },
  });
  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now() || record.user.deletedAt) {
    throw badRequest("Link đặt lại mật khẩu không còn dùng được. Hãy xin link mới.");
  }

  await db.$transaction([
    db.user.update({
      where: { id: record.userId },
      data: { passwordHash: await hashPassword(data.password) },
    }),
    db.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    db.session.deleteMany({ where: { userId: record.userId } }),
  ]);
}

// ---------------------------------------------------------------------------
// Closing an account (FR-14)
// ---------------------------------------------------------------------------

/**
 * What happens depends on whether anybody is left behind:
 *
 *  - alone in the space  → the space and everything in it goes with you.
 *  - a partner remains   → your login is closed and your personal details are
 *                          scrubbed, but the moments you wrote stay where they
 *                          are. They are their memories too.
 */
export async function deleteAccount(user: SessionUser, confirmEmail: string) {
  if (confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
    throw badRequest("Gõ đúng địa chỉ email của bạn để xác nhận.");
  }

  const membership = await db.coupleMember.findFirst({
    where: { userId: user.id },
    include: { space: { select: { id: true, name: true, _count: { select: { members: true } } } } },
  });

  const orphanedKeys: string[] = [];

  if (membership && membership.space._count.members <= 1) {
    const media = await db.mediaAsset.findMany({
      where: { spaceId: membership.spaceId },
      select: { objectKey: true, thumbKey: true },
    });
    orphanedKeys.push(
      ...media.flatMap((m) => [m.objectKey, m.thumbKey].filter((k): k is string => Boolean(k))),
    );

    await db.auditEvent.create({
      data: {
        actorUserId: null,
        action: "account.deleted_with_space",
        targetType: "space",
        targetId: membership.spaceId,
        metadata: { spaceName: membership.space.name },
      },
    });
    await db.coupleSpace.delete({ where: { id: membership.spaceId } });
  } else if (membership) {
    await db.auditEvent.create({
      data: {
        spaceId: membership.spaceId,
        actorUserId: null,
        action: "account.deleted_partner_remains",
        targetType: "user",
        targetId: user.id,
      },
    });
    await db.coupleMember.deleteMany({ where: { userId: user.id } });
    await db.coupleMember.updateMany({
      where: { spaceId: membership.spaceId },
      data: { role: "OWNER" },
    });
  }

  const stillReferenced = await db.moment.count({ where: { createdById: user.id } });
  const alsoReferenced =
    stillReferenced ||
    (await db.preference.count({ where: { OR: [{ personUserId: user.id }, { createdById: user.id }] } })) ||
    (await db.bucketListItem.count({ where: { createdById: user.id } })) ||
    (await db.mediaAsset.count({ where: { uploadedById: user.id } }));

  if (alsoReferenced) {
    // Scrub rather than delete, so the remaining partner keeps intact history.
    await db.user.update({
      where: { id: user.id },
      data: {
        email: `deleted+${user.id}@account.invalid`,
        displayName: "Deleted account",
        passwordHash: await hashPassword(generateToken(32)),
        avatarMediaId: null,
        deletedAt: new Date(),
      },
    });
    await db.session.deleteMany({ where: { userId: user.id } });
  } else {
    await db.user.delete({ where: { id: user.id } });
  }

  for (const key of orphanedKeys) {
    await storage.delete(key);
  }
}

export async function getUserOrThrow(id: string) {
  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, email: true, displayName: true, avatarMediaId: true, deletedAt: true },
  });
  if (!user || user.deletedAt) throw notFound("Tài khoản này không tồn tại.");
  return user;
}
