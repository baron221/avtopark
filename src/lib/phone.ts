/**
 * Strips whitespace so a phone number matches regardless of how a human
 * happened to type it — the login form's own placeholder ("+998 91 234 56
 * 78") invites spaces, but a stored value entered without them would never
 * match an exact-equality lookup otherwise. Applied both where phone
 * numbers are stored and where they're looked up, so the two always agree.
 */
export function normalizePhone(raw: string): string {
  return raw.replace(/\s+/g, "");
}
