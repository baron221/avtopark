-- CreateTable
CREATE TABLE "external_vehicles" (
    "id" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "external_vehicles_plate_key" ON "external_vehicles"("plate");

-- AddForeignKey
ALTER TABLE "external_vehicles" ADD CONSTRAINT "external_vehicles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
