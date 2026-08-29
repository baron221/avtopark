-- CreateTable
CREATE TABLE "edit_logs" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "edited_by" TEXT NOT NULL,
    "edited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "edit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "edit_logs_edited_at_idx" ON "edit_logs"("edited_at");

-- CreateIndex
CREATE INDEX "edit_logs_entity_type_entity_id_idx" ON "edit_logs"("entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "edit_logs" ADD CONSTRAINT "edit_logs_edited_by_fkey" FOREIGN KEY ("edited_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
