-- CreateTable
CREATE TABLE "owner_balance_report_logs" (
    "id" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closing" BIGINT NOT NULL,
    "sent_by" TEXT NOT NULL,

    CONSTRAINT "owner_balance_report_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "owner_balance_report_logs_sent_at_idx" ON "owner_balance_report_logs"("sent_at");

-- AddForeignKey
ALTER TABLE "owner_balance_report_logs" ADD CONSTRAINT "owner_balance_report_logs_sent_by_fkey" FOREIGN KEY ("sent_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
