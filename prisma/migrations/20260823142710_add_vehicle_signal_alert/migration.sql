-- CreateTable
CREATE TABLE "vehicle_signal_alerts" (
    "vehicle_id" TEXT NOT NULL,
    "alerted_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_signal_alerts_pkey" PRIMARY KEY ("vehicle_id")
);

-- AddForeignKey
ALTER TABLE "vehicle_signal_alerts" ADD CONSTRAINT "vehicle_signal_alerts_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
