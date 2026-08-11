"use client";

import { useState } from "react";
import type { ExternalVehicleRow } from "@/lib/externalVehicle";

export function ExternalVehicleManager({
  vehicles,
  addAction,
  deleteAction,
}: {
  vehicles: ExternalVehicleRow[];
  addAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="font-heading font-bold text-[15px] text-heading text-left flex items-center justify-between"
      >
        <span>Бошқа кирим тўлайдиган машиналар ({vehicles.length})</span>
        <span className="text-muted-2 text-sm">{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded && (
        <>
          <form action={addAction} className="flex gap-1.5">
            <input
              name="plate"
              placeholder="Янги машина рақами (масалан: 40 O 370 LB)"
              required
              className="flex-1 min-w-0 bg-page border-2 border-border rounded-xl px-3.5 py-2.5 text-sm font-semibold text-heading outline-none focus:border-primary"
            />
            <button type="submit" className="bg-primary text-white rounded-xl px-4 font-extrabold text-sm whitespace-nowrap">
              + Қўшиш
            </button>
          </form>
          <div className="flex flex-col gap-1">
            {vehicles.map((v) => (
              <div key={v.id} className="flex items-center justify-between gap-2 bg-page rounded-lg px-3 py-2">
                <span className="text-sm font-bold text-heading">{v.plate}</span>
                <form action={deleteAction}>
                  <input type="hidden" name="id" value={v.id} />
                  <button type="submit" title="Ўчириш" className="text-muted-2 hover:text-danger font-extrabold text-base leading-none px-1">
                    ✕
                  </button>
                </form>
              </div>
            ))}
            {vehicles.length === 0 && <p className="text-xs text-muted-2 px-1">Ҳали йўқ</p>}
          </div>
        </>
      )}
    </div>
  );
}
