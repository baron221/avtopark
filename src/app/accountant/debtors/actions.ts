"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/** Marks an ORDER's outstanding (revenue − collectedAmount) as finally
 * collected — accountant-only (see AccountantNav's own "faqat буxgalter"
 * scoping: a granted non-accountant guest never even sees this page's nav
 * link, but the action itself still needs its own check). collectedAmount
 * is deliberately left untouched: it must keep meaning "collected on
 * tripDate" so computeCashBalance/computeBalanceLedger's own
 * debtSettlementAgg/debtSettlements queries (ownerPayout.ts) can still
 * derive the settled amount from revenue − collectedAmount after this
 * runs — only debtSettledAt/debtSettledBy flip a debt from open to closed. */
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

  revalidatePath("/accountant/debtors");
  revalidatePath("/accountant/report");
}
