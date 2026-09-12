-- CreateEnum
CREATE TYPE "LivingPlace" AS ENUM ('HOUSE', 'APARTMENT');

-- CreateEnum
CREATE TYPE "SheetMood" AS ENUM ('ANGRY', 'ANXIOUS', 'CALM', 'CHEERFUL', 'CONFIDENT', 'EMPTY', 'SLEEPLESS', 'SAD', 'TIRED', 'BLISSFUL');

-- CreateEnum
CREATE TYPE "SheetTrait" AS ENUM ('LOWKEY', 'OPEN', 'CHANGEABLE', 'HOT_TEMPERED', 'OVERTHINKING', 'PLAYFUL');

-- CreateTable
CREATE TABLE "profile_sheets" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "personUserId" TEXT NOT NULL,
    "nickname" TEXT,
    "livingPlace" "LivingPlace",
    "livingCity" TEXT,
    "favFood" TEXT,
    "favDrink" TEXT,
    "favColor" TEXT,
    "favAnimal" TEXT,
    "favNumber" TEXT,
    "favSport" TEXT,
    "favMusic" TEXT,
    "specialHobby" TEXT,
    "idol" TEXT,
    "favTimeOfDay" TEXT,
    "mood" "SheetMood",
    "traits" "SheetTrait"[],
    "dream" TEXT,
    "selfScore" INTEGER,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profile_sheets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profile_sheets_personUserId_key" ON "profile_sheets"("personUserId");

-- CreateIndex
CREATE INDEX "profile_sheets_spaceId_idx" ON "profile_sheets"("spaceId");

-- AddForeignKey
ALTER TABLE "profile_sheets" ADD CONSTRAINT "profile_sheets_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "couple_spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_sheets" ADD CONSTRAINT "profile_sheets_personUserId_fkey" FOREIGN KEY ("personUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
