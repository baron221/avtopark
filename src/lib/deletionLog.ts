import { prisma } from "@/lib/prisma";

/**
 * Records who deleted a business record and a short human-readable summary
 * of what it was, since the row itself is gone the moment this is called —
 * there's no soft-delete in this app, so this is the only trace left behind.
 */
export async function logDeletion(entityType: string, entityId: string, summary: string, deletedBy: string) {
  await prisma.deletionLog.create({ data: { entityType, entityId, summary, deletedBy } });
}
