import { describe, expect, it } from "vitest";
import { monthStart, monthEnd } from "./month";

describe("monthStart/monthEnd", () => {
  it("returns UTC midnight on the 1st regardless of the input's local time", () => {
    const d = new Date("2026-08-15T18:30:00+05:00");
    expect(monthStart(d).toISOString()).toBe("2026-08-01T00:00:00.000Z");
  });

  it("returns the last instant of the month in UTC", () => {
    const d = new Date("2026-08-15T18:30:00+05:00");
    expect(monthEnd(d).toISOString()).toBe("2026-08-31T23:59:59.999Z");
  });

  it("handles February in a leap year", () => {
    const d = new Date("2028-02-10T00:00:00Z");
    expect(monthEnd(d).toISOString()).toBe("2028-02-29T23:59:59.999Z");
  });

  it("produces the same instant for any two times safely inside the same month", () => {
    const early = monthStart(new Date("2026-03-02T10:00:00Z"));
    const late = monthStart(new Date("2026-03-29T10:00:00Z"));
    expect(early.getTime()).toBe(late.getTime());
    expect(early.toISOString()).toBe("2026-03-01T00:00:00.000Z");
  });
});
