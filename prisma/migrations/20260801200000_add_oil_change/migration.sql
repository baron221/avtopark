-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "odometer_km" INTEGER;

-- CreateTable
CREATE TABLE "oil_changes" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL,
    "odometer_km" INTEGER NOT NULL,
    "interval_km" INTEGER NOT NULL,
    "interval_months" INTEGER NOT NULL,
    "amount" BIGINT NOT NULL,
    "note" TEXT,
    "entered_by" TEXT NOT NULL,

    CONSTRAINT "oil_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "oil_changes_vehicle_id_changed_at_idx" ON "oil_changes"("vehicle_id", "changed_at");

-- AddForeignKey
ALTER TABLE "oil_changes" ADD CONSTRAINT "oil_changes_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oil_changes" ADD CONSTRAINT "oil_changes_entered_by_fkey" FOREIGN KEY ("entered_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
