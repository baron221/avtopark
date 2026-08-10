/*
  Warnings:

  - You are about to drop the column `point` on the `owner_payouts` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "owner_payouts_point_payout_date_idx";

-- AlterTable
ALTER TABLE "owner_payouts" DROP COLUMN "point";

-- CreateIndex
CREATE INDEX "owner_payouts_payout_date_idx" ON "owner_payouts"("payout_date");
