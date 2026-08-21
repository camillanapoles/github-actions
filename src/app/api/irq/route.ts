import { NextResponse } from "next/server";
import { getKernel } from "@/domain/kernel";
import { githubDispatchBody, pendingIrqs } from "@/domain/irq";

export const dynamic = "force-dynamic";

export async function GET() {
  const pending = pendingIrqs();
  return NextResponse.json({
    pending,
    dispatches: pending.map(githubDispatchBody),
  });
}

export async function POST(req: Request) {
  const body = (await req.json()) as { goal?: string; agentId?: string };
  if (!body.goal) return NextResponse.json({ error: "goal required" }, { status: 400 });
  const run = getKernel().enqueueAgent(body.goal, body.agentId ?? "harness");
  return NextResponse.json(
    { run, dispatch: (run.result as { irq?: unknown }).irq },
    { status: 202 },
  );
}
