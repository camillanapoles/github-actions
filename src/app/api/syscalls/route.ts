import { NextResponse } from "next/server";
import { getKernel } from "@/domain/kernel";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ log: getKernel().syscallLog() });
}

export async function POST(req: Request) {
  const body = (await req.json()) as { name?: string; args?: Record<string, unknown> };
  const rec = getKernel().syscall(body.name ?? "ps", body.args ?? {});
  return NextResponse.json(rec);
}
