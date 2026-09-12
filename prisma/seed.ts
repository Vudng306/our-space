/**
 * Development seed.
 *
 * Creates two accounts in one space with a few months of moments, so the
 * timeline, calendar and search have something to show. Refuses to run against
 * a production database.
 */
import "dotenv/config";
import { DEMO_SHEETS } from "./demo-sheets";
import bcrypt from "bcryptjs";
import sharp from "sharp";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { promises as fs } from "node:fs";
import path from "node:path";

if (process.env.NODE_ENV === "production") {
  throw new Error("Refusing to seed a production database.");
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

const PASSWORD = "ourspace-dev-2026";
const STORAGE_DIR = path.resolve(process.cwd(), process.env.STORAGE_LOCAL_DIR ?? "./storage");

type SeedMood = "HAPPY" | "LOVED" | "CALM" | "EXCITED" | "TIRED" | "SAD";

const CAPTIONS: { text: string; place?: string; tags: string[]; mood?: SeedMood }[] = [
  { text: "Đi ăn ramen sau giờ học. Nước dùng mặn hơn bình thường nhưng vẫn hết sạch.", place: "Hà Nội", tags: ["ramen", "date"], mood: "LOVED" },
  { text: "Sáng nay trời trở lạnh. Uống cà phê ở quán quen, ngồi im một lúc lâu.", place: "Hà Nội", tags: ["coffee"], mood: "CALM" },
  { text: "Tập làm bánh mì lần đầu. Cháy mất một góc nhưng ăn vẫn ngon.", tags: ["cooking"], mood: "HAPPY" },
  { text: "Đi bộ quanh hồ, đếm được mười một con chó.", place: "Hồ Tây", tags: ["walk"], mood: "CALM" },
  { text: "Xem lại phim cũ. Vẫn khóc đúng chỗ đó.", tags: ["movie"], mood: "SAD" },
  { text: "Mua hoa tulip trắng trên đường về.", place: "Chợ hoa Quảng An", tags: ["flowers"], mood: "LOVED" },
  { text: "Deadline dí. Ăn tối lúc 10 giờ.", tags: ["work"], mood: "TIRED" },
  { text: "Chuyến tàu đầu tiên đi Ninh Bình. Ngồi cạnh cửa sổ suốt.", place: "Ninh Bình", tags: ["trip", "train"], mood: "EXCITED" },
  { text: "Nắng đẹp. Phơi chăn, dọn nhà, không làm gì to tát.", tags: ["home"], mood: "CALM" },
  { text: "Ăn bún chả ở quán cũ. Vẫn đúng vị.", place: "Hà Nội", tags: ["food"], mood: "HAPPY" },
  { text: "Đi hiệu sách, đứng đọc hết một chương rồi mới mua.", tags: ["books"], mood: "CALM" },
  { text: "Mưa cả ngày. Ở nhà nghe nhạc, không ra khỏi cửa.", tags: ["rain", "home"], mood: "CALM" },
];

/** Solid-colour placeholders — real enough to exercise thumbnails and layout. */
async function makePhoto(seed: number): Promise<{ original: Buffer; thumb: Buffer; width: number; height: number }> {
  const palette = [
    { r: 214, g: 175, b: 160 },
    { r: 176, g: 158, b: 186 },
    { r: 158, g: 180, b: 166 },
    { r: 205, g: 190, b: 150 },
    { r: 182, g: 160, b: 152 },
  ];
  const colour = palette[seed % palette.length];
  const width = seed % 3 === 0 ? 1200 : 1600;
  const height = seed % 3 === 0 ? 1600 : 1200;

  const base = sharp({
    create: { width, height, channels: 3, background: colour },
  });

  const original = await base.clone().jpeg({ quality: 86 }).toBuffer();
  const thumb = await sharp(original).resize({ width: 640, height: 640, fit: "inside" }).webp({ quality: 72 }).toBuffer();
  return { original, thumb, width, height };
}

async function writeObject(key: string, body: Buffer) {
  const full = path.join(STORAGE_DIR, key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, body);
}

function dateOnly(d: Date): Date {
  return new Date(`${d.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

async function main() {
  console.log("Seeding…");

  const existing = await db.user.findUnique({ where: { email: "mai@example.com" } });
  if (existing) {
    console.log("Seed data already present. Delete the space from Settings, or reset the database, to reseed.");
    return;
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  const mai = await db.user.create({
    data: {
      email: "mai@example.com",
      displayName: "Mai",
      passwordHash,
      birthday: dateOnly(new Date("1999-04-12")),
      hometown: "Hải Phòng",
      occupation: "Thiết kế đồ hoạ",
      bio: "Dậy sớm, ngủ muộn, lúc nào cũng có một quyển sách đọc dở trong túi.",
    },
  });
  const linh = await db.user.create({
    data: {
      email: "linh@example.com",
      displayName: "Linh",
      passwordHash,
      birthday: dateOnly(new Date("2000-10-10")),
      hometown: "Hà Nội",
      occupation: "Sinh viên năm cuối",
      bio: "Nấu ăn ngon hơn mình tưởng. Không chịu được phim kinh dị.",
    },
  });

  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 2);

  const space = await db.coupleSpace.create({
    data: {
      name: "Mai & Linh",
      startDate: dateOnly(startDate),
      createdById: mai.id,
      members: {
        create: [
          { userId: mai.id, role: "OWNER" },
          { userId: linh.id, role: "MEMBER" },
        ],
      },
    },
  });

  // Moments spread over the last ~5 months, roughly every few days.
  let photoSeed = 0;
  const createdMoments: string[] = [];

  for (let i = 0; i < 46; i++) {
    const template = CAPTIONS[i % CAPTIONS.length];
    const occurredAt = new Date();
    occurredAt.setDate(occurredAt.getDate() - i * 3 - (i % 2));
    occurredAt.setHours(9 + (i % 11), (i * 7) % 60, 0, 0);

    const photoCount = i % 5 === 0 ? 0 : (i % 4) + 1;
    const mediaIds: string[] = [];

    for (let p = 0; p < photoCount; p++) {
      const { original, thumb, width, height } = await makePhoto(photoSeed++);
      const asset = await db.mediaAsset.create({
        data: {
          spaceId: space.id,
          uploadedById: i % 2 === 0 ? mai.id : linh.id,
          objectKey: `pending-${i}-${p}`,
          mimeType: "image/jpeg",
          width,
          height,
          byteSize: original.byteLength,
        },
      });
      const objectKey = `spaces/${space.id}/media/${asset.id}/original.jpg`;
      const thumbKey = `spaces/${space.id}/media/${asset.id}/thumb.webp`;
      await writeObject(objectKey, original);
      await writeObject(thumbKey, thumb);
      await db.mediaAsset.update({ where: { id: asset.id }, data: { objectKey, thumbKey } });
      mediaIds.push(asset.id);
    }

    const tagIds: string[] = [];
    for (const name of template.tags) {
      const tag = await db.tag.upsert({
        where: { spaceId_name: { spaceId: space.id, name } },
        create: { spaceId: space.id, name },
        update: {},
      });
      tagIds.push(tag.id);
    }

    const moment = await db.moment.create({
      data: {
        spaceId: space.id,
        createdById: i % 2 === 0 ? mai.id : linh.id,
        caption: template.text,
        occurredAt,
        timezone: "Asia/Bangkok",
        localDate: dateOnly(occurredAt),
        mood: template.mood ?? null,
        locationText: template.place ?? null,
        media: { create: mediaIds.map((mediaId, order) => ({ mediaId, sortOrder: order })) },
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
      },
    });
    createdMoments.push(moment.id);
  }

  const firstTrip = createdMoments.filter((_, i) => i % 12 === 7).slice(0, 3);

  await db.memory.create({
    data: {
      spaceId: space.id,
      title: "Chuyến đi Ninh Bình",
      description: "Đi tàu sớm, về muộn, chân mỏi nhưng vui.",
      startDate: dateOnly(new Date(Date.now() - 60 * 86400000)),
      endDate: dateOnly(new Date(Date.now() - 58 * 86400000)),
      moments: { create: firstTrip.map((momentId) => ({ momentId })) },
    },
  });

  await db.memory.create({
    data: {
      spaceId: space.id,
      title: "Lần đầu gặp nhau",
      description: "Quán cà phê nhỏ, mưa, nói chuyện đến lúc quán đóng cửa.",
      startDate: dateOnly(startDate),
    },
  });

  await db.preference.createMany({
    data: [
      { spaceId: space.id, personUserId: linh.id, createdById: mai.id, category: "FLOWER", value: "Tulip trắng", sentiment: "LOVE", note: "Không thích màu hồng" },
      { spaceId: space.id, personUserId: linh.id, createdById: mai.id, category: "FOOD", value: "Bún chả", sentiment: "LOVE" },
      { spaceId: space.id, personUserId: linh.id, createdById: mai.id, category: "DRINK", value: "Cà phê sữa đá", sentiment: "LIKE" },
      { spaceId: space.id, personUserId: linh.id, createdById: mai.id, category: "FOOD", value: "Sầu riêng", sentiment: "DISLIKE" },
      { spaceId: space.id, personUserId: mai.id, createdById: linh.id, category: "COLOR", value: "Xanh rêu", sentiment: "LOVE" },
      { spaceId: space.id, personUserId: mai.id, createdById: linh.id, category: "GIFT", value: "Sách giấy", sentiment: "LOVE", note: "Thích bìa mềm hơn" },
      { spaceId: space.id, personUserId: mai.id, createdById: linh.id, category: "PLACE", value: "Hồ Tây lúc chiều muộn", sentiment: "LIKE" },
    ],
  });

  const anniversary = dateOnly(startDate);
  const birthday = new Date();
  birthday.setMonth(birthday.getMonth() + 1);

  await db.importantDate.createMany({
    data: [
      { spaceId: space.id, title: "Kỷ niệm ngày quen nhau", eventDate: anniversary, recurrence: "YEARLY" },
      { spaceId: space.id, title: "Sinh nhật Linh", eventDate: dateOnly(birthday), recurrence: "YEARLY" },
      { spaceId: space.id, title: "Chuyến đi Đà Lạt đã đặt", eventDate: dateOnly(new Date(Date.now() + 21 * 86400000)), recurrence: "NONE", note: "Vé đã mua" },
    ],
  });

  await db.bucketListItem.createMany({
    data: [
      { spaceId: space.id, createdById: mai.id, title: "Xem mặt trời mọc ở Fansipan", status: "WANT_TO_DO" },
      { spaceId: space.id, createdById: linh.id, title: "Học nấu phở tử tế", status: "PLANNED", note: "Đăng ký lớp cuối tháng" },
      { spaceId: space.id, createdById: mai.id, title: "Đi tàu Bắc Nam", status: "WANT_TO_DO" },
      { spaceId: space.id, createdById: linh.id, title: "Trồng xong ban công", status: "DONE", completedAt: new Date() },
    ],
  });

  // The two introduction sheets, already handed in so the pair is visible.
  for (const [email, sheet] of Object.entries(DEMO_SHEETS)) {
    const person = email === "mai@example.com" ? mai : linh;
    await db.profileSheet.create({
      data: {
        spaceId: space.id,
        personUserId: person.id,
        ...sheet,
        traits: [...sheet.traits],
        completedAt: new Date(),
      },
    });
  }

  console.log(`
Seeded.

  Space:    ${space.name}
  Sign in:  mai@example.com   / ${PASSWORD}
            linh@example.com  / ${PASSWORD}
`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
