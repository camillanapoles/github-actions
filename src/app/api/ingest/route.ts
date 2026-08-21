import { NextResponse } from "next/server";
import { getKernel } from "@/domain/kernel";

export const dynamic = "force-dynamic";

/** Multi-repo ingest (F6). Path = /objects/{repo}/{kind}/{id} */
export async function POST(req: Request) {
  const body = (await req.json()) as {
    repo?: string;
    kind?: string;
    payload?: unknown;
    id?: string;
  };
  if (!body.repo) return NextResponse.json({ error: "repo required (owner/name)" }, { status: 400 });
  const obj = getKernel().ingest({
    repo: body.repo,
    kind: body.kind ?? "execution",
    payload: body.payload ?? {},
    id: body.id,
  });
  return NextResponse.json(obj, { status: 201 });
}
