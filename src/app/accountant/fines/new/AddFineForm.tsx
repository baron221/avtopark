"use client";

import { useActionState } from "react";
import { addFineAction, type AddFineState } from "../actions";

const initialState: AddFineState = { error: "" };

type UserOption = { id: string; label: string };

export function AddFineForm({ users }: { users: UserOption[] }) {
  const [state, formAction, pending] = useActionState(addFineAction, initialState);

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
          placeholder="150000"
          className="w-full bg-card border-2 border-danger rounded-xl px-4 py-3 font-heading text-xl font-bold text-heading outline-none"
        />
      </div>
      <div>
        <div className="text-[13px] font-extrabold text-body mb-1.5">Sabab</div>
        <input
          name="reason"
          required
          placeholder="Kechikish, radar…"
          className="w-full bg-card border-2 border-border rounded-xl px-4 py-2.5 text-sm font-semibold text-heading outline-none focus:border-primary"
        />
      </div>
      {state.error && <p className="text-danger text-[13px] font-bold">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="bg-danger text-white rounded-xl py-3 text-center font-extrabold text-[15px] disabled:opacity-60"
      >
        {pending ? "Saqlanmoqda…" : "Jarima qo'shish"}
      </button>
    </form>
  );
}
