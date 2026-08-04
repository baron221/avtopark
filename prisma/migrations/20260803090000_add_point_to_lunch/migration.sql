-- AlterTable
ALTER TABLE "lunches" ADD COLUMN "point" "Point";

-- Backfill: every historical lunch was self-entered by the dispatcher it
-- belongs to, whose own point matches the point it should now be scoped to.
UPDATE "lunches" l SET "point" = u."point" FROM "users" u WHERE u."id" = l."user_id";
UPDATE "lunches" SET "point" = 'FARGONA' WHERE "point" IS NULL;

-- AlterTable
ALTER TABLE "lunches" ALTER COLUMN "point" SET NOT NULL;

-- CreateIndex
CREATE INDEX "lunches_point_lunch_date_idx" ON "lunches"("point", "lunch_date");
