-- CreateTable
CREATE TABLE "cash_opening_balances" (
    "id" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "set_date" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "entered_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_opening_balances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cash_opening_balances_set_date_idx" ON "cash_opening_balances"("set_date");

-- AddForeignKey
ALTER TABLE "cash_opening_balances" ADD CONSTRAINT "cash_opening_balances_entered_by_fkey" FOREIGN KEY ("entered_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
