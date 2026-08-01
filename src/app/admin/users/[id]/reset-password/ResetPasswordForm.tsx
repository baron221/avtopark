"use client";

import { useActionState } from "react";
import { resetPasswordAction, type ResetPasswordState } from "../../actions";

const initialState: ResetPasswordState = { error: "", success: false };

export function ResetPasswordForm({ userId }: { userId: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="userId" value={userId} />
      <div>
        <div className="text-[13px] font-extrabold text-body mb-1.5">Янги парол</div>
        <input
          name="password"
          type="text"
          required
          minLength={6}
          className="w-full bg-card border-2 border-border rounded-xl px-4 py-2.5 text-sm font-bold text-heading outline-none focus:border-primary"
          placeholder="камида 6 белги"
        />
      </div>
      {state.error && <p className="text-danger text-[13px] font-bold">{state.error}</p>}
      {state.success && <p className="text-success text-[13px] font-bold">Парол муваффақиятли янгиланди.</p>}
      <button
        type="submit"
        disabled={pending}
        className="bg-primary text-white rounded-xl py-3 text-center font-extrabold text-[15px] disabled:opacity-60"
      >
        {pending ? "Сақланмоқда…" : "Паролни янгилаш"}
      </button>
    </form>
  );
}
