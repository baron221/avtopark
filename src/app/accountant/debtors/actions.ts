"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

function revalidateAll() {
  revalidatePath("/accountant/debtors");
  revalidatePath("/accountant/report");
}

/** Marks an ORDER's outstanding (revenue − collectedAmount) as finally
 * collected — accountant-only (see AccountantNav's own "faqat буxgalter"
 * scoping: a granted non-accountant guest never even sees this page's nav
 * link, but the action itself still needs its own check). That money lands
 * in the accountant's own cash balance (computeCashBalance/
 * computeBalanceLedger read it as a "Насия ёпилди" entry dated at
 * debtSettledAt). collectedAmount is deliberately left untouched: it must
 * keep meaning "collected on tripDate", so revenue − collectedAmount still
 * yields the settled amount after this runs — only debtSettledAt/
 * debtSettledBy flip a debt from open to closed. */
export async function settleTripDebtAction(formData: FormData) {
  const session = await auth();
  if (!session || session.user.role !== "ACCOUNTANT") return;

  const id = String(formData.get("id") ?? "");
  const trip = await prisma.trip.findUnique({ where: { id } });
  if (!trip || trip.kind !== "ORDER" || trip.debtSettledAt || trip.collectedAmount >= trip.revenue) return;

  await prisma.trip.update({
    where: { id },
    data: { debtSettledAt: new Date(), debtSettledBy: session.user.id },
  });

  revalidateAll();
}

/** Undoes an accidental "Тўланди" click — puts the debt back to open, so it
 * reappears in the debtors list and the money drops back out of the cash
 * balance. Only debtSettledAt/debtSettledBy are cleared; the order itself
 * (revenue/collectedAmount) is untouched. */
export async function revertTripDebtSettlementAction(formData: FormData) {
  const session = await auth();
  if (!session || session.user.role !== "ACCOUNTANT") return;

  const id = String(formData.get("id") ?? "");
  const trip = await prisma.trip.findUnique({ where: { id } });
  if (!trip || trip.kind !== "ORDER" || !trip.debtSettledAt) return;

  await prisma.trip.update({
    where: { id },
    data: { debtSettledAt: null, debtSettledBy: null },
  });

  revalidateAll();
}
