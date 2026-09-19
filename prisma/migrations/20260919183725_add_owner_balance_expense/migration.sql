-- CreateTable
CREATE TABLE "owner_balance_expenses" (
    "id" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "expense_date" TIMESTAMP(3) NOT NULL,
    "note" TEXT NOT NULL,
    "entered_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "owner_balance_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "owner_balance_expenses_expense_date_idx" ON "owner_balance_expenses"("expense_date");

-- AddForeignKey
ALTER TABLE "owner_balance_expenses" ADD CONSTRAINT "owner_balance_expenses_entered_by_fkey" FOREIGN KEY ("entered_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
