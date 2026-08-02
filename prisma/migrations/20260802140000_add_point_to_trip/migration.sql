-- AlterTable
ALTER TABLE "trips" ADD COLUMN "point" "Point";

-- Backfill: every historical trip was entered by the point matching its
-- vehicle's assigned point, since the shared-fleet model didn't exist yet.
UPDATE "trips" t SET "point" = v."point" FROM "vehicles" v WHERE v."id" = t."vehicle_id";
UPDATE "trips" SET "point" = 'FARGONA' WHERE "point" IS NULL;

-- AlterTable
ALTER TABLE "trips" ALTER COLUMN "point" SET NOT NULL;

-- CreateIndex
CREATE INDEX "trips_point_trip_date_idx" ON "trips"("point", "trip_date");
