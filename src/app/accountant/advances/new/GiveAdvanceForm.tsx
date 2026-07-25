"use client";

import { useActionState } from "react";
import { giveAdvanceAction, type GiveAdvanceState } from "../actions";

const initialState: GiveAdvanceState = { error: "" };

type UserOption = { id: string; label: string };

export function GiveAdvanceForm({ users }: { users: UserOption[] }) {
  const [state, formAction, pending] = useActionState(giveAdvanceAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <div className="text-[13px] font-extrabold text-body mb-1.5">Xodim</div>
        <select
          name="userId"
          required
          className="w-full bg-card border-2 border-border rounded-xl px-4 py-2.5 text-sm font-bold text-heading outline-none focus:border-primary"
        >
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <div className="text-[13px] font-extrabold text-body mb-1.5">Summa</div>
        <input
          name="amount"
          type="number"
          required
          min={1}
          placeholder="500000"
          className="w-full bg-card border-2 border-success rounded-xl px-4 py-3 font-heading text-xl font-bold text-heading outline-none"
        />
      </div>
      {state.error && <p className="text-danger text-[13px] font-bold">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="bg-success text-white rounded-xl py-3 text-center font-extrabold text-[15px] disabled:opacity-60"
      >
        {pending ? "Saqlanmoqda…" : "Avans berish"}
      </button>
    </form>
  );
}
