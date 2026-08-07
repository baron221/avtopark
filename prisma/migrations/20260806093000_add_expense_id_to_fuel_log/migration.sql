-- AlterTable
ALTER TABLE "fuel_logs" ADD COLUMN "expense_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "fuel_logs_expense_id_key" ON "fuel_logs"("expense_id");

-- AddForeignKey
ALTER TABLE "fuel_logs" ADD CONSTRAINT "fuel_logs_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
