-- CreateEnum
CREATE TYPE "OtherIncomePoint" AS ENUM ('FARGONA', 'QUVA', 'BUXGALTERIYA');

-- AlterTable
-- other_incomes.point moves off the shared Point enum onto its own wider
-- one (adds BUXGALTERIYA) — existing rows are only ever FARGONA/QUVA, both
-- present in the new enum, so the cast is lossless.
ALTER TABLE "other_incomes" ALTER COLUMN "point" TYPE "OtherIncomePoint" USING ("point"::text::"OtherIncomePoint");
