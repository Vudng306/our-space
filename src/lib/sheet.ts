/**
 * The introduction sheet, as content rather than markup.
 *
 * The form and the read-only view both render from these tables, so a label
 * only ever exists in one place and the two screens cannot drift apart.
 */

export const LIVING_PLACES = [
  { value: "HOUSE", label: "Nhà riêng", emoji: "🏡" },
  { value: "APARTMENT", label: "Chung cư", emoji: "🏢" },
] as const;

export const SHEET_MOODS = [
  { value: "ANGRY", label: "Tức giận", emoji: "😠" },
  { value: "ANXIOUS", label: "Lo lắng", emoji: "😟" },
  { value: "CALM", label: "Bình thản", emoji: "😌" },
  { value: "CHEERFUL", label: "Vui vẻ", emoji: "😄" },
  { value: "CONFIDENT", label: "Tự tin", emoji: "😎" },
  { value: "EMPTY", label: "Trống rỗng", emoji: "😶" },
  { value: "SLEEPLESS", label: "Mất ngủ", emoji: "🥱" },
  { value: "SAD", label: "Buồn bã", emoji: "😢" },
  { value: "TIRED", label: "Mệt mỏi", emoji: "😣" },
  { value: "BLISSFUL", label: "Hạnh phúc", emoji: "🥰" },
] as const;

export const SHEET_TRAITS = [
  { value: "LOWKEY", label: "Lowkey / Bí ẩn" },
  { value: "OPEN", label: "Cởi mở, thân thiện" },
  { value: "CHANGEABLE", label: "Lúc này lúc kia" },
  { value: "HOT_TEMPERED", label: "Nóng tính, dễ cáu" },
  { value: "OVERTHINKING", label: "Overthinking, đa nghi" },
  { value: "PLAYFUL", label: "Nhây, hay giỡn" },
] as const;

/** The seven "sở thích" slots, in the order they appear on the sheet. */
export const FAVOURITE_FIELDS = [
  { key: "favFood", label: "Món ăn", placeholder: "bún chả" },
  { key: "favDrink", label: "Đồ uống", placeholder: "trà đào" },
  { key: "favColor", label: "Màu sắc", placeholder: "xanh rêu" },
  { key: "favAnimal", label: "Con vật", placeholder: "mèo" },
  { key: "favNumber", label: "Con số", placeholder: "7" },
  { key: "favSport", label: "Thể thao", placeholder: "cầu lông" },
  { key: "favMusic", label: "Loại nhạc", placeholder: "indie" },
] as const;

/** The three longer boxes down the left of the sheet. */
export const NOTE_FIELDS = [
  { key: "specialHobby", label: "Sở thích đặc biệt", emoji: "🎨", placeholder: "vẽ nguệch ngoạc lúc chán" },
  { key: "idol", label: "Thần tượng của tớ", emoji: "⭐", placeholder: "" },
  { key: "favTimeOfDay", label: "Thời gian yêu thích trong ngày", emoji: "🕰️", placeholder: "chiều muộn" },
] as const;

export type FavouriteKey = (typeof FAVOURITE_FIELDS)[number]["key"];
export type NoteKey = (typeof NOTE_FIELDS)[number]["key"];

export const MOOD_BY_VALUE = Object.fromEntries(SHEET_MOODS.map((m) => [m.value, m]));
export const TRAIT_BY_VALUE = Object.fromEntries(SHEET_TRAITS.map((t) => [t.value, t]));
export const LIVING_BY_VALUE = Object.fromEntries(LIVING_PLACES.map((l) => [l.value, l]));

// ---------------------------------------------------------------------------
// Cung hoàng đạo
// ---------------------------------------------------------------------------

const ZODIAC: { until: [number, number]; name: string; emoji: string }[] = [
  { until: [1, 19], name: "Ma Kết", emoji: "♑" },
  { until: [2, 18], name: "Bảo Bình", emoji: "♒" },
  { until: [3, 20], name: "Song Ngư", emoji: "♓" },
  { until: [4, 19], name: "Bạch Dương", emoji: "♈" },
  { until: [5, 20], name: "Kim Ngưu", emoji: "♉" },
  { until: [6, 20], name: "Song Tử", emoji: "♊" },
  { until: [7, 22], name: "Cự Giải", emoji: "♋" },
  { until: [8, 22], name: "Sư Tử", emoji: "♌" },
  { until: [9, 22], name: "Xử Nữ", emoji: "♍" },
  { until: [10, 22], name: "Thiên Bình", emoji: "♎" },
  { until: [11, 21], name: "Thần Nông", emoji: "♏" },
  { until: [12, 21], name: "Nhân Mã", emoji: "♐" },
  { until: [12, 31], name: "Ma Kết", emoji: "♑" },
];

/**
 * Derived from the birthday rather than asked for — one less thing to type,
 * and it cannot end up disagreeing with the date next to it.
 */
export function zodiacFor(birthdayKey: string | null): { name: string; emoji: string } | null {
  if (!birthdayKey) return null;
  const month = Number(birthdayKey.slice(5, 7));
  const day = Number(birthdayKey.slice(8, 10));
  if (!month || !day) return null;

  for (const sign of ZODIAC) {
    const [m, d] = sign.until;
    if (month < m || (month === m && day <= d)) return { name: sign.name, emoji: sign.emoji };
  }
  return null;
}

/** How full a sheet is, 0–1, for the little progress note on the form. */
export function sheetFilledRatio(values: Record<string, unknown>): number {
  const keys = [
    "nickname",
    "livingPlace",
    "livingCity",
    ...FAVOURITE_FIELDS.map((f) => f.key),
    ...NOTE_FIELDS.map((f) => f.key),
    "mood",
    "dream",
    "selfScore",
  ];
  const filled = keys.filter((k) => {
    const v = values[k];
    return v !== null && v !== undefined && v !== "";
  }).length;
  const traits = Array.isArray(values.traits) && values.traits.length > 0 ? 1 : 0;
  return (filled + traits) / (keys.length + 1);
}
