/*
  Warnings:

  - You are about to drop the `plan_handovers` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "plan_handovers" DROP CONSTRAINT "plan_handovers_confirmed_by_fkey";

-- DropForeignKey
ALTER TABLE "plan_handovers" DROP CONSTRAINT "plan_handovers_driver_id_fkey";

-- DropForeignKey
ALTER TABLE "plan_handovers" DROP CONSTRAINT "plan_handovers_reported_by_fkey";

-- DropForeignKey
ALTER TABLE "plan_handovers" DROP CONSTRAINT "plan_handovers_vehicle_id_fkey";

-- DropTable
DROP TABLE "plan_handovers";
