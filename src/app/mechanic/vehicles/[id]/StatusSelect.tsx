"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { updateVehicleStatusAction } from "./actions";

const OPTIONS = [
  { value: "ACTIVE", label: "Liniyada" },
  { value: "REPAIR", label: "Ta'mirda" },
  { value: "RENTED", label: "Ijarada" },
  { value: "SOLD", label: "Sotilgan" },
];

export function StatusSelect({ vehicleId, status }: { vehicleId: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <select
      name="status"
      defaultValue={status}
      disabled={pending}
      onChange={(e) => {
        const formData = new FormData();
        formData.set("vehicleId", vehicleId);
        formData.set("status", e.target.value);
        startTransition(async () => {
          await updateVehicleStatusAction(formData);
          router.refresh();
        });
      }}
      className="bg-card border-2 border-border rounded-lg px-3 py-1.5 text-[13px] font-extrabold text-heading outline-none focus:border-primary"
    >
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
