-- Replace VehicleStatus's value set: add NOT_ON_LINE and ON_ORDER, drop the
-- unused SOLD (no vehicle currently has that status, verified before writing
-- this migration). Postgres has no ADD/DROP for a single enum value combined
-- in one ALTER TYPE, so the type is recreated and the column re-pointed at it.
ALTER TABLE "vehicles" ALTER COLUMN "status" DROP DEFAULT;
ALTER TYPE "VehicleStatus" RENAME TO "VehicleStatus_old";
CREATE TYPE "VehicleStatus" AS ENUM ('ACTIVE', 'NOT_ON_LINE', 'ON_ORDER', 'REPAIR', 'RENTED');
ALTER TABLE "vehicles" ALTER COLUMN "status" TYPE "VehicleStatus" USING ("status"::text::"VehicleStatus");
ALTER TABLE "vehicles" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
DROP TYPE "VehicleStatus_old";
