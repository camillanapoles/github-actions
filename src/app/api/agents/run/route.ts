import { NextResponse } from "next/server";
import { getKernel } from "@/domain/kernel";

export const dynamic = "force-dynamic";

/** Enfileira. CPU = CLI (`--drain` / `--goal`) ou GitHub Action. */
export async function POST(req: Request) {
  const body = (await req.json()) as { goal?: string; agentId?: string };
  if (!body.goal) return NextResponse.json({ error: "goal required" }, { status: 400 });
  const run = getKernel().enqueueAgent(body.goal, body.agentId ?? "harness");
  return NextResponse.json({ ...run, hint: "queued — run `npx tsx src/cli/agent.ts --drain` or the Action" }, { status: 202 });
}
