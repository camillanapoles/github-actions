"use server";

import { revalidatePath } from "next/cache";
import { getKernel } from "@/domain/kernel";

export async function runAgentAction(formData: FormData) {
  const goal = String(formData.get("goal") ?? "").trim();
  const agentId = String(formData.get("agentId") ?? "harness");
  if (!goal) return { ok: false as const, error: "goal vazio" };
  const run = getKernel().enqueueAgent(goal, agentId);
  revalidatePath("/");
  revalidatePath("/agentes");
  revalidatePath("/execucoes");
  revalidatePath("/runtime");
  revalidatePath("/objetos");
  return {
    ok: true as const,
    id: run.id,
    status: run.status,
    cache: Boolean((run.result as { cacheHit?: boolean })?.cacheHit),
  };
}

export async function drainAction(): Promise<void> {
  await getKernel().drain(8);
  revalidatePath("/");
  revalidatePath("/agentes");
  revalidatePath("/execucoes");
  revalidatePath("/runtime");
  revalidatePath("/objetos");
  revalidatePath("/sys");
}

export async function syscallAction(formData: FormData) {
  const name = String(formData.get("name") ?? "ps");
  let args: Record<string, unknown> = {};
  const raw = String(formData.get("args") ?? "").trim();
  if (raw) {
    try {
      args = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      args = { path: raw, prefix: raw, id: raw, runId: raw };
    }
  }
  const rec = getKernel().syscall(name, args);
  revalidatePath("/sys");
  return { ok: true as const, rec };
}

export async function toggleRuleAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  getKernel().toggleRule(id);
  revalidatePath("/regras");
}

export async function writeObjectAction(formData: FormData): Promise<void> {
  const kind = String(formData.get("kind") ?? "blob");
  const payloadRaw = String(formData.get("payload") ?? "{}");
  let payload: unknown = {};
  try {
    payload = JSON.parse(payloadRaw);
  } catch {
    payload = { text: payloadRaw };
  }
  getKernel().write({ kind, payload });
  revalidatePath("/objetos");
}

export async function resolveAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  getKernel().resolveExecution(id);
  revalidatePath("/execucoes");
  revalidatePath("/runtime");
  revalidatePath("/objetos");
}

export async function forkAction(formData: FormData): Promise<void> {
  const runId = String(formData.get("runId") ?? "");
  getKernel().fork(runId);
  revalidatePath("/runtime");
}
