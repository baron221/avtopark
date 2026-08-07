"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const OWNER_NAV = [
  { href: "/owner", label: "Фойда панели", icon: "◉" },
  { href: "/owner/report", label: "Ҳисобот", icon: "▨" },
  { href: "/owner/drivers", label: "Ҳайдовчилар", icon: "◈" },
  { href: "/owner/gps", label: "GPS", icon: "▤" },
];

type NavItem = { href: string; label: string; icon: string };

function isActive(pathname: string, href: string) {
  return href === "/owner" ? pathname === "/owner" : pathname.startsWith(href);
}

export function OwnerNavDesktop({ items = OWNER_NAV }: { items?: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1.5 bg-primary-tint p-1 rounded-[10px]">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`px-4 py-1.5 rounded-lg text-[13px] font-bold ${
            isActive(pathname, item.href) ? "bg-primary text-white" : "text-muted"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function OwnerNavMobile({ items = OWNER_NAV }: { items?: NavItem[] }) {
  const pathname = usePathname();
  return (
    <div className="lg:hidden fixed bottom-0 inset-x-0 z-10 bg-card border-t border-border flex py-2 px-2">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 text-center text-[11px] font-extrabold ${active ? "text-primary" : "text-muted-2"}`}
          >
            <div className="text-base leading-tight">{item.icon}</div>
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
