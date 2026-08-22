import { NextResponse } from "next/server";
import { getKernel } from "@/domain/kernel";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const cached = new URL(req.url).searchParams.get("cached") === "1";
  const k = getKernel();
  const list = cached ? k.listCachedExecutions() : k.listExecutions();
  return NextResponse.json({ executions: list });
}
