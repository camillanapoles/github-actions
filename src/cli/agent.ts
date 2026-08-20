/**
 * CLI do harness agentic.
 * Este é o processo que o GitHub Action executa — backend puro.
 *
 *   npx tsx src/cli/agent.ts --goal "indexar cache" --agent harness
 */
import { getKernel } from "@/domain/kernel";
import { seedIfEmpty } from "@/db/seed";

function arg(name: string, fallback = ""): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return process.env[name.toUpperCase()] ?? fallback;
}

async function main() {
  seedIfEmpty();
  const goal = arg("goal", process.env.GOAL ?? "Indexar execuções cacheadas e persistir objetos.");
  const agent = arg("agent", process.env.AGENT_ID ?? "harness");
  const kernel = getKernel();
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
