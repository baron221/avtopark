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

export function AccountantNavDesktop({
  extra = [],
  base = NAV,
  reportBadgeCount = 0,
}: {
  extra?: NavItem[];
  base?: typeof NAV;
  /** Pending cash-handover confirmations — a lightweight in-app "notification" since there's no push/SMS infra for this. */
  reportBadgeCount?: number;
}) {
  const pathname = usePathname();
  const items = [...base, ...extra];
  return (
    <nav className="flex gap-1.5 bg-primary-tint p-1 rounded-[10px]">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`relative px-4 py-1.5 rounded-lg text-[13px] font-bold ${
            pathname.startsWith(item.href) ? "bg-primary text-white" : "text-muted"
          }`}
        >
          {item.label}
          {item.href === "/accountant/report" && reportBadgeCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-danger text-white text-[10px] font-extrabold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
              {reportBadgeCount > 9 ? "9+" : reportBadgeCount}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}

export function AccountantNavMobile({
  extra = [],
  base = NAV,
  reportBadgeCount = 0,
}: {
  extra?: NavItem[];
  base?: typeof NAV;
  reportBadgeCount?: number;
}) {
  const pathname = usePathname();
  const items = [...base, ...extra];
  return (
    <div className="lg:hidden fixed bottom-0 inset-x-0 z-10 bg-card border-t border-border">
      <div className="flex justify-between overflow-x-auto pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-shrink-0 flex flex-col items-center gap-0.5 min-w-[60px] px-2 text-center text-[10px] font-extrabold whitespace-nowrap ${active ? "text-primary" : "text-muted-2"}`}
            >
              <div className="relative inline-block">
                <div className="text-base leading-tight">{item.icon}</div>
                {item.href === "/accountant/report" && reportBadgeCount > 0 && (
                  <span className="absolute -top-1 -right-2 bg-danger text-white text-[9px] font-extrabold rounded-full min-w-[14px] h-3.5 px-1 flex items-center justify-center">
                    {reportBadgeCount > 9 ? "9+" : reportBadgeCount}
                  </span>
                )}
              </div>
              <div>{item.label}</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
