import { NextResponse } from "next/server";
import { getKernel } from "@/domain/kernel";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const prefix = url.searchParams.get("prefix") ?? "/";
  const kind = url.searchParams.get("kind") ?? undefined;
  const k = getKernel();
  const list = kind ? k.ls("/objects/" + kind) : k.ls(prefix);
  return NextResponse.json({ objects: list });
}

export async function POST(req: Request) {
  const body = (await req.json()) as { kind?: string; payload?: unknown; path?: string };
  const obj = getKernel().write({
    kind: body.kind ?? "blob",
    payload: body.payload ?? {},
    path: body.path,
  });
  return NextResponse.json(obj, { status: 201 });
}
