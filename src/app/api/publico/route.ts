import { NextResponse } from "next/server";
import { getKernel } from "@/domain/kernel";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getKernel().exportPublic());
}

export async function POST() {
  return NextResponse.json(getKernel().exportPublic());
}
