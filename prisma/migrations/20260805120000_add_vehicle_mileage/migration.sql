-- CreateTable
CREATE TABLE "vehicle_mileages" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "km" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "vehicle_mileages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_mileages_vehicle_id_date_key" ON "vehicle_mileages"("vehicle_id", "date");

-- CreateIndex
CREATE INDEX "vehicle_mileages_vehicle_id_date_idx" ON "vehicle_mileages"("vehicle_id", "date");

-- AddForeignKey
ALTER TABLE "vehicle_mileages" ADD CONSTRAINT "vehicle_mileages_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
