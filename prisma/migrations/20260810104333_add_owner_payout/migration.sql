-- CreateTable
CREATE TABLE "owner_payouts" (
    "id" TEXT NOT NULL,
    "point" "Point" NOT NULL,
    "amount" BIGINT NOT NULL,
    "payout_date" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "entered_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "owner_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "owner_payouts_point_payout_date_idx" ON "owner_payouts"("point", "payout_date");

-- AddForeignKey
ALTER TABLE "owner_payouts" ADD CONSTRAINT "owner_payouts_entered_by_fkey" FOREIGN KEY ("entered_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
