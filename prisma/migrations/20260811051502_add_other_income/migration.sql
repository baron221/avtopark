-- CreateEnum
CREATE TYPE "OtherIncomeCategory" AS ENUM ('SOLIQ', 'YOQILGI', 'STOYANKA', 'BOSHQA');

-- CreateTable
CREATE TABLE "other_incomes" (
    "id" TEXT NOT NULL,
    "point" "Point" NOT NULL,
    "category" "OtherIncomeCategory" NOT NULL DEFAULT 'BOSHQA',
    "amount" BIGINT NOT NULL,
    "note" TEXT NOT NULL,
    "income_date" TIMESTAMP(3) NOT NULL,
    "entered_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "other_incomes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "other_incomes_point_income_date_idx" ON "other_incomes"("point", "income_date");

-- AddForeignKey
ALTER TABLE "other_incomes" ADD CONSTRAINT "other_incomes_entered_by_fkey" FOREIGN KEY ("entered_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
