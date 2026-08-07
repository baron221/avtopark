"use client";

import { MoneyInput } from "@/components/ui/MoneyInput";
import { addOilChangeAction } from "./actions";

const numberInputClass =
  "flex-1 bg-page border-2 border-border rounded-xl px-3.5 py-2.5 text-sm font-bold text-heading outline-none focus:border-primary";

export function OilChangeForm({
  vehicleId,
  lastOdometerKm,
  estimatedOdometerKm,
}: {
  vehicleId: string;
  lastOdometerKm: number | null;
  estimatedOdometerKm?: number | null;
}) {
  return (
    <form action={addOilChangeAction} className="flex flex-col gap-3">
      <input type="hidden" name="vehicleId" value={vehicleId} />
      <div className="flex gap-2">
        <div className="flex-1">
          <div className="text-xs font-extrabold text-muted-2 mb-1">
            Жорий пробег (км){estimatedOdometerKm != null && " · GPS тахмини"}
          </div>
          <input
            name="odometerKm"
            type="number"
            required
            min={lastOdometerKm ?? 0}
            defaultValue={estimatedOdometerKm ?? undefined}
            placeholder="120000"
            className={numberInputClass}
          />
        </div>
        <div className="flex-1">
          <div className="text-xs font-extrabold text-muted-2 mb-1">Сумма</div>
          <MoneyInput
            name="amount"
            required
            placeholder="150 000"
            className="w-full bg-page border-2 border-primary rounded-xl px-3.5 py-2.5 font-heading text-sm font-bold text-heading outline-none"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <div className="text-xs font-extrabold text-muted-2 mb-1">Кейинги муддат (км)</div>
          <input name="intervalKm" type="number" required defaultValue={10000} className={numberInputClass} />
        </div>
        <div className="flex-1">
          <div className="text-xs font-extrabold text-muted-2 mb-1">Кейинги муддат (ой)</div>
          <input name="intervalMonths" type="number" required defaultValue={3} className={numberInputClass} />
        </div>
      </div>
      <input
        name="note"
        placeholder="Изоҳ (ихтиёрий)"
        className="bg-page border-2 border-border rounded-xl px-3.5 py-2.5 text-sm font-semibold text-heading outline-none focus:border-primary"
      />
      <button type="submit" className="bg-primary-tint text-primary rounded-xl py-2.5 font-extrabold text-sm">
        + Мой алмаштирилди
      </button>
    </form>
  );
}
