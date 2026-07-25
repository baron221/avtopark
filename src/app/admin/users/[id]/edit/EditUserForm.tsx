"use client";

import { useActionState } from "react";
import { updateUserAction, type UpdateUserState } from "../../actions";
import { RoleBadge } from "@/components/ui/RoleBadge";
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
        <div className={labelClass}>Rol</div>
        <RoleBadge role={role} point={point} />
      </div>

      <div>
        <div className={labelClass}>F.I.Sh.</div>
        <input name="fullName" required defaultValue={fullName} className={inputClass} />
      </div>
      <div>
        <div className={labelClass}>Telefon raqam</div>
        <input name="phone" type="tel" required defaultValue={phone} className={inputClass} />
      </div>
      <div>
        <div className={labelClass}>Oylik maosh (bazaviy)</div>
        <input name="baseSalary" type="number" defaultValue={baseSalary ?? ""} className={inputClass} placeholder="3000000" />
      </div>

      {role === "DISPATCHER" && (
        <div>
          <div className={labelClass}>Punkt</div>
          <select name="point" className={inputClass} defaultValue={point ?? "FARGONA"}>
            <option value="FARGONA">Farg&apos;ona</option>
            <option value="QUVA">Quva</option>
          </select>
        </div>
      )}

      {role === "DRIVER" && driver && (
        <>
          <div>
            <div className={labelClass}>Guvohnoma raqami</div>
            <input name="licenseNo" defaultValue={driver.licenseNo} className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className={labelClass}>Maosh turi</div>
              <select name="salaryType" className={inputClass} defaultValue={driver.salaryType}>
                <option value="FIXED">Belgilangan</option>
                <option value="PERCENT">Foiz</option>
                <option value="PLAN_SURPLUS">Plandan ortig&apos;i</option>
              </select>
            </div>
            <div>
              <div className={labelClass}>Maosh summasi</div>
              <input name="salaryValue" type="number" defaultValue={driver.salaryValue} className={inputClass} />
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
        {pending ? "Saqlanmoqda…" : "Saqlash"}
      </button>
    </form>
  );
}
