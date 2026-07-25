"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/mechanic/fuel", label: "Yoqilg'i", icon: "◉", exact: true },
  { href: "/mechanic/vehicles", label: "Mashinalar", icon: "▤", exact: false },
  { href: "/mechanic/fuel/payments", label: "To'lovlar", icon: "▥", exact: false },
  { href: "/mechanic/profile", label: "Profil", icon: "◈", exact: false },
];

function isActive(pathname: string, href: string, exact: boolean) {
  return exact ? pathname === href : pathname.startsWith(href);
}

export function MechanicNavDesktop() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1.5 bg-primary-tint p-1 rounded-[10px]">
      {NAV.map((item) => (
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

export function MechanicNavMobile() {
  const pathname = usePathname();
  return (
    <div className="lg:hidden fixed bottom-0 inset-x-0 z-10 bg-card border-t border-border flex py-2 px-2">
      {NAV.map((item) => {
        const active = isActive(pathname, item.href, item.exact);
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
