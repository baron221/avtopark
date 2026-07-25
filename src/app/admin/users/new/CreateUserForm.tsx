"use client";

import { useActionState, useState } from "react";
import { createUserAction, type CreateUserState } from "../actions";

const initialState: CreateUserState = { error: "" };

const ROLE_OPTIONS = [
  { value: "ADMIN", label: "Admin" },
  { value: "OWNER", label: "Egasi" },
  { value: "ACCOUNTANT", label: "Buxgalter" },
  { value: "DISPATCHER", label: "Dispetcher" },
  { value: "MECHANIC", label: "Mexanik" },
  { value: "DRIVER", label: "Haydovchi" },
];

const inputClass =
  "w-full bg-card border-2 border-border rounded-xl px-4 py-2.5 text-sm font-bold text-heading outline-none focus:border-primary";
const labelClass = "text-[13px] font-extrabold text-body mb-1.5";

export function CreateUserForm() {
  const [state, formAction, pending] = useActionState(createUserAction, initialState);
  const [role, setRole] = useState("DRIVER");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <div className={labelClass}>F.I.Sh.</div>
        <input name="fullName" required className={inputClass} placeholder="Olim Karimov" />
      </div>
      <div>
        <div className={labelClass}>Telefon raqam</div>
        <input name="phone" type="tel" required className={inputClass} placeholder="+998 91 234 56 78" />
      </div>
      <div>
        <div className={labelClass}>Boshlang&apos;ich parol</div>
        <input name="password" type="text" required minLength={6} className={inputClass} placeholder="kamida 6 belgi" />
      </div>
      <div>
        <div className={labelClass}>Rol</div>
        <select name="role" value={role} onChange={(e) => setRole(e.target.value)} className={inputClass}>
          {ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      {role === "DISPATCHER" && (
        <div>
          <div className={labelClass}>Punkt</div>
          <select name="point" className={inputClass} defaultValue="FARGONA">
            <option value="FARGONA">Farg&apos;ona</option>
            <option value="QUVA">Quva</option>
          </select>
        </div>
      )}

      {role === "DRIVER" && (
        <>
          <div>
            <div className={labelClass}>Guvohnoma raqami</div>
            <input name="licenseNo" className={inputClass} placeholder="FA1234" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className={labelClass}>Maosh turi</div>
              <select name="salaryType" className={inputClass} defaultValue="FIXED">
                <option value="FIXED">Belgilangan</option>
                <option value="PERCENT">Foiz</option>
                <option value="PLAN_SURPLUS">Plandan ortig&apos;i</option>
              </select>
            </div>
            <div>
              <div className={labelClass}>Maosh summasi</div>
              <input name="salaryValue" type="number" className={inputClass} placeholder="3000000" />
            </div>
          </div>
        </>
      )}

      {state.error && <p className="text-danger text-[13px] font-bold">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="bg-primary text-white rounded-xl py-3 text-center font-extrabold text-[15px] disabled:opacity-60"
      >
        {pending ? "Saqlanmoqda…" : "Foydalanuvchi qo'shish"}
      </button>
    </form>
  );
}
