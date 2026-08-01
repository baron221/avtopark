import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Hit by an external cron pinger every few minutes so Neon's compute never
// goes idle long enough to autosuspend — that suspend/resume cycle is what
// was making every page feel slow on the first request after a gap.
export async function GET() {
  await prisma.$queryRaw`SELECT 1`;
  return NextResponse.json({ ok: true });
}
