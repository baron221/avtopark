export type PayrollInputs = {
  baseSalary: number | bigint;
  bonus: number | bigint;
  advancesTotal: number | bigint;
  finesTotal: number | bigint;
};

/** net_pay = base_salary + bonus − advance − fines, matching the formula
 * shown on the payroll screen itself. Lunch is a general company expense
 * now, not a per-employee payroll deduction — see dashboard.ts. */
export function computeNetPay({ baseSalary, bonus, advancesTotal, finesTotal }: PayrollInputs): bigint {
  return BigInt(baseSalary) + BigInt(bonus) - BigInt(advancesTotal) - BigInt(finesTotal);
}
