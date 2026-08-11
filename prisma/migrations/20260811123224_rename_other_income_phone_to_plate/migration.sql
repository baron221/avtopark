/*
  Warnings:

  - You are about to drop the column `phone` on the `other_incomes` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "other_incomes" DROP COLUMN "phone",
ADD COLUMN     "plate_number" TEXT;
