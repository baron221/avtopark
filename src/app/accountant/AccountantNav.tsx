"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/accountant/report", label: "Ҳисобот", icon: "▨" },
  { href: "/accountant/payroll", label: "Ведомост", icon: "▤" },
  { href: "/accountant/advances", label: "Аванслар", icon: "◈" },
  { href: "/accountant/fines", label: "Жарималар", icon: "▥" },
  { href: "/accountant/expenses", label: "Расходлар", icon: "◉" },
];

type NavItem = { href: string; label: string; icon: string };

export function AccountantNavDesktop({ extra = [], base = NAV }: { extra?: NavItem[]; base?: typeof NAV }) {
  const pathname = usePathname();
  const items = [...base, ...extra];
  return (
    <nav className="flex gap-1.5 bg-primary-tint p-1 rounded-[10px]">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`px-4 py-1.5 rounded-lg text-[13px] font-bold ${
            pathname.startsWith(item.href) ? "bg-primary text-white" : "text-muted"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function AccountantNavMobile({ extra = [], base = NAV }: { extra?: NavItem[]; base?: typeof NAV }) {
  const pathname = usePathname();
  const items = [...base, ...extra];
  return (
    <div className="lg:hidden fixed bottom-0 inset-x-0 z-10 bg-card border-t border-border flex py-2 px-2">
      {items.map((item) => {
        const active = pathname.startsWith(item.href);
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
