import { describe, expect, it } from "vitest";
import { computeNetPay, dailyDriverPay } from "./payroll";

describe("computeNetPay", () => {
  it("computes base salary plus bonus minus deductions", () => {
    const net = computeNetPay({
      baseSalary: 3_200_000,
      bonus: 200_000,
      advancesTotal: 0,
      finesTotal: 150_000,
    });
    expect(net).toBe(BigInt(3_250_000));
  });

  it("subtracts an advance already paid out this month", () => {
    const net = computeNetPay({
      baseSalary: 3_200_000,
      bonus: 0,
      advancesTotal: 500_000,
      finesTotal: 0,
    });
    expect(net).toBe(BigInt(2_700_000));
  });

  it("returns zero when everything is zero", () => {
    expect(computeNetPay({ baseSalary: 0, bonus: 0, advancesTotal: 0, finesTotal: 0 })).toBe(BigInt(0));
  });

  it("can go negative when deductions exceed salary", () => {
    const net = computeNetPay({ baseSalary: 100_000, bonus: 0, advancesTotal: 0, finesTotal: 500_000 });
    expect(net).toBe(BigInt(-400_000));
  });

  it("accepts a mix of number and bigint inputs", () => {
    const net = computeNetPay({
      baseSalary: BigInt(2_500_000),
      bonus: 0,
      advancesTotal: BigInt(0),
      finesTotal: BigInt(0),
    });
    expect(net).toBe(BigInt(2_500_000));
  });
});

describe("dailyDriverPay", () => {
  it("pays nothing for a day with no trip revenue", () => {
    expect(dailyDriverPay(0)).toBe(0);
  });

  it("pays the low tier just under 800,000", () => {
    expect(dailyDriverPay(799_999)).toBe(150_000);
  });

  it("pays the mid tier starting exactly at 800,000", () => {
    expect(dailyDriverPay(800_000)).toBe(200_000);
  });

  it("pays the mid tier up to and including 1,200,000", () => {
    expect(dailyDriverPay(1_200_000)).toBe(200_000);
  });

  it("pays the high tier just over 1,200,000", () => {
    expect(dailyDriverPay(1_200_001)).toBe(250_000);
  });

  it("pays the high tier for a very good day", () => {
    expect(dailyDriverPay(5_000_000)).toBe(250_000);
  });
});
