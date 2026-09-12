import { z } from "zod";
import { isValidTimeZone } from "./datetime";

export const CAPTION_MAX = 2000;

const dateKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Dùng định dạng YYYY-MM-DD.")
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), "Ngày này không có thật.");

const timezoneSchema = z
  .string()
  .min(1)
  .max(64)
  .refine(isValidTimeZone, "Múi giờ không hợp lệ.")
  .default("UTC");

const trimmed = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v.length ? v : null))
    .nullable()
    .optional();

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const emailSchema = z.string().trim().toLowerCase().email("Địa chỉ email trông không đúng.");

export const passwordSchema = z
  .string()
  .min(10, "Dùng ít nhất 10 ký tự.")
  .max(200, "Mật khẩu dài quá.");

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: trimmed(60).min(1, "Cho biết nên gọi bạn là gì."),
  inviteToken: z.string().trim().min(1).max(200).optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Nhập mật khẩu."),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(1).max(200),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

// ---------------------------------------------------------------------------
// Space
// ---------------------------------------------------------------------------

export const createSpaceSchema = z.object({
  name: trimmed(80).min(1, "Đặt tên cho không gian này."),
  startDate: dateKeySchema.nullable().optional(),
});

export const updateSpaceSchema = z.object({
  name: trimmed(80).min(1).optional(),
  startDate: dateKeySchema.nullable().optional(),
});

/** Account identity — only the owner of the account changes these. */
export const updateProfileSchema = z.object({
  displayName: trimmed(60).min(1).optional(),
  avatarMediaId: z.string().cuid().nullable().optional(),
});

/**
 * The "about this person" fields. Either member of the space may edit them for
 * either person, so one of you can fill in what you know about the other.
 */
export const updatePersonSchema = z.object({
  birthday: dateKeySchema.nullable().optional(),
  hometown: optionalText(80),
  occupation: optionalText(80),
  bio: optionalText(600),
});

// ---------------------------------------------------------------------------
// Moments
// ---------------------------------------------------------------------------

export const moodSchema = z.enum(["HAPPY", "LOVED", "CALM", "TIRED", "SAD", "EXCITED"]);

const tagsSchema = z
  .array(z.string().trim().min(1).max(30))
  .max(15, "Fifteen tags is plenty.")
  .transform((tags) => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of tags) {
      const t = raw.toLowerCase().replace(/^#/, "").trim();
      if (t && !seen.has(t)) {
        seen.add(t);
        out.push(t);
      }
    }
    return out;
  })
  .optional();

export const createMomentSchema = z.object({
  caption: optionalText(CAPTION_MAX),
  occurredAt: z.string().datetime({ offset: true }),
  timezone: timezoneSchema,
  mood: moodSchema.nullable().optional(),
  locationText: optionalText(120),
  mediaIds: z.array(z.string().cuid()).max(30).default([]),
  tags: tagsSchema,
});

export const updateMomentSchema = createMomentSchema.partial().extend({
  occurredAt: z.string().datetime({ offset: true }).optional(),
});

export const momentQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  from: dateKeySchema.optional(),
  to: dateKeySchema.optional(),
  authorId: z.string().cuid().optional(),
  mood: moodSchema.optional(),
  tag: z.string().trim().max(30).optional(),
  q: z.string().trim().max(120).optional(),
});

// ---------------------------------------------------------------------------
// Memories
// ---------------------------------------------------------------------------

export const createMemorySchema = z
  .object({
    title: trimmed(120).min(1, "Give this memory a title."),
    description: optionalText(4000),
    startDate: dateKeySchema,
    endDate: dateKeySchema.nullable().optional(),
    coverMediaId: z.string().cuid().nullable().optional(),
    momentIds: z.array(z.string().cuid()).max(100).optional(),
  })
  .refine((v) => !v.endDate || v.endDate >= v.startDate, {
    message: "The end date cannot be before the start date.",
    path: ["endDate"],
  });

export const updateMemorySchema = z
  .object({
    title: trimmed(120).min(1).optional(),
    description: optionalText(4000),
    startDate: dateKeySchema.optional(),
    endDate: dateKeySchema.nullable().optional(),
    coverMediaId: z.string().cuid().nullable().optional(),
    momentIds: z.array(z.string().cuid()).max(100).optional(),
  })
  .refine((v) => !v.endDate || !v.startDate || v.endDate >= v.startDate, {
    message: "The end date cannot be before the start date.",
    path: ["endDate"],
  });

// ---------------------------------------------------------------------------
// About us
// ---------------------------------------------------------------------------

export const preferenceCategorySchema = z.enum([
  "FOOD",
  "DRINK",
  "COLOR",
  "FLOWER",
  "FASHION",
  "GIFT",
  "PLACE",
  "OTHER",
]);
export const sentimentSchema = z.enum(["LOVE", "LIKE", "NEUTRAL", "DISLIKE"]);

export const createPreferenceSchema = z.object({
  personUserId: z.string().cuid(),
  category: preferenceCategorySchema,
  value: trimmed(80).min(1, "Là thứ gì?"),
  sentiment: sentimentSchema.default("LIKE"),
  note: optionalText(500),
});

export const updatePreferenceSchema = createPreferenceSchema.partial().omit({ personUserId: true });

export const recurrenceSchema = z.enum(["NONE", "YEARLY"]);

export const createImportantDateSchema = z.object({
  title: trimmed(120).min(1, "Give the date a name."),
  eventDate: dateKeySchema,
  recurrence: recurrenceSchema.default("NONE"),
  note: optionalText(500),
});

export const updateImportantDateSchema = createImportantDateSchema.partial();

export const bucketStatusSchema = z.enum(["WANT_TO_DO", "PLANNED", "DONE"]);

export const createBucketItemSchema = z.object({
  title: trimmed(160).min(1, "What do you want to do?"),
  note: optionalText(1000),
  status: bucketStatusSchema.default("WANT_TO_DO"),
  targetDate: dateKeySchema.nullable().optional(),
});

export const updateBucketItemSchema = createBucketItemSchema.partial();

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

export const calendarQuerySchema = z.object({
  from: dateKeySchema,
  to: dateKeySchema,
});

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1, "Type something to search for.").max(120),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const confirmDeleteSchema = z.object({
  confirm: z.literal(true),
  phrase: z.string().optional(),
});

// ---------------------------------------------------------------------------
// The introduction sheet
// ---------------------------------------------------------------------------

export const livingPlaceSchema = z.enum(["HOUSE", "APARTMENT"]);

export const sheetMoodSchema = z.enum([
  "ANGRY",
  "ANXIOUS",
  "CALM",
  "CHEERFUL",
  "CONFIDENT",
  "EMPTY",
  "SLEEPLESS",
  "SAD",
  "TIRED",
  "BLISSFUL",
]);

export const sheetTraitSchema = z.enum([
  "LOWKEY",
  "OPEN",
  "CHANGEABLE",
  "HOT_TEMPERED",
  "OVERTHINKING",
  "PLAYFUL",
]);

/**
 * Every field is optional: a half-filled sheet is saved as a draft, and only
 * the explicit "xong rồi" step marks it complete.
 */
export const updateSheetSchema = z.object({
  nickname: optionalText(40),
  livingPlace: livingPlaceSchema.nullable().optional(),
  livingCity: optionalText(60),
  birthday: dateKeySchema.nullable().optional(),

  favFood: optionalText(60),
  favDrink: optionalText(60),
  favColor: optionalText(60),
  favAnimal: optionalText(60),
  favNumber: optionalText(20),
  favSport: optionalText(60),
  favMusic: optionalText(60),

  specialHobby: optionalText(200),
  idol: optionalText(200),
  favTimeOfDay: optionalText(200),

  mood: sheetMoodSchema.nullable().optional(),
  traits: z.array(sheetTraitSchema).max(6).optional(),
  dream: optionalText(600),
  selfScore: z.coerce.number().int().min(0).max(100).nullable().optional(),
});
