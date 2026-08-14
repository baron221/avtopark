"use client";

import { useRouter } from "next/navigation";

export function GpsVehicleSelect({
  basePath,
  dateStr,
  value,
  vehicles,
}: {
  basePath: string;
  dateStr: string;
  value: string;
  vehicles: { id: string; plate: string; driverName: string | null }[];
}) {
  const router = useRouter();

  return (
    <select
      defaultValue={value}
      onChange={(e) => router.push(`${basePath}?vehicleId=${e.target.value}&date=${dateStr}`, { scroll: false })}
      className="bg-page border border-border rounded-lg px-3 py-1.5 text-[13px] font-bold text-heading outline-none focus:border-primary min-w-0"
    >
      {vehicles.map((v) => (
        <option key={v.id} value={v.id}>
          {v.plate} {v.driverName ? `· ${v.driverName}` : ""}
        </option>
      ))}
    </select>
  );
}
