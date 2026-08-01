/**
 * UTC-pinned month boundaries. `new Date(y, m, 1)` ties the resulting instant
 * to whichever timezone the running process happens to be in — the same
 * calendar month computed this way on a local dev machine (e.g.
 * Asia/Tashkent, UTC+5) is a genuinely different instant than on a UTC
 * server (Vercel's default Node runtime), which breaks exact-match lookups
 * like Salary/Advance's `@@unique([userId, month])` — see driverAssignment.ts's
 * currentMonthDate() for the same fix applied earlier to Shift.
 */
export function monthStart(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), 1));
}

export function monthEnd(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999));
}
