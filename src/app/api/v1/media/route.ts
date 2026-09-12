import { badRequest, handler, json, tooLarge } from "@/lib/api";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { storeImage } from "@/lib/media";
import { limit } from "@/lib/ratelimit";
import { assertSameOrigin, requireUser } from "@/lib/session";
import { getSpaceContextForUser } from "@/lib/space";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Direct upload, one file per request.
 *
 * The spec sketches a presigned-upload endpoint; this takes the bytes instead
 * so the server can re-encode every image (dropping EXIF/GPS and validating
 * that the file really is an image) before anything reaches the bucket. That
 * check is only possible on the server side of the upload.
 */
export const POST = handler(async (req) => {
  assertSameOrigin(req);
  const user = await requireUser();
  limit(req, "upload", user.id);

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    throw badRequest("Ảnh phải gửi dạng multipart/form-data.");
  }

  const declaredLength = Number(req.headers.get("content-length") ?? 0);
  if (declaredLength && declaredLength > env.maxUploadBytes * 1.1) {
    throw tooLarge(`Ảnh phải nhỏ hơn ${env.MAX_UPLOAD_MB} MB.`);
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw badRequest("Chưa đính kèm file nào.");

  const ctx = await getSpaceContextForUser(user);
  // Before a space exists a person can still upload their own avatar.
  const spaceId = ctx?.spaceId ?? null;

  const buffer = Buffer.from(await file.arrayBuffer());
  const media = await storeImage({
    buffer,
    declaredMime: file.type,
    spaceId,
    userId: user.id,
  });

  return json({ media }, 201);
});

export const GET = handler(async () => {
  const user = await requireUser();
  const ctx = await getSpaceContextForUser(user);
  if (!ctx) return json({ items: [] });

  const items = await db.mediaAsset.findMany({
    where: { spaceId: ctx.spaceId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, width: true, height: true, mimeType: true, createdAt: true },
  });
  return json({ items });
});
