export type PayrollInputs = {
  baseSalary: number | bigint;
  bonus: number | bigint;
  finesTotal: number | bigint;
  lunchTotal: number | bigint;
};

/** net_pay = base_salary + bonus − fines − lunch (README formula). */
export function computeNetPay({ baseSalary, bonus, finesTotal, lunchTotal }: PayrollInputs): bigint {
  return BigInt(baseSalary) + BigInt(bonus) - BigInt(finesTotal) - BigInt(lunchTotal);
}
