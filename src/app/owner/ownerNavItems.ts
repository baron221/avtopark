// Plain data, deliberately kept out of OwnerNav.tsx ("use client") — a
// Server Component (layout.tsx) importing a non-component export from a
// client module crashes at runtime, so both sides import it from here instead.
export const OWNER_NAV = [
  { href: "/owner", label: "Фойда панели", icon: "◉" },
  { href: "/owner/report", label: "Ҳисобот", icon: "▨" },
  { href: "/owner/drivers", label: "Ҳайдовчилар", icon: "◈" },
  { href: "/owner/gps", label: "GPS", icon: "▤" },
];
