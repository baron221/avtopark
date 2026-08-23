-- CreateTable
CREATE TABLE "vehicle_movement_watches" (
    "vehicle_id" TEXT NOT NULL,
    "last_lat" DOUBLE PRECISION NOT NULL,
    "last_lon" DOUBLE PRECISION NOT NULL,
    "alerted_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_movement_watches_pkey" PRIMARY KEY ("vehicle_id")
);

-- AddForeignKey
ALTER TABLE "vehicle_movement_watches" ADD CONSTRAINT "vehicle_movement_watches_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
