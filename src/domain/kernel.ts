import fs from "node:fs";
import path from "node:path";
import { nid, nowIso } from "@/db/client";
import {
  agentRuns,
  agents,
  executions,
  objects,
  rules,
  runtime,
  syscalls,
} from "@/db/repo";
import { ObjectPath, PATTERNS } from "./path";
import { RuleEngine } from "./rules";
import type {
  AgentRecord,
  AgentRunRecord,
  AgentStep,
  ExecutionRecord,
  JobState,
  RuleOp,
  RuntimeProcess,
  StoredObjectRecord,
} from "./types";
import { runHarness } from "@/harness/runner";
import { seedIfEmpty } from "@/db/seed";

/**
 * Kernel — unique space of what is currently in GitHub Actions runtime.
 *
 * Analogous to an OS:
 *   process table  → runtime processes (workflow runs)
 *   filesystem     → object store keyed by pattern + id
 *   permissions    → rules
 *   syscalls       → extra backend functions beyond CRUD
 *
 * Lifecycle of an execution:
 *   queued → in_runtime (unique space) → resolved (everything is object) → cached at path
 */
export class Kernel {
  private ensureSeeded() {
    seedIfEmpty();
  }

  stats() {
    this.ensureSeeded();
    const snap = runtime.snapshot();
    const ex = executions.stats();
    const kinds = objects.kinds();
    return {
      runtime: {
        processes: snap.processes.length,
        updatedAt: snap.updatedAt,
      },
      executions: ex,
      objects: kinds.reduce((a, k) => a + k.count, 0),
      kinds,
      agents: agents.list().length,
      rules: rules.list().filter((r) => r.enabled).length,
    };
  }

  /* ---------- filesystem (objects) ---------- */

  read(p: string): StoredObjectRecord {
    this.ensureSeeded();
    const obj = objects.byPath(p);
    if (!obj) {
      throw new Error(`ENOENT: ${p}`);
    }
    const decision = new RuleEngine(rules.list()).evaluate("read", p, obj);
    this.trace("read", { path: p }, decision, p);
    if (!decision.allowed) throw new Error(`EACCES: ${decision.reason}`);
    if (decision.transformed) {
      return { ...obj, payload: decision.transformed };
    }
    return obj;
  }

  ls(prefix = "/"): StoredObjectRecord[] {
    this.ensureSeeded();
    const list = objects.list({ prefix, limit: 300 });
    const engine = new RuleEngine(rules.list());
    return list.filter((o) => engine.evaluate("read", o.path, o).allowed);
  }

  write(input: {
    kind: string;
    id?: string;
    pattern?: string;
    params?: Record<string, string>;
    path?: string;
    payload: unknown;
    metadata?: Record<string, unknown>;
  }): StoredObjectRecord {
    this.ensureSeeded();
    const id = input.id ?? nid(input.kind.slice(0, 4));
    let pattern = input.pattern ?? PATTERNS.object;
    let resolved: string;
    if (input.path) {
      resolved = input.path;
      pattern = ObjectPath.parse(input.path)?.pattern ?? pattern;
    } else {
      const params = { kind: input.kind, id, ...(input.params ?? {}) };
      resolved = ObjectPath.from(pattern, params).resolve();
    }
    const engine = new RuleEngine(rules.list());
    const decision = engine.evaluate("write", resolved, null);
    if (!decision.allowed) {
      this.trace("write", input, decision, resolved);
      throw new Error(`EACCES: ${decision.reason}`);
    }
    const obj = objects.upsert({
      id,
      kind: input.kind,
      path: resolved,
      pattern,
      payload: input.payload,
      metadata: { ...(input.metadata ?? {}), rule: decision.ruleId },
    });
    this.persistFile(obj);
    this.trace("write", { path: resolved, kind: input.kind }, { id: obj.id }, resolved);
    return obj;
  }

  unlink(id: string): boolean {
    const obj = objects.get(id);
    if (!obj) return false;
    const decision = new RuleEngine(rules.list()).evaluate("write", obj.path, obj);
    if (!decision.allowed) throw new Error(`EACCES: ${decision.reason}`);
    const ok = objects.delete(id);
    this.trace("unlink", { id }, { ok }, obj.path);
    return ok;
  }

  resolvePath(pattern: string, params: Record<string, string>): string {
    return ObjectPath.from(pattern, params).resolve();
  }

  /* ---------- executions + cache ---------- */

  listCachedExecutions(workflow?: string): ExecutionRecord[] {
    this.ensureSeeded();
    return executions.list({ cached: true, workflow, limit: 80 });
  }

  listExecutions(): ExecutionRecord[] {
    this.ensureSeeded();
    return executions.list({ limit: 80 });
  }

  getExecution(id: string): ExecutionRecord | null {
    this.ensureSeeded();
    return executions.get(id);
  }

  /**
   * After the run finishes, everything becomes an object and leaves the
   * unique runtime space. Stored at /objects/execution/{id} and
   * /cache/{workflow}/{sha}/{id}.
   */
  resolveExecution(id: string): StoredObjectRecord {
    const ex = executions.get(id);
    if (!ex) throw new Error(`execução não encontrada: ${id}`);

    const obj = this.write({
      kind: "execution",
      id: ex.id,
      pattern: PATTERNS.object,
      params: { kind: "execution", id: ex.id },
      payload: ex,
      metadata: { cacheKey: ex.cacheKey, runId: ex.runId },
    });

    const cachePath = ObjectPath.named("cache", {
      workflow: ex.workflow,
      sha: ex.sha,
      id: ex.id,
    }).resolve();

    this.write({
      kind: "cache",
      id: `cache_${ex.id}`,
      path: cachePath,
      pattern: PATTERNS.cache,
      payload: {
        hit: true,
        executionId: ex.id,
        workflow: ex.workflow,
        sha: ex.sha,
        conclusion: ex.conclusion,
        jobs: ex.jobs,
      },
      metadata: { source: "resolveExecution" },
    });

    const next: ExecutionRecord = {
      ...ex,
      status: "cached",
      objectId: obj.id,
      finishedAt: ex.finishedAt ?? nowIso(),
    };
    executions.upsert(next);
    this.unmountProcess(ex.runId);
    this.trace("resolve", { executionId: id }, { objectId: obj.id, cachePath }, obj.path);
    return obj;
  }

  cacheGet(cacheKey: string): ExecutionRecord | null {
    const hit = executions.byCacheKey(cacheKey);
    this.trace("cache.get", { cacheKey }, { hit: Boolean(hit) }, hit?.objectId ?? null);
    return hit;
  }

  cachePut(ex: ExecutionRecord): ExecutionRecord {
    const cached = { ...ex, status: "cached" as const };
    executions.upsert(cached);
    return cached;
  }

  /* ---------- runtime (unique space) ---------- */

  ps(): RuntimeProcess[] {
    this.ensureSeeded();
    return runtime.snapshot().processes;
  }

  mountProcess(proc: RuntimeProcess): RuntimeProcess[] {
    const snap = runtime.snapshot();
    const next = [...snap.processes.filter((p) => p.pid !== proc.pid), proc];
    runtime.save(next);
    return next;
  }

  unmountProcess(runId: string): RuntimeProcess[] {
    const snap = runtime.snapshot();
    const next = snap.processes.filter((p) => p.runId !== runId && p.pid !== runId);
    runtime.save(next);
    return next;
  }

  fork(runId: string): RuntimeProcess {
    const src = this.ps().find((p) => p.runId === runId || p.pid === runId);
    if (!src) throw new Error("processo não está no espaço único");
    const child: RuntimeProcess = {
      ...src,
      pid: nid("pid"),
      runId: nid("run"),
      startedAt: nowIso(),
      path: ObjectPath.named("runtimeRun", { id: nid("run") }).resolve(),
      memoryHint: "fork",
    };
    this.mountProcess(child);
    this.trace("fork", { from: runId }, child, child.path);
    return child;
  }

  snapshotRuntime() {
    const snap = runtime.snapshot();
    return this.write({
      kind: "snapshot",
      payload: snap,
      metadata: { n: snap.processes.length },
    });
  }

  /* ---------- agentic harness ---------- */

  listAgents(): AgentRecord[] {
    this.ensureSeeded();
    return agents.list();
  }

  getAgent(id: string): AgentRecord | null {
    this.ensureSeeded();
    return agents.get(id);
  }

  listAgentRuns(agentId?: string): AgentRunRecord[] {
    this.ensureSeeded();
    return agentRuns.list(agentId);
  }

  async runAgent(goal: string, agentId = "harness"): Promise<AgentRunRecord> {
    this.ensureSeeded();
    const agent = agents.get(agentId) ?? agents.list()[0];
    if (!agent) throw new Error("nenhum agente no kernel");

    const runId = nid("arun");
    const execId = nid("ex");
    const sha = fakeSha();
    const cacheKey = `actos-${agent.workflow}-${sha}-${hashGoal(goal)}`;

    const cached = this.cacheGet(cacheKey);
    const jobs: JobState[] = [
      {
        id: "harness",
        name: "agentic-harness",
        status: "in_progress",
        startedAt: nowIso(),
        steps: [],
      },
    ];

    const execution: ExecutionRecord = {
      id: execId,
      runId,
      workflow: "agent-harness.yml",
      event: "workflow_dispatch",
      status: cached ? "cached" : "in_runtime",
      conclusion: cached ? cached.conclusion : null,
      sha,
      branch: "arena/01a01e33-github-actions",
      actor: "actos-kernel",
      cacheKey,
      cacheHit: Boolean(cached),
      startedAt: nowIso(),
      finishedAt: cached ? nowIso() : null,
      jobs,
      logs: cached ? "cache hit — reusing object\n" : "entering unique runtime space\n",
      objectId: cached?.objectId ?? null,
      createdAt: nowIso(),
    };
    executions.upsert(execution);

    const proc: RuntimeProcess = {
      pid: runId,
      runId,
      workflow: execution.workflow,
      kind: "agent",
      status: "running",
      startedAt: nowIso(),
      path: ObjectPath.named("runtimeRun", { id: runId }).resolve(),
      memoryHint: "harness",
    };
    this.mountProcess(proc);
    agents.setStatus(agent.id, "planning");

    let run: AgentRunRecord = {
      id: runId,
      agentId: agent.id,
      goal,
      status: "planning",
      executionId: execId,
      steps: [],
      result: null,
      createdAt: nowIso(),
      finishedAt: null,
    };
    agentRuns.upsert(run);

    if (cached) {
      run = {
        ...run,
        status: "done",
        steps: [
          {
            n: 0,
            name: "cache-hit",
            uses: "kernel.cache.get",
            status: "ok",
            input: { cacheKey },
            output: { executionId: cached.id },
            path: ObjectPath.named("agentStep", { id: agent.id, runId, n: "0" }).resolve(),
            at: nowIso(),
          },
        ],
        result: { cacheHit: true, executionId: cached.id },
        finishedAt: nowIso(),
      };
      agentRuns.upsert(run);
      this.unmountProcess(runId);
      agents.setStatus(agent.id, "idle");
      return run;
    }

    const steps = await runHarness({ kernel: this, agent, goal, runId, execution });
    persistSteps(this, agent, runId, steps);

    jobs[0] = {
      ...jobs[0],
      status: "completed",
      conclusion: "success",
      finishedAt: nowIso(),
      steps: steps.map((s) => ({
        name: s.name,
        conclusion: s.status === "ok" ? "success" : "failure",
        durationMs: 12 + s.n * 7,
      })),
    };

    executions.upsert({
      ...execution,
      status: "resolved",
      conclusion: "success",
      finishedAt: nowIso(),
      jobs,
      logs: execution.logs + steps.map((s) => `[${s.uses}] ${s.name} → ${s.status}\n`).join(""),
    });

    const obj = this.resolveExecution(execId);

    run = {
      ...run,
      status: "done",
      steps,
      result: { objectPath: obj.path, executionId: execId, cacheKey },
      finishedAt: nowIso(),
    };
    agentRuns.upsert(run);
    agents.setStatus(agent.id, "idle");
    return run;
  }

  /* ---------- syscalls (CRUD+) ---------- */

  syscall(name: string, args: Record<string, unknown> = {}) {
    this.ensureSeeded();
    const fn = SYS[name];
    if (!fn) {
      const rec = syscalls.insert(name, args, { error: "ENOSYS" }, null);
      return rec;
    }
    const result = fn(this, args);
    return syscalls.insert(name, args, result, (result as { path?: string })?.path ?? null);
  }

  syscallLog() {
    this.ensureSeeded();
    return syscalls.list();
  }

  /* ---------- rules CRUD+ ---------- */

  listRules() {
    this.ensureSeeded();
    return rules.list();
  }

  toggleRule(id: string) {
    const r = rules.get(id);
    if (!r) throw new Error("regra não encontrada");
    return rules.upsert({ ...r, enabled: !r.enabled });
  }

  private persistFile(obj: StoredObjectRecord) {
    const rel = obj.path.replace(/^\//, "");
    const file = path.join(process.cwd(), "data", "objects", rel + ".json");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(
      file,
      JSON.stringify(
        {
          id: obj.id,
          kind: obj.kind,
          path: obj.path,
          pattern: obj.pattern,
          payload: obj.payload,
          metadata: obj.metadata,
        },
        null,
        2,
      ),
    );
  }

  private trace(name: string, args: unknown, result: unknown, p: string | null) {
    syscalls.insert(name, args, result, p);
  }
}

function persistSteps(kernel: Kernel, agent: AgentRecord, runId: string, steps: AgentStep[]) {
  for (const step of steps) {
    kernel.write({
      kind: "agent-step",
      id: `${runId}_s${step.n}`,
      pattern: PATTERNS.agentStep,
      params: { id: agent.id, runId, n: String(step.n) },
      payload: step,
    });
  }
  kernel.write({
    kind: "agent-run",
    id: runId,
    pattern: PATTERNS.agentRun,
    params: { id: agent.id, runId },
    payload: { goal: true, steps: steps.length, runId },
  });
}

const SYS: Record<string, (k: Kernel, args: Record<string, unknown>) => unknown> = {
  ps: (k) => k.ps(),
  ls: (k, a) => k.ls(String(a.prefix ?? "/")),
  read: (k, a) => k.read(String(a.path)),
  write: (k, a) =>
    k.write({
      kind: String(a.kind ?? "blob"),
      payload: a.payload ?? {},
      path: a.path ? String(a.path) : undefined,
    }),
  resolve: (k, a) => k.resolveExecution(String(a.id)),
  "cache.stat": (k) => k.stats().executions,
  snapshot: (k) => k.snapshotRuntime(),
  fork: (k, a) => k.fork(String(a.runId)),
  "path.resolve": (k, a) =>
    k.resolvePath(String(a.pattern ?? PATTERNS.object), (a.params as Record<string, string>) ?? { kind: "blob", id: "x" }),
};

let singleton: Kernel | undefined;
export function getKernel(): Kernel {
  if (!singleton) singleton = new Kernel();
  return singleton;
}

function fakeSha(): string {
  return Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

function hashGoal(goal: string): string {
  let h = 0;
  for (let i = 0; i < goal.length; i++) h = (h * 31 + goal.charCodeAt(i)) >>> 0;
  return h.toString(16);
}
