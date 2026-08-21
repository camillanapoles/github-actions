/**
 * CLI = CPU. A API só enfileira; este processo (ou a GitHub Action) executa.
 *
 *   npx tsx src/cli/agent.ts --goal "indexar cache" --agent harness
 *   npx tsx src/cli/agent.ts --drain
 *   npx tsx src/cli/agent.ts --slice
 *   npx tsx src/cli/agent.ts --checkpoint <runId>
 */
import { getKernel } from "@/domain/kernel";
import { seedIfEmpty } from "@/db/seed";

function arg(name: string, fallback = ""): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return process.env[name.toUpperCase()] ?? fallback;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  seedIfEmpty();
  const kernel = getKernel();

  if (hasFlag("hydrate")) {
    const h = kernel.hydrateFromL3();
    console.log("[actos] hydrate", h.n);
    return;
  }

  if (hasFlag("checkpoint")) {
    const runId = arg("checkpoint") || arg("run");
    if (!runId) throw new Error("--checkpoint precisa de runId");
    const ck = kernel.checkpoint(runId, arg("goal", process.env.GOAL));
    console.log("[actos] checkpoint", JSON.stringify({ path: ck.snapshot.path, irq: ck.irq }));
    return;
  }

  if (hasFlag("slice") || process.env.ACTOS_SLICE === "1") {
    const h = kernel.hydrateFromL3();
    console.log(`[actos] slice hydrate=${h.n} queue=${kernel.listQueue().length}`);
    const out = await kernel.drain(Number(arg("limit", "8")));
    for (const run of out) {
      console.log(`[actos] run=${run.id} status=${run.status}`);
    }
    return;
  }

  if (hasFlag("drain")) {
    const limit = Number(arg("limit", "8"));
    console.log(`[actos] drain queue limit=${limit} waiting=${kernel.listQueue().length}`);
    const out = await kernel.drain(limit);
    for (const run of out) {
      console.log(`[actos] run=${run.id} status=${run.status} cas=${(run.result as { cacheKey?: string })?.cacheKey ?? ""}`);
    }
    console.log(`[actos] drained ${out.length}`);
    return;
  }

  const goal = arg("goal", process.env.GOAL ?? "Indexar execuções cacheadas e persistir objetos.");
  const agent = arg("agent", process.env.AGENT_ID ?? "harness");
  if (process.env.ACTOS_GITFS !== "0") {
    const h = kernel.hydrateFromL3();
    console.log(`[actos] hydrate L3 n=${h.n}`);
  }
  console.log(`[actos] unique space processes=${kernel.ps().length}`);
  console.log(`[actos] agent=${agent} goal=${JSON.stringify(goal)}`);
  const run = await kernel.runAgent(goal, agent);
  console.log(`[actos] run=${run.id} status=${run.status}`);
  for (const step of run.steps) {
    console.log(`  step ${step.n} ${step.uses} → ${step.path}`);
  }
  console.log(`[actos] result`, JSON.stringify(run.result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
