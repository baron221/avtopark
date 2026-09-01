import type { OtherIncomeCategory } from "@prisma/client";

export const OTHER_INCOME_CATEGORIES: OtherIncomeCategory[] = [
  "OYLIK_TOLOV",
  "YOQILGI",
  "GPS",
  "LITSENZIYA",
  "SOLIQ",
  "STOYANKA",
  "BOSHQA",
];

export const OTHER_INCOME_CATEGORY_LABELS: Record<OtherIncomeCategory, string> = {
  OYLIK_TOLOV: "Ойлик тўлов",
  YOQILGI: "Ёқилғи",
  GPS: "ГПС",
  LITSENZIYA: "Литсензия",
  SOLIQ: "Солиқ",
  STOYANKA: "Стоянка",
  BOSHQA: "Бошқа",
};
