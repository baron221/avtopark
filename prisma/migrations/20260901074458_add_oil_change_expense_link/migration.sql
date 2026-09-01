-- AlterTable
ALTER TABLE "oil_changes" ADD COLUMN "expense_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "oil_changes_expense_id_key" ON "oil_changes"("expense_id");

-- AddForeignKey
ALTER TABLE "oil_changes" ADD CONSTRAINT "oil_changes_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
