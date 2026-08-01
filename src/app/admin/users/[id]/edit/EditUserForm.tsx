"use client";

import { useActionState } from "react";
import { updateUserAction, type UpdateUserState } from "../../actions";
import { RoleBadge } from "@/components/ui/RoleBadge";
import { MoneyInput } from "@/components/ui/MoneyInput";
import type { Point, Role, SalaryType } from "@prisma/client";

const initialState: UpdateUserState = { error: "" };

const inputClass =
  "w-full bg-card border-2 border-border rounded-xl px-4 py-2.5 text-sm font-bold text-heading outline-none focus:border-primary";
const labelClass = "text-[13px] font-extrabold text-body mb-1.5";

type Props = {
  userId: string;
  fullName: string;
  phone: string;
  role: Role;
  point: Point | null;
  baseSalary: number | null;
  driver?: { licenseNo: string; salaryType: SalaryType; salaryValue: number } | null;
};

export function EditUserForm({ userId, fullName, phone, role, point, baseSalary, driver }: Props) {
  const [state, formAction, pending] = useActionState(updateUserAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="userId" value={userId} />

      <div>
        <div className={labelClass}>Рол</div>
        <RoleBadge role={role} point={point} />
      </div>

      <div>
        <div className={labelClass}>Ф.И.Ш.</div>
        <input name="fullName" required defaultValue={fullName} className={inputClass} />
      </div>
      <div>
        <div className={labelClass}>Телефон рақам</div>
        <input name="phone" type="tel" required defaultValue={phone} className={inputClass} />
      </div>
      <div>
        <div className={labelClass}>Ойлик маош (базавий)</div>
        <MoneyInput name="baseSalary" defaultValue={baseSalary ?? ""} className={inputClass} placeholder="3 000 000" />
      </div>

      {role === "DISPATCHER" && (
        <div>
          <div className={labelClass}>Пункт</div>
          <select name="point" className={inputClass} defaultValue={point ?? "FARGONA"}>
            <option value="FARGONA">Фарғона</option>
            <option value="QUVA">Қува</option>
          </select>
        </div>
      )}

      {role === "DRIVER" && driver && (
        <>
          <div>
            <div className={labelClass}>Гувоҳнома рақами</div>
            <input name="licenseNo" defaultValue={driver.licenseNo} className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className={labelClass}>Маош тури</div>
              <select name="salaryType" className={inputClass} defaultValue={driver.salaryType}>
                <option value="FIXED">Белгиланган</option>
                <option value="PERCENT">Фоиз</option>
                <option value="PLAN_SURPLUS">Пландан ортиғи</option>
              </select>
            </div>
            <div>
              <div className={labelClass}>Маош суммаси</div>
              <MoneyInput name="salaryValue" defaultValue={driver.salaryValue} className={inputClass} />
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
        {pending ? "Сақланмоқда…" : "Сақлаш"}
      </button>
    </form>
  );
}
