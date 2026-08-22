import { NextResponse } from "next/server";
import { getKernel } from "@/domain/kernel";

export const dynamic = "force-dynamic";

/** Worker local analog do runner. Em produção isto é a GitHub Action. */
export async function POST(req: Request) {
  let limit = 8;
  try {
    const body = (await req.json()) as { limit?: number };
    if (body.limit) limit = Number(body.limit);
  } catch {
    /* empty body */
  }
  const out = await getKernel().drain(limit);
  return NextResponse.json({ drained: out.length, runs: out });
}
