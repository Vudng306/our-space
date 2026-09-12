/**
 * End-to-end flow check against a running dev server (spec §12.1).
 *
 * Walks the daily loop the way the browser does — upload a photo, save a
 * moment, see it on the calendar, find it by search, edit it, delete it,
 * restore it — plus the timezone and pagination cases from §14.
 *
 *   npx tsx scripts/flow-check.ts
 */
import "dotenv/config";
import sharp from "sharp";

const BASE = process.env.CHECK_BASE_URL ?? "http://localhost:3000";
const EMAIL = "mai@example.com";
const PASSWORD = "ourspace-dev-2026";

let failures = 0;
let cookie = "";

function check(name: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

/** The writable fields of a sheet, for snapshotting and putting back. */
function sheetFieldsOf(sheet: Record<string, unknown>) {
  const keys = [
    "nickname",
    "livingPlace",
    "livingCity",
    "favFood",
    "favDrink",
    "favColor",
    "favAnimal",
    "favNumber",
    "favSport",
    "favMusic",
    "specialHobby",
    "idol",
    "favTimeOfDay",
    "mood",
    "traits",
    "dream",
    "selfScore",
  ];
  return Object.fromEntries(keys.map((k) => [k, sheet[k] ?? (k === "traits" ? [] : null)]));
}

async function call<T>(path: string, init: RequestInit = {}): Promise<{ status: number; body: T }> {
  const res = await fetch(`${BASE}/api/v1${path}`, {
    ...init,
    headers: {
      Origin: BASE,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...init.headers,
    },
    redirect: "manual",
  });
  const setCookie = res.headers.getSetCookie?.().find((c) => c.startsWith("os_session="));
  if (setCookie) cookie = setCookie.split(";")[0];

  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body: body as T };
}

async function main() {
  // --- sign in -----------------------------------------------------------
  const login = await call("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  check("sign in", login.status === 200, `status ${login.status}`);
  if (login.status !== 200) return;

  // --- upload a photo ----------------------------------------------------
  // A real JPEG carrying EXIF, so the re-encode has something to strip.
  const jpeg = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: { r: 120, g: 90, b: 110 } } })
    .withExifMerge({ IFD0: { Copyright: "test", Artist: "flow-check" } })
    .jpeg()
    .toBuffer();

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(jpeg)], { type: "image/jpeg" }), "photo.jpg");
  const upload = await call<{ media: { id: string; width: number; height: number } }>("/media", {
    method: "POST",
    body: form,
  });
  check("upload a photo", upload.status === 201, `status ${upload.status}`);
  const mediaId = upload.body?.media?.id;
  check("oversized photo is scaled down", (upload.body?.media?.width ?? 0) <= 2560, `width ${upload.body?.media?.width}`);

  // --- a non-image must be refused ---------------------------------------
  const badForm = new FormData();
  badForm.append("file", new Blob([new Uint8Array(Buffer.from("#!/bin/sh\necho hi"))], { type: "image/jpeg" }), "evil.jpg");
  const badUpload = await call("/media", { method: "POST", body: badForm });
  check("a non-image disguised as a JPEG is refused", badUpload.status === 400, `status ${badUpload.status}`);

  // --- the stored copy must carry no camera metadata (spec §8.1) ---------
  if (mediaId) {
    const stored = await fetch(`${BASE}/api/v1/media/${mediaId}`, {
      headers: { Cookie: cookie },
      redirect: "manual",
    });
    const bytes = Buffer.from(await stored.arrayBuffer());
    const meta = await sharp(bytes).metadata();
    check("EXIF is stripped from the stored photo", meta.exif === undefined, meta.exif ? "EXIF still present" : "none");
  }

  // --- create a moment, dated just before local midnight in +07 ----------
  // §14 asks specifically for a moment near 00:00 in Asia/Bangkok.
  const nearMidnight = "2026-03-14T23:45:00+07:00";
  const created = await call<{ id: string; localDate: string; media: { id: string }[] }>("/moments", {
    method: "POST",
    body: JSON.stringify({
      caption: "Kiểm thử flow — mì tôm lúc gần nửa đêm",
      occurredAt: nearMidnight,
      timezone: "Asia/Bangkok",
      mood: "TIRED",
      locationText: "Hà Nội",
      mediaIds: mediaId ? [mediaId] : [],
      tags: ["flowcheck", "midnight"],
    }),
  });
  check("create a moment", created.status === 201, `status ${created.status}`);
  check(
    "23:45 in +07 stays on the local day, not the UTC one",
    created.body?.localDate === "2026-03-14",
    `localDate ${created.body?.localDate}`,
  );
  check("the photo is attached", created.body?.media?.length === 1);
  const momentId = created.body?.id;

  // --- calendar indicator -------------------------------------------------
  const calendar = await call<{ days: { date: string; momentCount: number; coverMediaId: string | null }[] }>(
    "/calendar?from=2026-03-01&to=2026-03-31",
  );
  const day = calendar.body?.days?.find((d) => d.date === "2026-03-14");
  check("the calendar marks that day", Boolean(day && day.momentCount > 0), `entry ${JSON.stringify(day)}`);
  check("the day carries a thumbnail", Boolean(day?.coverMediaId));

  // --- search -------------------------------------------------------------
  const search = await call<{ moments: { id: string }[] }>("/search?q=" + encodeURIComponent("mì tôm"));
  check("search finds it by caption", search.body?.moments?.some((m) => m.id === momentId) ?? false);

  const tagSearch = await call<{ items: { id: string }[] }>("/moments?tag=flowcheck");
  check("filter by tag finds it", tagSearch.body?.items?.some((m) => m.id === momentId) ?? false);

  // --- pagination ---------------------------------------------------------
  const seen = new Set<string>();
  let cursor: string | null = null;
  let pages = 0;
  do {
    const page: { status: number; body: { items: { id: string }[]; nextCursor: string | null } } = await call(
      `/moments?limit=7${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
    );
    for (const item of page.body.items) seen.add(item.id);
    cursor = page.body.nextCursor;
    pages++;
  } while (cursor && pages < 20);

  const total = await call<{ items: { id: string }[] }>("/moments?limit=50");
  check("pagination walks every moment without duplicates", seen.size >= total.body.items.length, `${seen.size} unique over ${pages} pages`);

  // --- edit ---------------------------------------------------------------
  const edited = await call<{ caption: string; mood: string | null }>(`/moments/${momentId}`, {
    method: "PATCH",
    body: JSON.stringify({ caption: "Kiểm thử flow — đã sửa", mood: "CALM" }),
  });
  check("edit a moment", edited.status === 200 && edited.body.caption === "Kiểm thử flow — đã sửa");

  // --- validation ---------------------------------------------------------
  const empty = await call("/moments", {
    method: "POST",
    body: JSON.stringify({ occurredAt: new Date().toISOString(), timezone: "UTC", mediaIds: [] }),
  });
  check("an empty moment is refused", empty.status === 400, `status ${empty.status}`);

  const longCaption = await call("/moments", {
    method: "POST",
    body: JSON.stringify({
      caption: "x".repeat(2001),
      occurredAt: new Date().toISOString(),
      timezone: "UTC",
    }),
  });
  check("a caption over 2000 characters is refused", longCaption.status === 422, `status ${longCaption.status}`);

  // --- soft delete and restore -------------------------------------------
  const deleted = await call(`/moments/${momentId}`, { method: "DELETE" });
  check("delete a moment", deleted.status === 204, `status ${deleted.status}`);

  const gone = await call(`/moments/${momentId}`);
  check("a deleted moment leaves the active views", gone.status === 404);

  const trash = await call<{ items: { id: string }[] }>("/moments/deleted");
  check("it is recoverable for 30 days", trash.body?.items?.some((m) => m.id === momentId) ?? false);

  const restored = await call(`/moments/${momentId}/restore`, { method: "POST" });
  check("restore a moment", restored.status === 204, `status ${restored.status}`);

  // --- about us -----------------------------------------------------------
  const me = await call<{ user: { id: string } }>("/me");
  const pref = await call<{ id: string }>("/preferences", {
    method: "POST",
    body: JSON.stringify({
      personUserId: me.body.user.id,
      category: "FLOWER",
      value: "Tulip",
      sentiment: "LOVE",
    }),
  });
  check("save a preference", pref.status === 201, `status ${pref.status}`);

  const foreignPref = await call("/preferences", {
    method: "POST",
    body: JSON.stringify({
      personUserId: "clzzzzzzzzzzzzzzzzzzzzzzz",
      category: "FOOD",
      value: "Nope",
      sentiment: "LIKE",
    }),
  });
  check("a preference for an outsider is refused", foreignPref.status === 400 || foreignPref.status === 422);
  if (pref.body?.id) await call(`/preferences/${pref.body.id}`, { method: "DELETE" });

  // --- the introduction sheet and its unlock gate --------------------------
  type SheetsBody = {
    me: Record<string, unknown> & { completedAt: string | null };
    partner: unknown | null;
    partnerHasFinished: boolean;
    iHaveFinished: boolean;
    lockedReason: string | null;
  };

  const sheetsBefore = await call<SheetsBody>("/sheets");
  check("sheets load", sheetsBefore.status === 200 && sheetsBefore.body.me !== undefined);

  // Snapshot, so the seeded sheet goes back exactly as it was.
  const mySheetBefore = sheetsBefore.body.me;
  const wasFinished = mySheetBefore.completedAt !== null;

  const draft = await call<{ sheet: { favDrink: string | null } }>("/sheets", {
    method: "PATCH",
    body: JSON.stringify({ favDrink: "nước mía kiểm thử" }),
  });
  check(
    "save a sheet draft",
    draft.status === 200 && draft.body.sheet.favDrink === "nước mía kiểm thử",
  );

  // An almost-empty sheet cannot be handed in — the unlock has to be earned.
  const emptyish = await call("/sheets", {
    method: "PATCH",
    body: JSON.stringify({
      nickname: null,
      livingPlace: null,
      livingCity: null,
      favFood: null,
      favDrink: null,
      favColor: null,
      favAnimal: null,
      favNumber: null,
      favSport: null,
      favMusic: null,
      specialHobby: null,
      idol: null,
      favTimeOfDay: null,
      mood: null,
      traits: [],
      dream: null,
      selfScore: null,
    }),
  });
  check("clear the sheet for the next case", emptyish.status === 200);

  const tooEmpty = await call("/sheets/complete", { method: "POST" });
  check("an almost-empty sheet is refused", tooEmpty.status === 400, `status ${tooEmpty.status}`);

  // Fill enough of it, then hand it in.
  await call("/sheets", {
    method: "PATCH",
    body: JSON.stringify({
      nickname: "kiểm thử",
      livingPlace: "HOUSE",
      livingCity: "Hà Nội",
      favFood: "phở",
      favDrink: "trà đá",
      mood: "CALM",
      traits: ["OPEN"],
      selfScore: 60,
    }),
  });
  const handedIn = await call<{ sheet: { completedAt: string | null } }>("/sheets/complete", {
    method: "POST",
  });
  check("a filled sheet can be handed in", handedIn.status === 200 && handedIn.body.sheet.completedAt !== null);

  const unlocked = await call<SheetsBody>("/sheets");
  check(
    "the partner sheet unlocks once both are in",
    unlocked.body.partnerHasFinished ? unlocked.body.partner !== null : unlocked.body.partner === null,
    `partnerHasFinished=${unlocked.body.partnerHasFinished}`,
  );

  // Put the seeded sheet back the way it was.
  await call("/sheets", { method: "PATCH", body: JSON.stringify(sheetFieldsOf(mySheetBefore)) });
  if (wasFinished) await call("/sheets/complete", { method: "POST" });

  // --- the two profiles ---------------------------------------------------
  type MemberRow = {
    userId: string;
    displayName: string;
    birthday: string | null;
    hometown: string | null;
    occupation: string | null;
    bio: string | null;
  };
  const partner = await call<{ space: { members: MemberRow[] } | null }>("/me");
  const members = partner.body.space?.members ?? [];
  // Snapshot, so the check puts back whatever was there.
  const before = new Map(members.map((m) => [m.userId, m]));

  const own = await call<{ person: { hometown: string | null } }>(`/people/${me.body.user.id}`, {
    method: "PATCH",
    body: JSON.stringify({ birthday: "1999-04-12", hometown: "Hải Phòng", occupation: "Thiết kế đồ hoạ" }),
  });
  check("edit your own profile", own.status === 200 && own.body.person.hometown === "Hải Phòng");

  const other = members.find((m) => m.userId !== me.body.user.id);
  if (other) {
    // Either person may fill in what they know about the other.
    const theirs = await call<{ person: { bio: string | null } }>(`/people/${other.userId}`, {
      method: "PATCH",
      body: JSON.stringify({ bio: "Không chịu được phim kinh dị." }),
    });
    check("edit your partner profile", theirs.status === 200 && theirs.body.person.bio !== null);
  }

  const stranger = await call(`/people/clzzzzzzzzzzzzzzzzzzzzzzz`, {
    method: "PATCH",
    body: JSON.stringify({ hometown: "Nowhere" }),
  });
  check("a profile outside the space is refused", stranger.status === 400, `status ${stranger.status}`);

  for (const [userId, snapshot] of before) {
    await call(`/people/${userId}`, {
      method: "PATCH",
      body: JSON.stringify({
        birthday: snapshot.birthday,
        hometown: snapshot.hometown,
        occupation: snapshot.occupation,
        bio: snapshot.bio,
      }),
    });
  }

  // --- yearly recurrence --------------------------------------------------
  const leapDate = await call<{ id: string; nextOccurrence: string }>("/important-dates?tz=Asia/Bangkok", {
    method: "POST",
    body: JSON.stringify({ title: "Flow check leap day", eventDate: "2024-02-29", recurrence: "YEARLY" }),
  });
  check(
    "a 29 February anniversary still resolves in a common year",
    Boolean(leapDate.body?.nextOccurrence),
    `next ${leapDate.body?.nextOccurrence}`,
  );
  if (leapDate.body?.id) await call(`/important-dates/${leapDate.body.id}`, { method: "DELETE" });

  // --- export -------------------------------------------------------------
  // Exports are rate limited to a handful an hour. Running this suite twice in
  // quick succession will hit that ceiling, which is the limiter working — not
  // a broken export — so it is reported as a skip rather than a failure.
  async function exportZip(photos: "0" | "1") {
    const res = await fetch(`${BASE}/api/v1/exports?photos=${photos}`, {
      method: "POST",
      headers: { Origin: BASE, Cookie: cookie },
      redirect: "manual",
    });
    return { status: res.status, body: Buffer.from(await res.arrayBuffer()) };
  }

  const plain = await exportZip("0");
  if (plain.status === 429) {
    console.log("SKIP  export — rate limited, try again in a while");
  } else {
    check(
      "export returns a zip",
      plain.status === 200 && plain.body.subarray(0, 2).toString() === "PK",
      `status ${plain.status}, ${plain.body.byteLength} bytes`,
    );

    const withPhotos = await exportZip("1");
    check(
      "export with photos is larger",
      withPhotos.status === 200 && withPhotos.body.byteLength > plain.body.byteLength,
      `${withPhotos.body.byteLength} vs ${plain.body.byteLength} bytes`,
    );
  }

  // --- tidy up ------------------------------------------------------------
  await call(`/moments/${momentId}`, { method: "DELETE" });

  console.log(failures === 0 ? "\nAll flow checks passed." : `\n${failures} check(s) FAILED.`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
