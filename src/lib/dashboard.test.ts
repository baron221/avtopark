import { describe, expect, it } from "vitest";
import { daysInMonth, overlapDays, rangeForPeriod } from "./dashboard";

describe("daysInMonth", () => {
  it("returns 31 for July", () => {
    expect(daysInMonth(2026, 6)).toBe(31);
  });

  it("returns 28 for a non-leap February", () => {
    expect(daysInMonth(2026, 1)).toBe(28);
  });

  it("returns 29 for a leap February", () => {
    expect(daysInMonth(2028, 1)).toBe(29);
  });
});

describe("overlapDays", () => {
  const rangeFrom = new Date(2026, 6, 1, 0, 0, 0, 0);
  const rangeTo = new Date(2026, 6, 31, 23, 59, 59, 999);

  it("returns the full range length when the rental spans it entirely", () => {
    expect(overlapDays(rangeFrom, rangeTo, new Date(2026, 5, 1), null)).toBe(31);
  });

  it("counts only the overlapping days when the rental starts mid-range", () => {
    // Starts July 20th, still ongoing (no end date) -> 12 days left in July (20..31 inclusive)
    expect(overlapDays(rangeFrom, rangeTo, new Date(2026, 6, 20), null)).toBe(12);
  });

  it("counts only the overlapping days when the rental ends mid-range", () => {
    // Active for the first 10 days of July only
    expect(overlapDays(rangeFrom, rangeTo, new Date(2026, 5, 1), new Date(2026, 6, 10))).toBe(10);
  });

  it("returns 0 when the rental ended before the range starts", () => {
    expect(overlapDays(rangeFrom, rangeTo, new Date(2026, 4, 1), new Date(2026, 4, 15))).toBe(0);
  });

  it("returns 0 when the rental starts after the range ends", () => {
    expect(overlapDays(rangeFrom, rangeTo, new Date(2026, 7, 5), null)).toBe(0);
  });
});

describe("rangeForPeriod", () => {
  const now = new Date(2026, 6, 24, 15, 30, 0);

  it("DAY covers only today", () => {
    const { from, to } = rangeForPeriod("DAY", now);
    expect(from.getDate()).toBe(24);
    expect(to.getDate()).toBe(24);
    expect(from.getHours()).toBe(0);
    expect(to.getHours()).toBe(23);
  });

  it("WEEK covers the last 7 calendar days including today", () => {
    const { from, to } = rangeForPeriod("WEEK", now);
    expect(from.getDate()).toBe(18);
    expect(to.getDate()).toBe(24);
    expect(to.getDate() - from.getDate() + 1).toBe(7);
  });

  it("MONTH covers from the 1st of the month through today", () => {
    const { from, to } = rangeForPeriod("MONTH", now);
    expect(from.getDate()).toBe(1);
    expect(from.getMonth()).toBe(6);
    expect(to.getDate()).toBe(24);
  });
});
