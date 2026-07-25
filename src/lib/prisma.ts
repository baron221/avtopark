import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Higher pool size than pg's default (10) so a single dashboard request — which
// fires many queries concurrently via Promise.all — doesn't queue behind a
// cold connection pool. Neon's pooled endpoint handles this fine.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 30 });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
