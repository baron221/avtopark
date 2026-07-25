"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = { error: "" };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-[18px]">
      <div>
        <div className="text-[13px] font-extrabold text-body mb-1.5">Telefon raqam</div>
        <input
          name="phone"
          type="tel"
          required
          placeholder="+998 91 234 56 78"
          className="w-full bg-card border-2 border-primary rounded-xl px-4 py-3 text-base font-bold text-heading outline-none"
        />
      </div>
      <div>
        <div className="text-[13px] font-extrabold text-body mb-1.5">Parol</div>
        <input
          name="password"
          type="password"
          required
          placeholder="••••••••"
          className="w-full bg-card border-2 border-border rounded-xl px-4 py-3 text-base font-bold text-heading outline-none focus:border-primary"
        />
      </div>
      {state.error && <p className="text-danger text-[13px] font-bold text-center">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="bg-primary text-white rounded-xl py-[15px] text-center font-extrabold text-[15px] disabled:opacity-60"
      >
        {pending ? "Tekshirilmoqda…" : "Kirish"}
      </button>
      <p className="text-xs text-muted-2 font-semibold text-center">
        Rol tizim tomonidan aniqlanadi: egasi · dispetcher · haydovchi
      </p>
    </form>
  );
}
