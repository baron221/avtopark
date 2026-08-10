-- CreateTable
CREATE TABLE "plan_handovers" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "handover_date" TIMESTAMP(3) NOT NULL,
    "amount" BIGINT NOT NULL,
    "reported_by" TEXT NOT NULL,
    "reported_at" TIMESTAMP(3) NOT NULL,
    "confirmed_by" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_handovers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "plan_handovers_handover_date_idx" ON "plan_handovers"("handover_date");

-- CreateIndex
CREATE UNIQUE INDEX "plan_handovers_driver_id_handover_date_key" ON "plan_handovers"("driver_id", "handover_date");

-- AddForeignKey
ALTER TABLE "plan_handovers" ADD CONSTRAINT "plan_handovers_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_handovers" ADD CONSTRAINT "plan_handovers_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_handovers" ADD CONSTRAINT "plan_handovers_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_handovers" ADD CONSTRAINT "plan_handovers_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
