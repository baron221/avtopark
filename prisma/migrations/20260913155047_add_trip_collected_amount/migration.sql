-- AlterTable
-- Backfilled from revenue (nullable first, then locked NOT NULL) so every
-- existing Trip row keeps meaning "fully collected" — matching its actual
-- past behavior — with no separate data-migration step needed.
ALTER TABLE "trips" ADD COLUMN "collected_amount" BIGINT;
UPDATE "trips" SET "collected_amount" = "revenue";
ALTER TABLE "trips" ALTER COLUMN "collected_amount" SET NOT NULL;

ALTER TABLE "trips" ADD COLUMN "debt_settled_at" TIMESTAMP(3);
ALTER TABLE "trips" ADD COLUMN "debt_settled_by" TEXT;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_debt_settled_by_fkey" FOREIGN KEY ("debt_settled_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
