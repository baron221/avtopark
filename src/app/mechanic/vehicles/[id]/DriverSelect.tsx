"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { assignDriverAction } from "./actions";

type DriverOption = { id: string; name: string; currentPlate: string | null };

export function DriverSelect({
  vehicleId,
  currentDriverId,
  drivers,
}: {
  vehicleId: string;
  currentDriverId: string | null;
  drivers: DriverOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-semibold text-body">Haydovchi:</span>
      <select
        name="driverId"
        defaultValue={currentDriverId ?? ""}
        disabled={pending}
        onChange={(e) => {
          const formData = new FormData();
          formData.set("vehicleId", vehicleId);
          formData.set("driverId", e.target.value);
          // Calling the server action directly and forcing router.refresh()
          // guarantees this page re-fetches from the server, rather than
          // relying on Next.js to notice the mutation and refresh a plain
          // <form> submission — which can still show a stale client Router
          // Cache snapshot if this page was reached via back/forward nav.
          startTransition(async () => {
            await assignDriverAction(formData);
            router.refresh();
          });
        }}
        className="bg-card border-2 border-border rounded-lg px-3 py-1.5 text-[13px] font-extrabold text-heading outline-none focus:border-primary"
      >
        <option value="">— tayinlanmagan —</option>
        {drivers.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
            {d.currentPlate && d.id !== currentDriverId ? ` (hozir: ${d.currentPlate})` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
