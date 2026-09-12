import JSZip from "jszip";
import { db } from "@/lib/db";
import { dateKey } from "@/lib/datetime";
import { storage } from "@/lib/storage";
import type { SpaceContext } from "@/lib/space";

/**
 * Everything in the space, as plain JSON (FR-13).
 *
 * The shape is deliberately readable rather than a database dump: the point is
 * that these memories can be opened in ten years without this app existing.
 */
export async function buildExportPayload(ctx: SpaceContext) {
  const [space, moments, memories, preferences, importantDates, bucketItems, media] = await Promise.all([
    db.coupleSpace.findUniqueOrThrow({
      where: { id: ctx.spaceId },
      select: { id: true, name: true, startDate: true, createdAt: true },
    }),
    db.moment.findMany({
      where: { spaceId: ctx.spaceId, deletedAt: null },
      orderBy: { occurredAt: "asc" },
      include: {
        createdBy: { select: { id: true, displayName: true } },
        media: { orderBy: { sortOrder: "asc" }, include: { media: true } },
        tags: { include: { tag: true } },
      },
    }),
    db.memory.findMany({
      where: { spaceId: ctx.spaceId, deletedAt: null },
      orderBy: { startDate: "asc" },
      include: { moments: { select: { momentId: true } } },
    }),
    db.preference.findMany({ where: { spaceId: ctx.spaceId }, orderBy: { createdAt: "asc" } }),
    db.importantDate.findMany({ where: { spaceId: ctx.spaceId }, orderBy: { eventDate: "asc" } }),
    db.bucketListItem.findMany({ where: { spaceId: ctx.spaceId }, orderBy: { createdAt: "asc" } }),
    db.mediaAsset.findMany({ where: { spaceId: ctx.spaceId, deletedAt: null } }),
  ]);

  const fileNameFor = (mediaId: string, mimeType: string) =>
    `photos/${mediaId}.${mimeType === "image/webp" ? "webp" : "jpg"}`;

  return {
    payload: {
      exportedAt: new Date().toISOString(),
      formatVersion: 1,
      space: {
        id: space.id,
        name: space.name,
        startDate: space.startDate ? dateKey(space.startDate) : null,
        createdAt: space.createdAt.toISOString(),
      },
      people: ctx.members.map((m) => ({
        id: m.userId,
        displayName: m.displayName,
        role: m.role,
        joinedAt: m.joinedAt.toISOString(),
      })),
      moments: moments.map((m) => ({
        id: m.id,
        caption: m.caption,
        occurredAt: m.occurredAt.toISOString(),
        timezone: m.timezone,
        localDate: dateKey(m.localDate),
        mood: m.mood,
        location: m.locationText,
        author: { id: m.createdBy.id, displayName: m.createdBy.displayName },
        tags: m.tags.map((t) => t.tag.name),
        photos: m.media.map((mm) => ({
          id: mm.media.id,
          file: fileNameFor(mm.media.id, mm.media.mimeType),
          width: mm.media.width,
          height: mm.media.height,
        })),
        createdAt: m.createdAt.toISOString(),
      })),
      memories: memories.map((m) => ({
        id: m.id,
        title: m.title,
        description: m.description,
        startDate: dateKey(m.startDate),
        endDate: m.endDate ? dateKey(m.endDate) : null,
        coverPhotoId: m.coverMediaId,
        momentIds: m.moments.map((x) => x.momentId),
      })),
      preferences: preferences.map((p) => ({
        id: p.id,
        personId: p.personUserId,
        category: p.category,
        value: p.value,
        sentiment: p.sentiment,
        note: p.note,
      })),
      importantDates: importantDates.map((d) => ({
        id: d.id,
        title: d.title,
        date: dateKey(d.eventDate),
        recurrence: d.recurrence,
        note: d.note,
      })),
      bucketList: bucketItems.map((b) => ({
        id: b.id,
        title: b.title,
        note: b.note,
        status: b.status,
        targetDate: b.targetDate ? dateKey(b.targetDate) : null,
        completedAt: b.completedAt?.toISOString() ?? null,
      })),
    },
    media,
    fileNameFor,
  };
}

export async function buildExportZip(ctx: SpaceContext, includePhotos: boolean): Promise<Uint8Array> {
  const { payload, media, fileNameFor } = await buildExportPayload(ctx);

  const zip = new JSZip();
  zip.file("data.json", JSON.stringify(payload, null, 2));
  zip.file(
    "README.txt",
    [
      `Our Space export — ${payload.space.name}`,
      `Exported ${payload.exportedAt}`,
      "",
      "data.json  — every moment, memory, preference, date and bucket-list item.",
      includePhotos
        ? "photos/    — the full-size photo for each entry, named by its id."
        : "photos/    — not included in this export. Re-export with photos to get the files.",
      "",
      "Each moment lists the photo files that belong to it, so the two can be",
      "matched back up without this app.",
    ].join("\n"),
  );

  if (includePhotos) {
    for (const asset of media) {
      const object = await storage.get(asset.objectKey);
      if (!object) continue;
      const chunks: Buffer[] = [];
      for await (const chunk of object.body) chunks.push(Buffer.from(chunk));
      zip.file(fileNameFor(asset.id, asset.mimeType), Buffer.concat(chunks));
    }
  }

  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } });
}
