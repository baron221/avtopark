"use client";

import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";

/**
 * Makes a whole row navigate to a detail page on click, while leaving the
 * bonus-edit/revert-to-draft forms nested inside it fully interactive — a
 * plain <Link> would need to wrap a <form>, which breaks their submit
 * buttons (a click on either bubbles up and would also trigger navigation).
 */
export function PayrollRowLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const router = useRouter();

  function handleClick(e: MouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("form, button, a, input")) return;
    router.push(href);
  }

  return (
    <div className={`${className ?? ""} cursor-pointer`} onClick={handleClick}>
      {children}
    </div>
  );
}
