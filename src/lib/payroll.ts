export type PayrollInputs = {
  baseSalary: number | bigint;
  bonus: number | bigint;
  advancesTotal: number | bigint;
  finesTotal: number | bigint;
  lunchTotal: number | bigint;
};

/** net_pay = base_salary + bonus − advance − fines − lunch, matching the
 * formula shown on the payroll screen itself. */
export function computeNetPay({ baseSalary, bonus, advancesTotal, finesTotal, lunchTotal }: PayrollInputs): bigint {
  return BigInt(baseSalary) + BigInt(bonus) - BigInt(advancesTotal) - BigInt(finesTotal) - BigInt(lunchTotal);
}
