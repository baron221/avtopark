"use client";

import { updateVehicleStatusAction } from "./actions";

const OPTIONS = [
  { value: "ACTIVE", label: "Liniyada" },
  { value: "REPAIR", label: "Ta'mirda" },
  { value: "RENTED", label: "Ijarada" },
  { value: "SOLD", label: "Sotilgan" },
];

export function StatusSelect({ vehicleId, status }: { vehicleId: string; status: string }) {
  return (
    <form action={updateVehicleStatusAction}>
      <input type="hidden" name="vehicleId" value={vehicleId} />
      <select
        name="status"
        defaultValue={status}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="bg-card border-2 border-border rounded-lg px-3 py-1.5 text-[13px] font-extrabold text-heading outline-none focus:border-primary"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </form>
  );
}
