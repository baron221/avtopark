-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'PARTIAL';

-- AlterTable
ALTER TABLE "station_payments" ADD COLUMN     "paid_amount" BIGINT NOT NULL DEFAULT 0;
