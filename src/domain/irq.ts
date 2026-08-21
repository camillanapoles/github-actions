/**
 * F4 — IRQ bus. HTTP enfileira; o CPU é repository_dispatch / CLI --drain.
 * O payload é o que se enviaria a POST /repos/{o}/{r}/dispatches.
 */
import fs from "node:fs";
import path from "node:path";
import { nid, nowIso } from "@/db/client";

export type IrqType = "actos.syscall" | "actos.slice" | "actos.drain";

export type Irq = {
  id: string;
  type: IrqType;
  goal?: string;
  runId?: string;
  agentId?: string;
  acked: boolean;
  at: string;
};

function irqFile() {
  return process.env.ACTOS_IRQ || path.join(process.cwd(), "data", "irq.jsonl");
}

export function emitIrq(partial: Omit<Irq, "id" | "at" | "acked">): Irq {
  const irq: Irq = { ...partial, id: nid("irq"), acked: false, at: nowIso() };
  const file = irqFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(irq) + "\n");
  return irq;
}

export function pendingIrqs(): Irq[] {
  const file = irqFile();
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Irq)
    .filter((i) => !i.acked);
}

export function ackIrq(id: string) {
  const file = irqFile();
  if (!fs.existsSync(file)) return;
  const all = fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Irq)
    .map((i) => (i.id === id ? { ...i, acked: true } : i));
  fs.writeFileSync(file, all.map((i) => JSON.stringify(i)).join("\n") + (all.length ? "\n" : ""));
}

/** Body for GitHub repository_dispatch — CPU remoto. */
export function githubDispatchBody(irq: Irq) {
  return {
    event_type: "agent.run",
    client_payload: {
      goal: irq.goal,
      agent_id: irq.agentId ?? "harness",
      run_id: irq.runId,
      irq_id: irq.id,
    },
  };
}
