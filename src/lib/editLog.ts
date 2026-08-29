import { prisma } from "@/lib/prisma";

/**
 * Records who changed an existing record's amount and to what — parallel to
 * deletionLog.ts's logDeletion, but for edits. This app has no general edit
 * history, so before this, an amount silently changed after that day's cash
 * was already handed over/confirmed left no trace at all.
 */
export async function logEdit(entityType: string, entityId: string, summary: string, editedBy: string) {
  await prisma.editLog.create({ data: { entityType, entityId, summary, editedBy } });
}
