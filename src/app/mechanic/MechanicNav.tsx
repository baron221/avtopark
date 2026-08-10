"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/mechanic/fuel", label: "Ёқилғи", icon: "◉", exact: true },
  { href: "/mechanic/vehicles", label: "Машиналар", icon: "▤", exact: false },
  { href: "/mechanic/gps", label: "GPS", icon: "◎", exact: false },
  { href: "/mechanic/fuel/payments", label: "Тўловлар", icon: "▥", exact: false },
  { href: "/mechanic/shifts", label: "Сменалар", icon: "▦", exact: false },
  { href: "/mechanic/profile", label: "Профил", icon: "◈", exact: false },
];

type NavItem = { href: string; label: string; icon: string };

function isActive(pathname: string, href: string, exact: boolean) {
  return exact ? pathname === href : pathname.startsWith(href);
}

export function MechanicNavDesktop({ extra = [], base = NAV }: { extra?: NavItem[]; base?: typeof NAV }) {
  const pathname = usePathname();
  const items = [...base, ...extra.map((e) => ({ ...e, exact: false }))];
  return (
    <nav className="flex gap-1.5 bg-primary-tint p-1 rounded-[10px]">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`px-4 py-1.5 rounded-lg text-[13px] font-bold ${
            isActive(pathname, item.href, item.exact) ? "bg-primary text-white" : "text-muted"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function MechanicNavMobile({ extra = [], base = NAV }: { extra?: NavItem[]; base?: typeof NAV }) {
  const pathname = usePathname();
  const items = [...base, ...extra.map((e) => ({ ...e, exact: false }))];
  return (
    <div className="lg:hidden fixed bottom-0 inset-x-0 z-10 bg-card border-t border-border">
      <div className="flex overflow-x-auto pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const active = isActive(pathname, item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-shrink-0 flex flex-col items-center gap-0.5 min-w-[60px] px-2 text-center text-[10px] font-extrabold whitespace-nowrap ${active ? "text-primary" : "text-muted-2"}`}
            >
              <div className="text-base leading-tight">{item.icon}</div>
              <div>{item.label}</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
