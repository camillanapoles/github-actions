import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { nowIso } from "@/db/client";
import { ObjectPath } from "@/domain/path";
import type { Kernel } from "@/domain/kernel";
import type { AgentRecord, AgentStep, ExecutionRecord } from "@/domain/types";

type WorkflowFile = {
  name: string;
  jobs: Record<
    string,
    {
      needs?: string;
      steps: Array<{
        id: string;
        name: string;
        uses: string;
        with?: Record<string, string>;
      }>;
    }
  >;
};

export async function runHarness(ctx: {
  kernel: Kernel;
  agent: AgentRecord;
  goal: string;
  runId: string;
  execution: ExecutionRecord;
}): Promise<AgentStep[]> {
  const file = path.join(process.cwd(), "harness/workflows/agent.yaml");
  const wf = YAML.parse(fs.readFileSync(file, "utf8")) as WorkflowFile;
  const steps: AgentStep[] = [];
  let n = 0;
  const memory: Record<string, unknown> = { goal: ctx.goal };

  for (const [jobId, job] of Object.entries(wf.jobs)) {
    for (const step of job.steps) {
      n += 1;
      const output = dispatch(step.uses, ctx, memory);
      memory[step.id] = output;
      const p = ObjectPath.named("agentStep", {
        id: ctx.agent.id,
        runId: ctx.runId,
        n: String(n),
      }).resolve();
      steps.push({
        n,
        name: `${jobId}/${step.name}`,
        uses: step.uses,
        status: "ok",
        input: { goal: ctx.goal, with: step.with ?? {} },
        output,
        path: p,
        at: nowIso(),
      });
    }
  }
  return steps;
}

function dispatch(
  uses: string,
  ctx: { kernel: Kernel; agent: AgentRecord; goal: string; runId: string; execution: ExecutionRecord },
  memory: Record<string, unknown>,
): unknown {
  switch (uses) {
    case "kernel.ps":
      return { processes: ctx.kernel.ps().length, space: "unique-runtime" };
    case "kernel.ls":
      return { objects: ctx.kernel.ls("/objects").length, memoryPaths: ctx.agent.memoryPaths };
    case "agent.plan":
      return plan(ctx.goal);
    case "kernel.cache.get":
      return { cacheKey: ctx.execution.cacheKey, hit: ctx.execution.cacheHit };
    case "agent.act":
      return act(ctx.goal, ctx.kernel);
    case "kernel.write": {
      const note = ctx.kernel.write({
        kind: "goal-result",
        payload: { goal: ctx.goal, plan: memory.plan, act: memory.tools },
        metadata: { agent: ctx.agent.id, runId: ctx.runId },
      });
      return { path: note.path, id: note.id };
    }
    case "kernel.resolve":
      return { pending: true, executionId: ctx.execution.id };
    case "kernel.unmount":
      return { unmounted: ctx.runId };
    case "kernel.cache.put":
      return { cacheKey: ctx.execution.cacheKey };
    default:
      return { noop: uses };
  }
}

function plan(goal: string) {
  const g = goal.toLowerCase();
  const actions: string[] = ["kernel.ps"];
  if (g.includes("cache") || g.includes("execução") || g.includes("execucao")) actions.push("kernel.cache.get");
  if (g.includes("regra") || g.includes("rule")) actions.push("rules.list");
  if (g.includes("objeto") || g.includes("path")) actions.push("kernel.ls");
  actions.push("kernel.write", "kernel.resolve");
  return {
    goal,
    strategy: "workflow-backed (GitHub Action analog)",
    actions,
  };
}

function act(goal: string, kernel: Kernel) {
  const cached = kernel.listCachedExecutions();
  const processes = kernel.ps();
  const kinds = kernel.ls("/objects").reduce<Record<string, number>>((acc, o) => {
    acc[o.kind] = (acc[o.kind] ?? 0) + 1;
    return acc;
  }, {});
  return {
    summary: `Goal "${goal}" observado no kernel.`,
    cachedExecutions: cached.length,
    runtimeProcesses: processes.length,
    objectIndex: kinds,
  };
}
