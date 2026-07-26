"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

// Calls the server action directly (instead of a plain <form action> the
// browser submits) and forces router.refresh() once it resolves. A plain
// form relies on Next.js to notice the mutated route and refetch it, but
// that can still hand back a stale client Router Cache entry if the page
// was reached via back/forward or a cached link — refresh() always goes
// back to the server.
export function ShiftSelect({
  name,
  defaultValue,
  vehicleId,
  month,
  action,
  className,
  children,
}: {
  name: string;
  defaultValue: string;
  vehicleId: string;
  month: string;
  action: (formData: FormData) => Promise<void> | void;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <select
      name={name}
      defaultValue={defaultValue}
      disabled={pending}
      className={className}
      onChange={(e) => {
        const formData = new FormData();
        formData.set("vehicleId", vehicleId);
        formData.set("month", month);
        formData.set(name, e.target.value);
        startTransition(async () => {
          await action(formData);
          router.refresh();
        });
      }}
    >
      {children}
    </select>
  );
}
