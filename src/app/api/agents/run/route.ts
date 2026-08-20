import { NextResponse } from "next/server";
import { getKernel } from "@/domain/kernel";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json()) as { goal?: string; agentId?: string };
  if (!body.goal) return NextResponse.json({ error: "goal required" }, { status: 400 });
  const run = await getKernel().runAgent(body.goal, body.agentId ?? "harness");
  return NextResponse.json(run);
}
