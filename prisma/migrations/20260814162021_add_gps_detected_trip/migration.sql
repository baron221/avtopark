-- CreateEnum
CREATE TYPE "GpsTripDirection" AS ENUM ('FARGONA_TO_QUVA', 'QUVA_TO_FARGONA');

-- CreateTable
CREATE TABLE "gps_detected_trips" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "direction" "GpsTripDirection" NOT NULL,
    "detected_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gps_detected_trips_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "gps_detected_trips_vehicle_id_detected_at_idx" ON "gps_detected_trips"("vehicle_id", "detected_at");

-- AddForeignKey
ALTER TABLE "gps_detected_trips" ADD CONSTRAINT "gps_detected_trips_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
