-- CreateTable
CREATE TABLE "deletion_logs" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "deleted_by" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deletion_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "deletion_logs_deleted_at_idx" ON "deletion_logs"("deleted_at");

-- CreateIndex
CREATE INDEX "deletion_logs_entity_type_entity_id_idx" ON "deletion_logs"("entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "deletion_logs" ADD CONSTRAINT "deletion_logs_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
