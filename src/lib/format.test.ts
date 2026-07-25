import { describe, expect, it } from "vitest";
import { formatSom, formatMillions, uzMonthName, uzWeekdayShort } from "./format";

describe("formatSom", () => {
  it("groups thousands with thin spaces", () => {
    expect(formatSom(260000)).toBe("260 000");
    expect(formatSom(1000000)).toBe("1 000 000");
  });

  it("handles small numbers without grouping", () => {
    expect(formatSom(500)).toBe("500");
    expect(formatSom(0)).toBe("0");
  });

  it("handles negative numbers", () => {
    expect(formatSom(-15000)).toBe("-15 000");
  });

  it("accepts bigint", () => {
    expect(formatSom(BigInt(4000000))).toBe("4 000 000");
  });

  it("rounds fractional numbers", () => {
    expect(formatSom(1000.6)).toBe("1 001");
  });
});

describe("formatMillions", () => {
  it("formats with comma decimal separator", () => {
    expect(formatMillions(84_600_000)).toBe("84,6 mln");
  });

  it("optionally appends so'm suffix", () => {
    expect(formatMillions(1_000_000, true)).toBe("1,0 mln so'm");
  });

  it("handles zero", () => {
    expect(formatMillions(0)).toBe("0,0 mln");
  });

  it("handles negative amounts", () => {
    expect(formatMillions(-2_100_000)).toBe("-2,1 mln");
  });
});

describe("uzMonthName", () => {
  it("returns the Uzbek month name", () => {
    expect(uzMonthName(new Date(2026, 6, 24))).toBe("Iyul");
    expect(uzMonthName(new Date(2026, 0, 1))).toBe("Yanvar");
    expect(uzMonthName(new Date(2026, 11, 1))).toBe("Dekabr");
  });
});

describe("uzWeekdayShort", () => {
  it("returns a short weekday label for every day", () => {
    for (let d = 0; d < 7; d++) {
      const label = uzWeekdayShort(new Date(2026, 6, 19 + d));
      expect(label.length).toBeGreaterThan(0);
    }
  });
});
