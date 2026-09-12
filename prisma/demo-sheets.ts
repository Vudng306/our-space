/**
 * The two demo introduction sheets.
 *
 * Data only, with no side effects, so both the seed and the top-up script
 * can import it without one running the other.
 */
export const DEMO_SHEETS = {
  "mai@example.com": {
    nickname: "Mai mèo",
    livingPlace: "HOUSE" as const,
    livingCity: "Hải Phòng",
    favFood: "bún cá cay",
    favDrink: "trà sen",
    favColor: "xanh rêu",
    favAnimal: "mèo",
    favNumber: "4",
    favSport: "bơi",
    favMusic: "indie Việt",
    specialHobby: "vẽ nguệch ngoạc ra lề vở lúc đang họp",
    idol: "mẹ tớ",
    favTimeOfDay: "sáng sớm, lúc chưa ai dậy",
    mood: "CALM" as const,
    traits: ["LOWKEY", "OVERTHINKING"] as const,
    dream: "Mở một tiệm sách nhỏ, có mèo nằm ở cửa sổ.",
    selfScore: 72,
  },
  "linh@example.com": {
    nickname: "Linh bí",
    livingPlace: "APARTMENT" as const,
    livingCity: "Hà Nội",
    favFood: "bún chả",
    favDrink: "trà đào cam sả",
    favColor: "vàng nắng",
    favAnimal: "chó cỏ",
    favNumber: "7",
    favSport: "cầu lông",
    favMusic: "US-UK cũ",
    specialHobby: "nấu ăn xong bắt người khác khen",
    idol: "bố tớ",
    favTimeOfDay: "tối muộn, lúc phố vắng",
    mood: "CHEERFUL" as const,
    traits: ["OPEN", "PLAYFUL"] as const,
    dream: "Đi cho hết 63 tỉnh, mỗi nơi ăn một món.",
    selfScore: 85,
  },
};
