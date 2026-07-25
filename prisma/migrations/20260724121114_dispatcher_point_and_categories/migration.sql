-- CreateEnum
CREATE TYPE "TripKind" AS ENUM ('TRIP', 'ORDER');

-- CreateEnum
CREATE TYPE "StaffExpenseCategory" AS ENUM ('STOYANKA', 'OZIQ_OVQAT', 'BOSHQA');

-- AlterTable
ALTER TABLE "staff_expenses" ADD COLUMN     "category" "StaffExpenseCategory" NOT NULL DEFAULT 'BOSHQA';

-- AlterTable
ALTER TABLE "trips" ADD COLUMN     "kind" "TripKind" NOT NULL DEFAULT 'TRIP',
ADD COLUMN     "note" TEXT;

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "point" "Point";
