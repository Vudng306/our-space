import { handler } from "@/lib/api";
import { limit } from "@/lib/ratelimit";
import { assertSameOrigin } from "@/lib/session";
import { requireSpace } from "@/lib/space";
import { buildExportZip } from "@/server/exportData";

export const runtime = "nodejs";
// Zipping photos can take a while on a large archive.
export const maxDuration = 300;

export const POST = handler(async (req) => {
  assertSameOrigin(req);
  const ctx = await requireSpace();
  limit(req, "export", ctx.user.id);

  const includePhotos = new URL(req.url).searchParams.get("photos") !== "0";
  const zip = await buildExportZip(ctx, includePhotos);

  const stamp = new Date().toISOString().slice(0, 10);
  const safeName = ctx.space.name.replace(/[^a-zA-Z0-9-_]+/g, "-").slice(0, 40) || "our-space";

  return new Response(zip as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${safeName}-${stamp}.zip"`,
      "Cache-Control": "no-store",
    },
  });
});
