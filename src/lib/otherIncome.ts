import type { OtherIncomeCategory } from "@prisma/client";

export const OTHER_INCOME_CATEGORIES: OtherIncomeCategory[] = ["SOLIQ", "YOQILGI", "STOYANKA", "BOSHQA"];

export const OTHER_INCOME_CATEGORY_LABELS: Record<OtherIncomeCategory, string> = {
  SOLIQ: "Солиқ",
  YOQILGI: "Ёқилғи",
  STOYANKA: "Стоянка",
  BOSHQA: "Бошқа",
};
