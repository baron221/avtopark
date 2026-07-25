"use client";

import { useState } from "react";
import { addFuelLogAction } from "./actions";

type VehicleOption = { id: string; plate: string; driverName: string };
type StationOption = { id: string; name: string; unitPrice: number; fuelType: string };

export function FuelLogForm({ vehicles, stations }: { vehicles: VehicleOption[]; stations: StationOption[] }) {
  const [stationId, setStationId] = useState(stations[0]?.id ?? "");
  const [volume, setVolume] = useState(100);

  const station = stations.find((s) => s.id === stationId);
  const suggestedAmount = station ? Math.round(volume * station.unitPrice) : 0;

  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3">
      <div className="font-heading font-bold text-[15px] text-heading">+ Quyish yozuvi</div>
      <form action={addFuelLogAction} className="flex flex-col gap-3">
        <select
          name="vehicleId"
          required
          className="bg-page border-2 border-border rounded-xl px-3.5 py-2.5 font-bold text-sm text-heading outline-none focus:border-primary"
        >
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.plate} · {v.driverName}
            </option>
          ))}
        </select>
        <select
          name="stationId"
          value={stationId}
          onChange={(e) => setStationId(e.target.value)}
          className="bg-page border-2 border-border rounded-xl px-3.5 py-2.5 font-bold text-sm text-heading outline-none focus:border-primary"
        >
          {stations.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {s.fuelType}
            </option>
          ))}
        </select>
        <input
          name="volume"
          type="number"
          min={1}
          step="0.1"
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value) || 0)}
          className="bg-page border-2 border-border rounded-xl px-3.5 py-2.5 font-bold text-sm text-heading outline-none focus:border-primary"
          placeholder="Hajm (m³ yoki L)"
        />
        <input
          name="amount"
          type="number"
          min={1}
          defaultValue={suggestedAmount}
          key={suggestedAmount}
          className="bg-page border-2 border-primary rounded-xl px-3.5 py-3 font-heading text-xl font-bold text-heading outline-none"
        />
        <button type="submit" className="bg-primary text-white rounded-xl py-3 font-extrabold text-sm">
          Saqlash ✓
        </button>
      </form>
    </div>
  );
}
