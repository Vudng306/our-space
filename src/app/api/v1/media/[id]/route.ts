import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { forbidden, handler, noContent, notFound } from "@/lib/api";
import { db } from "@/lib/db";
import { purgeMediaAssets } from "@/lib/media";
import { assertSameOrigin, requireUser } from "@/lib/session";
import { getSpaceContextForUser } from "@/lib/space";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Authenticated media proxy.
 *
 * Nothing in the bucket is ever publicly readable. A request has to come from
 * somebody who is in the same space as the photo — or, for avatars taken
 * before a space existed, from the person themselves or their partner.
 */
async function authorise(mediaId: string) {
  const user = await requireUser();
  const asset = await db.mediaAsset.findFirst({
    where: { id: mediaId, deletedAt: null },
  });
  if (!asset) throw notFound("Ảnh này không tồn tại.");

  const ctx = await getSpaceContextForUser(user);

  if (asset.spaceId) {
    if (!ctx || ctx.spaceId !== asset.spaceId) throw forbidden("Ảnh này không thuộc về bạn.");
    return { user, asset, ctx };
  }

  // Space-less asset: the uploader, or the partner it is an avatar for.
  if (asset.uploadedById === user.id) return { user, asset, ctx };

  const isPartnerAvatar =
    ctx?.members.some((m) => m.avatarMediaId === asset.id && m.userId === asset.uploadedById) ?? false;
  if (!isPartnerAvatar) throw forbidden("Ảnh này không thuộc về bạn.");

  return { user, asset, ctx };
}

export const GET = handler(async (req: Request, p: Ctx) => {
  const { id } = await p.params;
  const { asset } = await authorise(id);

  const wantsThumb = new URL(req.url).searchParams.get("variant") === "thumb";
  const key = wantsThumb && asset.thumbKey ? asset.thumbKey : asset.objectKey;

  // With an S3-compatible bucket, hand the browser a short-lived signed URL so
  // the bytes do not round-trip through the server (spec §8.1).
  if (storage.signedUrl) {
    const url = await storage.signedUrl(key, 300);
    return NextResponse.redirect(url, {
      status: 302,
      headers: { "Cache-Control": "private, max-age=240" },
    });
  }

  const object = await storage.get(key);
  if (!object) throw notFound("Ảnh này không còn được lưu.");

  return new NextResponse(Readable.toWeb(object.body) as ReadableStream, {
    headers: {
      "Content-Type": object.contentType,
      "Content-Length": String(object.size),
      // Ids are immutable, so the browser can keep these for a long time.
      "Cache-Control": "private, max-age=31536000, immutable",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
});

export const DELETE = handler(async (req: Request, p: Ctx) => {
  assertSameOrigin(req);
  const { id } = await p.params;
  const { user, asset } = await authorise(id);

  if (asset.spaceId === null && asset.uploadedById !== user.id) {
    throw forbidden("Bạn chỉ xoá được ảnh do mình tải lên.");
  }

  await purgeMediaAssets([asset.id]);
  return noContent();
});
