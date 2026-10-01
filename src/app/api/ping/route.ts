import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Hit every 5 minutes by .github/workflows/keep-alive.yml so Neon's compute
// never goes idle long enough to autosuspend — that suspend/resume cycle is
// what was making every page (and GPS checks) feel slow or fail outright on
// the first request after a quiet stretch. No auth needed: this touches
// nothing sensitive, just a trivial query to keep the connection warm.
export async function GET() {
  await prisma.$queryRaw`SELECT 1`;
  return NextResponse.json({ ok: true });
}
