-- Shifts move from daily morning/evening pairs to one full-day assignment
-- per vehicle per month. Existing rows are test data only (5 rows, all for
-- a single day), so they're cleared rather than backfilled.
DELETE FROM "shifts";

DROP INDEX "shifts_vehicle_id_shift_date_shift_type_key";

ALTER TABLE "shifts"
  DROP COLUMN "shift_date",
  DROP COLUMN "shift_type",
  DROP COLUMN "start_time",
  DROP COLUMN "end_time",
  ADD COLUMN "month" TIMESTAMP(3) NOT NULL;

CREATE UNIQUE INDEX "shifts_vehicle_id_month_key" ON "shifts"("vehicle_id", "month");

DROP TYPE "ShiftType";
