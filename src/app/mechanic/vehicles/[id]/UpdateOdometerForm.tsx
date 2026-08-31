"use client";

import { useState } from "react";
import { updateOdometerAction } from "./actions";

export function UpdateOdometerForm({ vehicleId, currentKm }: { vehicleId: string; currentKm: number | null }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[11px] font-extrabold text-primary self-start"
      >
        Мой алмаштирмасдан, фақат километражни тўғрилаш
      </button>
    );
  }

  return (
    <form
      action={updateOdometerAction}
      onSubmit={() => setOpen(false)}
      className="flex gap-2 items-end bg-page rounded-xl p-3"
    >
      <input type="hidden" name="vehicleId" value={vehicleId} />
      <div className="flex-1">
        <div className="text-xs font-extrabold text-muted-2 mb-1">Ҳозирги умумий километраж</div>
        <input
          name="odometerKm"
          type="number"
          required
          min={1}
          defaultValue={currentKm ?? undefined}
          placeholder="120000"
          className="w-full bg-surface border-2 border-border rounded-xl px-3.5 py-2.5 text-sm font-bold text-heading outline-none focus:border-primary"
        />
      </div>
      <button type="submit" className="bg-primary-tint text-primary rounded-xl px-4 py-2.5 font-extrabold text-sm">
        Сақлаш
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-xs font-extrabold text-muted-2 px-2 py-2.5"
      >
        Бекор
      </button>
    </form>
  );
}
