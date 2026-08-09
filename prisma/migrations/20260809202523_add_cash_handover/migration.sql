-- CreateTable
CREATE TABLE "cash_handovers" (
    "id" TEXT NOT NULL,
    "point" "Point" NOT NULL,
    "handover_date" TIMESTAMP(3) NOT NULL,
    "amount" BIGINT NOT NULL,
    "dispatcher_confirmed_by" TEXT NOT NULL,
    "dispatcher_confirmed_at" TIMESTAMP(3) NOT NULL,
    "accountant_confirmed_by" TEXT,
    "accountant_confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_handovers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cash_handovers_handover_date_idx" ON "cash_handovers"("handover_date");

-- CreateIndex
CREATE UNIQUE INDEX "cash_handovers_point_handover_date_key" ON "cash_handovers"("point", "handover_date");

-- AddForeignKey
ALTER TABLE "cash_handovers" ADD CONSTRAINT "cash_handovers_dispatcher_confirmed_by_fkey" FOREIGN KEY ("dispatcher_confirmed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_handovers" ADD CONSTRAINT "cash_handovers_accountant_confirmed_by_fkey" FOREIGN KEY ("accountant_confirmed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
