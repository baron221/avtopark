"use client";

import { useActionState, useState } from "react";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { createUserAction, type CreateUserState } from "../actions";

const initialState: CreateUserState = { error: "" };

const ROLE_OPTIONS = [
  { value: "ADMIN", label: "Админ" },
  { value: "OWNER", label: "Эгаси" },
  { value: "ACCOUNTANT", label: "Бухгалтер" },
  { value: "DISPATCHER", label: "Диспетчер" },
  { value: "MECHANIC", label: "Механик" },
  { value: "DRIVER", label: "Ҳайдовчи" },
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
        <div className={labelClass}>Ф.И.Ш.</div>
        <input name="fullName" required className={inputClass} placeholder="Олим Каримов" />
      </div>
      <div>
        <div className={labelClass}>Телефон рақам</div>
        <input name="phone" type="tel" required className={inputClass} placeholder="+998 91 234 56 78" />
      </div>
      <div>
        <div className={labelClass}>Бошланғич парол</div>
        <input name="password" type="text" required minLength={6} className={inputClass} placeholder="камида 6 белги" />
      </div>
      <div>
        <div className={labelClass}>Рол</div>
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
          <div className={labelClass}>Пункт</div>
          <select name="point" className={inputClass} defaultValue="FARGONA">
            <option value="FARGONA">Фарғона</option>
            <option value="QUVA">Қува</option>
          </select>
        </div>
      )}

      {role === "DRIVER" && (
        <>
          <div>
            <div className={labelClass}>Гувоҳнома рақами</div>
            <input name="licenseNo" className={inputClass} placeholder="FA1234" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className={labelClass}>Маош тури</div>
              <select name="salaryType" className={inputClass} defaultValue="FIXED">
                <option value="FIXED">Белгиланган</option>
                <option value="PERCENT">Фоиз</option>
                <option value="PLAN_SURPLUS">Пландан ортиғи</option>
              </select>
            </div>
            <div>
              <div className={labelClass}>Маош суммаси</div>
              <MoneyInput name="salaryValue" className={inputClass} placeholder="3 000 000" />
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
        {pending ? "Сақланмоқда…" : "Фойдаланувчи қўшиш"}
      </button>
    </form>
  );
}
