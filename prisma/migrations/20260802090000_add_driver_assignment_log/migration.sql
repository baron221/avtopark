-- CreateTable
CREATE TABLE "driver_assignment_logs" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),

    CONSTRAINT "driver_assignment_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "driver_assignment_logs_vehicle_id_started_at_idx" ON "driver_assignment_logs"("vehicle_id", "started_at");

-- CreateIndex
CREATE INDEX "driver_assignment_logs_driver_id_idx" ON "driver_assignment_logs"("driver_id");

-- AddForeignKey
ALTER TABLE "driver_assignment_logs" ADD CONSTRAINT "driver_assignment_logs_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_assignment_logs" ADD CONSTRAINT "driver_assignment_logs_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
