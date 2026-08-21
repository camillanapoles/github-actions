import { NextResponse } from "next/server";
import { getKernel } from "@/domain/kernel";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ events: getKernel().listEvents() });
}
