"use client";

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
  return (
    <form action={assignDriverAction} className="flex items-center gap-2">
      <input type="hidden" name="vehicleId" value={vehicleId} />
      <span className="text-sm font-semibold text-body">Haydovchi:</span>
      <select
        name="driverId"
        defaultValue={currentDriverId ?? ""}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
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
    </form>
  );
}
