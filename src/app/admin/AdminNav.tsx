"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/admin/panel", label: "Панел", icon: "◉" },
  { href: "/admin/users", label: "Ходимлар", icon: "◈" },
  { href: "/admin/shifts", label: "Сменалар", icon: "▤" },
  { href: "/admin/access", label: "Ҳуқуқлар", icon: "▨" },
  { href: "/admin/deletions", label: "Ўчирилганлар", icon: "▩" },
];

type NavItem = { href: string; label: string; icon: string };

export function AdminNavDesktop({ items = NAV }: { items?: NavItem[] }) {
  const pathname = usePathname();
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

export function AdminNavMobile({ items = NAV }: { items?: NavItem[] }) {
  const pathname = usePathname();
  return (
    <div className="lg:hidden fixed bottom-0 inset-x-0 z-10 bg-card border-t border-border">
      <div className="flex overflow-x-auto py-2 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
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
