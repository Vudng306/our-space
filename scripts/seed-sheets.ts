/**
 * Fills in the two demo introduction sheets on a database that already has the
 * accounts — for a seed created before the sheet existed, so it can be brought
 * up to date without a reset.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { DEMO_SHEETS } from "../prisma/demo-sheets";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  for (const [email, sheet] of Object.entries(DEMO_SHEETS)) {
    const user = await db.user.findUnique({
      where: { email },
      include: { memberships: { select: { spaceId: true } } },
    });
    if (!user?.memberships[0]) {
      console.log(`skipped ${email} — no account or no space`);
      continue;
    }

    const data = { ...sheet, traits: [...sheet.traits], completedAt: new Date() };
    await db.profileSheet.upsert({
      where: { personUserId: user.id },
      create: { spaceId: user.memberships[0].spaceId, personUserId: user.id, ...data },
      update: data,
    });
    console.log(`sheet ready for ${email}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
