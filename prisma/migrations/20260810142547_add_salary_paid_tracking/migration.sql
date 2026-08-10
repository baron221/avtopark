-- AlterTable
ALTER TABLE "salaries" ADD COLUMN     "paid_at" TIMESTAMP(3),
ADD COLUMN     "paid_by" TEXT;

-- AddForeignKey
ALTER TABLE "salaries" ADD CONSTRAINT "salaries_paid_by_fkey" FOREIGN KEY ("paid_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
