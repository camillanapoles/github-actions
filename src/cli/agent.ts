/**
 * CLI = CPU. A API só enfileira; este processo (ou a GitHub Action) executa.
 *
 *   npx tsx src/cli/agent.ts --goal "indexar cache" --agent harness
 *   npx tsx src/cli/agent.ts --drain
 *   npx tsx src/cli/agent.ts --drain --limit 4
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
