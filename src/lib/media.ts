import sharp from "sharp";
import type { Metadata, Sharp } from "sharp";
import { db } from "./db";
import { env } from "./env";
import { badRequest, tooLarge } from "./api";
import { mediaKey, storage } from "./storage";

const MAX_EDGE = 2560;
const THUMB_EDGE = 640;

const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif", "image/tiff"]);

export type StoredMedia = {
  id: string;
  width: number;
  height: number;
  mimeType: string;
  byteSize: number;
};

/**
 * Takes raw bytes from the browser and produces a stored, sanitised image.
 *
 * The upload is always re-encoded rather than passed through: that validates
 * the file really is an image, drops EXIF (including GPS), and caps the
 * dimensions so one enormous photo cannot fill the bucket (spec §8.1).
 */
export async function storeImage(opts: {
  buffer: Buffer;
  declaredMime: string;
  spaceId: string | null;
  userId: string;
}): Promise<StoredMedia> {
  const { buffer, declaredMime, spaceId, userId } = opts;

  if (buffer.byteLength === 0) throw badRequest("File rỗng.");
  if (buffer.byteLength > env.maxUploadBytes) {
    throw tooLarge(`Ảnh phải nhỏ hơn ${env.MAX_UPLOAD_MB} MB.`);
  }
  if (declaredMime && !ACCEPTED.has(declaredMime)) {
    throw badRequest("Định dạng này không hỗ trợ. Dùng JPEG, PNG, WebP hoặc AVIF.");
  }

  let pipeline: Sharp;
  let metadata: Metadata;
  try {
    pipeline = sharp(buffer, { failOn: "error" });
    metadata = await pipeline.metadata();
  } catch {
    throw badRequest("Không đọc được file này như một tấm ảnh.");
  }

  if (!metadata.width || !metadata.height) throw badRequest("Không đọc được kích thước ảnh.");
  // The format sharp actually detected is what counts, not the declared type.
  if (!metadata.format || !ACCEPTED.has(`image/${metadata.format}`)) {
    throw badRequest("Định dạng này không hỗ trợ. Dùng JPEG, PNG, WebP hoặc AVIF.");
  }

  // Transparency would be lost by a JPEG re-encode, so those become WebP.
  const keepAlpha = Boolean(metadata.hasAlpha);
  const outputMime = keepAlpha ? "image/webp" : "image/jpeg";
  const outputExt = keepAlpha ? "webp" : "jpg";

  const base = sharp(buffer, { failOn: "error" })
    .rotate() // bake in EXIF orientation before the metadata is dropped
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true });

  const originalBuffer = keepAlpha
    ? await base.clone().webp({ quality: 86 }).toBuffer()
    : await base.clone().jpeg({ quality: 86, mozjpeg: true }).toBuffer();

  const originalMeta = await sharp(originalBuffer).metadata();

  const thumbBuffer = await sharp(buffer, { failOn: "error" })
    .rotate()
    .resize({ width: THUMB_EDGE, height: THUMB_EDGE, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 72 })
    .toBuffer();

  // The row is created first so the object keys can embed a real id, and so a
  // failed upload leaves a row we can clean up rather than an orphan object.
  const asset = await db.mediaAsset.create({
    data: {
      spaceId,
      uploadedById: userId,
      objectKey: `pending-${crypto.randomUUID()}`,
      mimeType: outputMime,
      width: originalMeta.width ?? metadata.width,
      height: originalMeta.height ?? metadata.height,
      byteSize: originalBuffer.byteLength,
    },
  });

  const objectKey = mediaKey(spaceId, asset.id, "original", outputExt);
  const thumbKey = mediaKey(spaceId, asset.id, "thumb", "webp");

  try {
    await storage.put(objectKey, originalBuffer, outputMime);
    await storage.put(thumbKey, thumbBuffer, "image/webp");
  } catch (err) {
    await db.mediaAsset.delete({ where: { id: asset.id } }).catch(() => {});
    throw err;
  }

  const saved = await db.mediaAsset.update({
    where: { id: asset.id },
    data: { objectKey, thumbKey },
  });

  return {
    id: saved.id,
    width: saved.width,
    height: saved.height,
    mimeType: saved.mimeType,
    byteSize: saved.byteSize,
  };
}

/**
 * Marks assets deleted and removes their objects. Called when a moment is
 * hard-deleted or its photos are detached, never on a soft delete — a moment
 * in the 30-day grace window keeps its photos (spec §6.4).
 */
export async function purgeMediaAssets(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const assets = await db.mediaAsset.findMany({ where: { id: { in: ids } } });
  for (const asset of assets) {
    await storage.delete(asset.objectKey);
    if (asset.thumbKey) await storage.delete(asset.thumbKey);
  }
  await db.mediaAsset.deleteMany({ where: { id: { in: ids } } });
}

/** Media not referenced by any moment, memory cover or avatar. */
export async function collectOrphanMedia(spaceId: string, olderThanHours = 24): Promise<string[]> {
  const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
  const orphans = await db.mediaAsset.findMany({
    where: {
      spaceId,
      createdAt: { lt: cutoff },
      momentLinks: { none: {} },
      memoryCovers: { none: {} },
      avatarOf: { none: {} },
    },
    select: { id: true },
  });
  return orphans.map((o) => o.id);
}
