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

const DAILY_TIER_LOW = 800_000;
const DAILY_TIER_HIGH = 1_200_000;
const DAILY_PAY_LOW = 150_000;
const DAILY_PAY_MID = 200_000;
const DAILY_PAY_HIGH = 250_000;

/**
 * A driver's pay for one calendar day, based on that day's total trip
 * revenue — this is now their base salary (see driverPay.ts), not a flat
 * monthly rate. A day with no trips at all earns nothing.
 */
export function dailyDriverPay(dailyRevenue: number): number {
  if (dailyRevenue <= 0) return 0;
  if (dailyRevenue < DAILY_TIER_LOW) return DAILY_PAY_LOW;
  if (dailyRevenue <= DAILY_TIER_HIGH) return DAILY_PAY_MID;
  return DAILY_PAY_HIGH;
}
