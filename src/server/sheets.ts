import { db } from "@/lib/db";
import { badRequest, notFound } from "@/lib/api";
import { dateFromKey, dateKey } from "@/lib/datetime";
import { FAVOURITE_FIELDS, NOTE_FIELDS } from "@/lib/sheet";
import type { SpaceContext } from "@/lib/space";
import { updateSheetSchema } from "@/lib/validation";
import type { LivingPlace, SheetMood, SheetTrait } from "../../generated/prisma/enums";

/** How many boxes have to be filled in before a sheet can be handed over. */
const MIN_FILLED_TO_COMPLETE = 6;

export type SheetDTO = {
  personUserId: string;
  displayName: string;
  avatarMediaId: string | null;
  birthday: string | null;

  nickname: string | null;
  livingPlace: LivingPlace | null;
  livingCity: string | null;

  favFood: string | null;
  favDrink: string | null;
  favColor: string | null;
  favAnimal: string | null;
  favNumber: string | null;
  favSport: string | null;
  favMusic: string | null;

  specialHobby: string | null;
  idol: string | null;
  favTimeOfDay: string | null;

  mood: SheetMood | null;
  traits: SheetTrait[];
  dream: string | null;
  selfScore: number | null;

  completedAt: string | null;
};

export type SheetsView = {
  me: SheetDTO;
  /** Null while it is still hidden — see {@link getSheets}. */
  partner: SheetDTO | null;
  partnerName: string | null;
  partnerHasFinished: boolean;
  iHaveFinished: boolean;
  /** Why the partner sheet is not here yet, if it is not. */
  lockedReason: "mine_unfinished" | "theirs_unfinished" | "no_partner" | null;
};

type SheetRow = NonNullable<Awaited<ReturnType<typeof findSheet>>>;

function findSheet(spaceId: string, personUserId: string) {
  return db.profileSheet.findFirst({
    where: { spaceId, personUserId },
    include: {
      person: { select: { id: true, displayName: true, avatarMediaId: true, birthday: true } },
    },
  });
}

function toDTO(row: SheetRow): SheetDTO {
  return {
    personUserId: row.personUserId,
    displayName: row.person.displayName,
    avatarMediaId: row.person.avatarMediaId,
    birthday: row.person.birthday ? dateKey(row.person.birthday) : null,

    nickname: row.nickname,
    livingPlace: row.livingPlace,
    livingCity: row.livingCity,

    favFood: row.favFood,
    favDrink: row.favDrink,
    favColor: row.favColor,
    favAnimal: row.favAnimal,
    favNumber: row.favNumber,
    favSport: row.favSport,
    favMusic: row.favMusic,

    specialHobby: row.specialHobby,
    idol: row.idol,
    favTimeOfDay: row.favTimeOfDay,

    mood: row.mood,
    traits: row.traits,
    dream: row.dream,
    selfScore: row.selfScore,

    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

/** Creates the blank sheet the first time somebody opens the form. */
async function ensureSheet(ctx: SpaceContext, personUserId: string) {
  const existing = await findSheet(ctx.spaceId, personUserId);
  if (existing) return existing;

  await db.profileSheet.create({ data: { spaceId: ctx.spaceId, personUserId } });
  const created = await findSheet(ctx.spaceId, personUserId);
  if (!created) throw notFound("Không tạo được phiếu.");
  return created;
}

/**
 * Both sheets, with the reciprocity gate applied on the server.
 *
 * Your partner's answers are withheld until you have handed in your own — that
 * exchange is the whole point of the sheet, and it has to be enforced here
 * rather than hidden in the UI, or anyone could just read it off the API.
 */
export async function getSheets(ctx: SpaceContext): Promise<SheetsView> {
  const mine = await ensureSheet(ctx, ctx.user.id);
  const iHaveFinished = mine.completedAt !== null;

  if (!ctx.partner) {
    return {
      me: toDTO(mine),
      partner: null,
      partnerName: null,
      partnerHasFinished: false,
      iHaveFinished,
      lockedReason: "no_partner",
    };
  }

  const theirs = await findSheet(ctx.spaceId, ctx.partner.userId);
  const partnerHasFinished = Boolean(theirs?.completedAt);

  const visible = iHaveFinished && partnerHasFinished && theirs ? toDTO(theirs) : null;

  return {
    me: toDTO(mine),
    partner: visible,
    partnerName: ctx.partner.displayName,
    partnerHasFinished,
    iHaveFinished,
    lockedReason: visible ? null : !iHaveFinished ? "mine_unfinished" : "theirs_unfinished",
  };
}

export async function getMySheet(ctx: SpaceContext): Promise<SheetDTO> {
  return toDTO(await ensureSheet(ctx, ctx.user.id));
}

/** Counts the boxes with something in them. */
function countFilled(row: {
  nickname: string | null;
  livingPlace: LivingPlace | null;
  livingCity: string | null;
  mood: SheetMood | null;
  traits: SheetTrait[];
  dream: string | null;
  selfScore: number | null;
  [key: string]: unknown;
}): number {
  const textKeys = [
    "nickname",
    "livingCity",
    "dream",
    ...FAVOURITE_FIELDS.map((f) => f.key),
    ...NOTE_FIELDS.map((f) => f.key),
  ];
  let filled = textKeys.filter((k) => {
    const v = row[k];
    return typeof v === "string" && v.trim().length > 0;
  }).length;

  if (row.livingPlace) filled += 1;
  if (row.mood) filled += 1;
  if (row.traits.length > 0) filled += 1;
  if (row.selfScore !== null) filled += 1;
  return filled;
}

/** Saves a draft. Only ever touches the caller's own sheet. */
export async function saveMySheet(ctx: SpaceContext, input: unknown): Promise<SheetDTO> {
  const data = updateSheetSchema.parse(input);
  await ensureSheet(ctx, ctx.user.id);

  // The birthday lives on the account, since the rest of the app reads it there.
  if (data.birthday !== undefined) {
    await db.user.update({
      where: { id: ctx.user.id },
      data: { birthday: data.birthday ? dateFromKey(data.birthday) : null },
    });
  }

  // The birthday was handled above; the rest belongs on the sheet row.
  const sheetFields = { ...data };
  delete sheetFields.birthday;

  await db.profileSheet.update({
    where: { personUserId: ctx.user.id },
    data: Object.fromEntries(
      Object.entries(sheetFields).filter(([, v]) => v !== undefined),
    ),
  });

  return toDTO(await ensureSheet(ctx, ctx.user.id));
}

/**
 * Hands the sheet in. Asks for a handful of answers first, so "xong rồi" means
 * something and the unlock is actually an exchange.
 */
export async function completeMySheet(ctx: SpaceContext): Promise<SheetDTO> {
  const row = await ensureSheet(ctx, ctx.user.id);
  const filled = countFilled(row);

  if (filled < MIN_FILLED_TO_COMPLETE) {
    const missing = MIN_FILLED_TO_COMPLETE - filled;
    throw badRequest(`Điền thêm ${missing} ô nữa rồi nộp nhé — phiếu trống quá thì người kia đọc gì.`);
  }

  if (!row.completedAt) {
    await db.profileSheet.update({
      where: { personUserId: ctx.user.id },
      data: { completedAt: new Date() },
    });
  }

  return toDTO(await ensureSheet(ctx, ctx.user.id));
}

/** True when the caller still has to fill their sheet in. */
export async function needsSheet(ctx: SpaceContext): Promise<boolean> {
  const row = await db.profileSheet.findFirst({
    where: { spaceId: ctx.spaceId, personUserId: ctx.user.id },
    select: { completedAt: true },
  });
  return !row?.completedAt;
}
