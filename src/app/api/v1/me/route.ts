import { handler, json, noContent, readJson } from "@/lib/api";
import { assertSameOrigin, destroyCurrentSession, requireUser } from "@/lib/session";
import { getSpaceContextForUser } from "@/lib/space";
import { deleteAccount, updateProfile } from "@/server/accounts";
import { z } from "zod";

export const runtime = "nodejs";

export const GET = handler(async () => {
  const user = await requireUser();
  const ctx = await getSpaceContextForUser(user);
  return json({
    user,
    space: ctx
      ? {
          id: ctx.spaceId,
          name: ctx.space.name,
          role: ctx.role,
          members: ctx.members,
          partner: ctx.partner,
        }
      : null,
  });
});

export const PATCH = handler(async (req) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const updated = await updateProfile(user, await readJson(req));
  return json({ user: updated });
});

const deleteSchema = z.object({ confirmEmail: z.string().min(1) });

export const DELETE = handler(async (req) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const { confirmEmail } = deleteSchema.parse(await readJson(req));
  await deleteAccount(user, confirmEmail);
  await destroyCurrentSession();
  return noContent();
});
