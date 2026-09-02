"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logDeletion } from "@/lib/deletionLog";
import { OTHER_INCOME_CATEGORIES, OTHER_INCOME_CATEGORY_LABELS } from "@/lib/otherIncome";
import type { OtherIncomePoint, OtherIncomeCategory } from "@prisma/client";

export type AddOtherIncomeState = { error: string };

/** Accountant's own entry point for OtherIncome — separate from the
 * dispatcher's (see dispatcher/actions.ts's own addOtherIncomeAction),
 * since this isn't tied to a dispatcher's point-of-the-day the way trip
 * revenue is: an accountant can record any point's income directly. Same
 * OtherIncome table either way, so both feed the same reports.
 *
 * Invoked from IncomeEntryCard on /accountant/report, not a standalone
 * /accountant/income/new route (which is how this started) — that
 * standalone route reproducibly cleared the accountant's own session on
 * submit, both locally and in production, even as a plain <form
 * action={...}> with no client JS and no redirect()/revalidatePath in the
 * action at all. Root cause unconfirmed after extensive isolation (ruled
 * out useActionState, the proxy middleware, and AccountantLayout's own
 * redirect calls) — the same action invoked from /accountant/report never
 * reproduced it, so entry lives there instead until the underlying
 * Next.js/next-auth interaction is understood.
 *
 * Accountant-role only, not hasModuleAccess("PAYROLL") guests — matches
 * dispatcher/journal's own entry forms, which route around a related
 * issue the same way (gated to isDispatcher, not just any granted guest).
 *
 * Deliberately does NOT call redirect() — plain-async-action-plus-
 * client-side-refresh, same as dispatcher/journal's own IncomeForm. */
export async function addOtherIncomeAction(formData: FormData): Promise<AddOtherIncomeState> {
  const session = await auth();
  if (!session || session.user.role !== "ACCOUNTANT") {
    return { error: "Рухсат йўқ" };
  }

  const point = formData.get("point") as OtherIncomePoint;
  const rawCategory = String(formData.get("category") ?? "");
  const category: OtherIncomeCategory = OTHER_INCOME_CATEGORIES.includes(rawCategory as OtherIncomeCategory)
    ? (rawCategory as OtherIncomeCategory)
    : "BOSHQA";
  const amount = Number(formData.get("amount") ?? 0);
  const plateNumber = String(formData.get("plateNumber") ?? "").trim() || null;
  const note = String(formData.get("note") ?? "").trim() || null;

  if (point !== "FARGONA" && point !== "QUVA" && point !== "BUXGALTERIYA") return { error: "Пунктни танланг" };
  if (!(amount > 0)) return { error: "Суммани тўғри киритинг" };

  await prisma.otherIncome.create({
    data: {
      point,
      category,
      amount: BigInt(Math.round(amount)),
      note,
      plateNumber,
      incomeDate: new Date(),
      enteredBy: session.user.id,
    },
  });

  return { error: "" };
}

/** Deletes any OtherIncome row (any point, including FARGONA/QUVA entries a
 * dispatcher recorded — unlike dispatcher/actions.ts's own
 * deleteOtherIncomeAction, which only lets a dispatcher delete their own
 * active point's rows) — the accountant sees every point's "Бошқа кирим" in
 * one combined list (FleetDashboard's own card) and needs to be able to fix
 * a mistaken entry regardless of which point it was recorded under. Same
 * plain-async-action shape as addOtherIncomeAction, for the same reason
 * (see its own doc comment) — rendered via ConfirmDeleteButton on
 * /accountant/report, not a standalone route. */
export async function deleteOtherIncomeAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session || session.user.role !== "ACCOUNTANT") return;

  const id = String(formData.get("id") ?? "");
  const income = await prisma.otherIncome.findUnique({ where: { id } });
  if (!income) return;

  await logDeletion(
    "OtherIncome",
    income.id,
    `${OTHER_INCOME_CATEGORY_LABELS[income.category]} · ${income.amount.toString()} сўм${income.plateNumber ? ` · ${income.plateNumber}` : ""}${income.note ? ` · ${income.note}` : ""}`,
    session.user.id
  );
  await prisma.otherIncome.delete({ where: { id } });
}
