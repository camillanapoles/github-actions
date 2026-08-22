import { NextResponse } from "next/server";
import { getKernel } from "@/domain/kernel";

export const dynamic = "force-dynamic";

export async function GET() {
  const k = getKernel();
  return NextResponse.json({ status: k.gitStatus(), ls: k.gitLs("/") });
}
