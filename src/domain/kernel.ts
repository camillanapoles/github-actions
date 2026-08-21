import fs from "node:fs";
import path from "node:path";
import { nid, nowIso, tx } from "@/db/client";
import {
  agentRuns,
  agents,
  events,
  executions,
  objects,
  rules,
  syscalls,
} from "@/db/repo";
import { cacheKey as casKey } from "./cas";
import { emitIrq, githubDispatchBody, pendingIrqs } from "./irq";
import { publishObjects, publicDir } from "./public-cdn";
import { cdnStats, gc as cdnGc, l1GetByPath, l1List, l1Put, l2List, l2Put } from "./cdn";
import { gitfs } from "./gitfs";
import { ObjectPath, PATTERNS } from "./path";
import { RuleEngine } from "./rules";
import type {
  AgentRecord,
  AgentRunRecord,
  AgentStep,
  ExecutionRecord,
  JobState,
  RuntimeProcess,
  StoredObjectRecord,
} from "./types";
import { runHarness } from "@/harness/runner";
import { ensureArenaSessionRule, seedIfEmpty } from "@/db/seed";

const RUNTIME_TTL_MS = 30 * 60 * 1000;

type LiveProc = RuntimeProcess & { expiresAtMs: number };

declare global {
  // eslint-disable-next-line no-var
  var __actosLive: Map<string, LiveProc> | undefined;
}

function liveMap(): Map<string, LiveProc> {
  if (!globalThis.__actosLive) globalThis.__actosLive = new Map();
  return globalThis.__actosLive;
}

/**
 * Kernel — unique space of what is currently in GitHub Actions runtime.
 *
 * F1: CAS cache keys, append-only journal, in-memory runtime + TTL,
 * HTTP enqueue / CLI execute.
 */
export class Kernel {
  private ensureSeeded() {
    seedIfEmpty();
    ensureArenaSessionRule();
  }

  journal(op: string, pathName: string | null, payload: unknown) {
    return events.append(op, pathName, payload);
  }

  listEvents(limit = 80) {
    this.ensureSeeded();
    return events.list(limit);
  }

  stats() {
    this.ensureSeeded();
    const procs = this.ps();
    const ex = executions.stats();
    const kinds = objects.kinds();
    return {
      runtime: {
        processes: procs.length,
        updatedAt: nowIso(),
      },
      executions: ex,
      objects: kinds.reduce((a, k) => a + k.count, 0),
      kinds,
      agents: agents.list().length,
      rules: rules.list().filter((r) => r.enabled).length,
      queue: agentRuns.queued().length,
      gitfs: gitfs().status(),
      cdn: cdnStats(),
    };
  }

  cdn() {
    this.ensureSeeded();
    return { stats: cdnStats(), l1: l1List(), l2: l2List() };
  }

  lookup(p: string): { layer: "L1" | "L3-sqlite" | "miss"; path: string; body?: unknown } {
    this.ensureSeeded();
    const edge = l1GetByPath(p);
    if (edge) return { layer: "L1", path: p, body: edge.body };
    const obj = objects.byPath(p);
    if (obj) return { layer: "L3-sqlite", path: p, body: obj.payload };
    return { layer: "miss", path: p };
  }

  promoteCdn() {
    this.ensureSeeded();
    const { evicted, promote } = cdnGc();
    let promoted = 0;
    for (const e of promote) {
      const hit = l1GetByPath(e.path);
      if (!hit) continue;
      try {
        gitfs().write(e.path, hit.body, `promote L1→L3 ${e.sha.slice(0, 12)}`);
        promoted += 1;
      } catch {
        /* origin optional */
      }
    }
    this.journal("cdn.gc", null, { evicted: evicted.length, promoted });
    return { evicted: evicted.length, promoted };
  }

  gitStatus() {
    this.ensureSeeded();
    return gitfs().status();
  }

  gitLs(prefix = "/") {
    this.ensureSeeded();
    return gitfs().ls(prefix);
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
    this.journal("write", resolved, { kind: input.kind, id: obj.id });
    this.trace("write", { path: resolved, kind: input.kind }, { id: obj.id }, resolved);
    return obj;
  }

  unlink(id: string): boolean {
    const obj = objects.get(id);
    if (!obj) return false;
    const decision = new RuleEngine(rules.list()).evaluate("write", obj.path, obj);
    if (!decision.allowed) throw new Error(`EACCES: ${decision.reason}`);
    const ok = objects.delete(id);
    try {
      gitfs().unlink(obj.path);
    } catch {
      /* L3 best-effort */
    }
    this.journal("unlink", obj.path, { id });
    this.trace("unlink", { id }, { ok }, obj.path);
    return ok;
  }

  resolvePath(pattern: string, params: Record<string, string>): string {
    return ObjectPath.from(pattern, params).resolve();
  }

  /* ---------- executions + CAS cache ---------- */

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

  resolveExecution(id: string): StoredObjectRecord {
    const ex = executions.get(id);
    if (!ex) throw new Error(`execução não encontrada: ${id}`);

    return tx(() => {
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
        id: ex.cacheKey.slice(0, 16),
      }).resolve();

      this.write({
        kind: "cache",
        id: `cache_${ex.cacheKey.slice(0, 16)}`,
        path: cachePath,
        pattern: PATTERNS.cache,
        payload: {
          hit: true,
          executionId: ex.id,
          workflow: ex.workflow,
          sha: ex.sha,
          cacheKey: ex.cacheKey,
          conclusion: ex.conclusion,
          jobs: ex.jobs,
        },
        metadata: { source: "resolveExecution" },
      });

      executions.upsert({
        ...ex,
        status: "cached",
        objectId: obj.id,
        finishedAt: ex.finishedAt ?? nowIso(),
      });
      this.unmountProcess(ex.runId);
      try {
        const entry = l1Put(obj.path, obj);
        l2Put({ sha: entry.sha, path: obj.path, runId: ex.runId });
      } catch {
        /* L1/L2 best-effort */
      }
      this.journal("resolve", obj.path, { executionId: id, cachePath, cacheKey: ex.cacheKey });
      this.trace("resolve", { executionId: id }, { objectId: obj.id, cachePath }, obj.path);
      return obj;
    });
  }

  cacheGet(key: string): ExecutionRecord | null {
    const hit = executions.byCacheKey(key);
    this.trace("cache.get", { cacheKey: key }, { hit: Boolean(hit) }, hit?.objectId ?? null);
    return hit;
  }

  cachePut(ex: ExecutionRecord): ExecutionRecord {
    const cached = { ...ex, status: "cached" as const };
    executions.upsert(cached);
    this.journal("cache.put", null, { id: ex.id, cacheKey: ex.cacheKey });
    return cached;
  }

  /* ---------- runtime (unique space, RAM analog) ---------- */

  ps(): RuntimeProcess[] {
    this.ensureSeeded();
    this.reap();
    return [...liveMap().values()].map(stripLive);
  }

  mountProcess(proc: RuntimeProcess, ttlMs = RUNTIME_TTL_MS): RuntimeProcess[] {
    const expiresAtMs = Date.now() + ttlMs;
    liveMap().set(proc.pid, {
      ...proc,
      expiresAt: new Date(expiresAtMs).toISOString(),
      expiresAtMs,
    });
    this.journal("mount", proc.path, { pid: proc.pid, ttlMs });
    if (process.env.ACTOS_GITFS !== "0") {
      try {
        gitfs().mountRef(proc.pid, proc);
      } catch {
        /* refs/actos/runtime optional */
      }
    }
    return this.ps();
  }

  unmountProcess(runId: string): RuntimeProcess[] {
    const map = liveMap();
    for (const [pid, p] of map) {
      if (p.runId === runId || p.pid === runId) map.delete(pid);
    }
    this.journal("unmount", `/runtime/runs/${runId}`, { runId });
    try {
      gitfs().unmountRef(runId);
    } catch {
      /* */
    }
    return this.ps();
  }

  fork(runId: string): RuntimeProcess {
    const src = this.ps().find((p) => p.runId === runId || p.pid === runId);
    if (!src) throw new Error("processo não está no espaço único");
    const pid = nid("pid");
    const child: RuntimeProcess = {
      ...src,
      pid,
      runId: pid,
      ppid: src.pid,
      startedAt: nowIso(),
      path: ObjectPath.named("runtimeRun", { id: pid }).resolve(),
      memoryHint: `fork of ${src.pid}`,
    };
    this.mountProcess(child);
    this.trace("fork", { from: runId }, child, child.path);
    return child;
  }

  snapshotRuntime() {
    const processes = this.ps();
    return this.write({
      kind: "snapshot",
      payload: { processes, at: nowIso() },
      metadata: { n: processes.length },
    });
  }

  private reap() {
    const now = Date.now();
    const map = liveMap();
    for (const [pid, p] of map) {
      if (p.expiresAtMs <= now) {
        map.delete(pid);
        this.journal("reap", p.path, { pid, reason: "ttl" });
      }
    }
  }

  /* ---------- agentic harness: enqueue (API) / execute (CPU) ---------- */

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

  listQueue(): AgentRunRecord[] {
    this.ensureSeeded();
    return agentRuns.queued();
  }

  /** HTTP / UI: só enfileira. O CPU é o CLI ou a Action. */
  enqueueAgent(goal: string, agentId = "harness"): AgentRunRecord {
    this.ensureSeeded();
    const agent = agents.get(agentId) ?? agents.list()[0];
    if (!agent) throw new Error("nenhum agente no kernel");

    const key = casKey({ workflow: agent.workflow, goal, extra: { agent: agent.id } });
    const runId = nid("arun");
    const execId = nid("ex");
    const sha = key.slice(0, 40);
    const hit = this.cacheGet(key);

    const execution: ExecutionRecord = {
      id: execId,
      runId,
      workflow: "agent-harness.yml",
      event: "queue",
      status: hit ? "cached" : "queued",
      conclusion: hit ? hit.conclusion : null,
      sha,
      branch: "arena/01a01e33-github-actions",
      actor: "actos-kernel",
      cacheKey: key,
      cacheHit: Boolean(hit),
      startedAt: null,
      finishedAt: hit ? nowIso() : null,
      jobs: [],
      logs: hit ? "CAS hit on enqueue\n" : "queued — waiting for CPU (CLI/Action)\n",
      objectId: hit?.objectId ?? null,
      createdAt: nowIso(),
    };
    executions.upsert(execution);

    const run: AgentRunRecord = {
      id: runId,
      agentId: agent.id,
      goal,
      status: hit ? "done" : "queued",
      executionId: execId,
      steps: hit
        ? [
            {
              n: 0,
              name: "cas-hit",
              uses: "kernel.cache.get",
              status: "ok",
              input: { cacheKey: key },
              output: { executionId: hit.id },
              path: ObjectPath.named("agentStep", { id: agent.id, runId, n: "0" }).resolve(),
              at: nowIso(),
            },
          ]
        : [],
      result: hit ? { cacheHit: true, executionId: hit.id, cacheKey: key } : { queued: true, cacheKey: key },
      createdAt: nowIso(),
      finishedAt: hit ? nowIso() : null,
    };
    if (!hit) {
      const irq = emitIrq({ type: "actos.syscall", goal, runId, agentId: agent.id });
      run.result = { queued: true, cacheKey: key, irq: githubDispatchBody(irq) };
    }
    agentRuns.upsert(run);
    this.journal("enqueue", `/agents/${agent.id}/runs/${runId}`, {
      goal,
      cacheKey: key,
      cacheHit: Boolean(hit),
    });
    return run;
  }

  listIrqs() {
    return pendingIrqs();
  }

  async drain(limit = 8): Promise<AgentRunRecord[]> {
    this.ensureSeeded();
    const batch = agentRuns.queued(limit);
    const out: AgentRunRecord[] = [];
    for (const run of batch) {
      out.push(await this.execute(run.id));
    }
    this.journal("drain", null, { n: out.length });
    return out;
  }

  /** CPU: o que a Action / CLI corre. */
  async execute(runId: string): Promise<AgentRunRecord> {
    this.ensureSeeded();
    const run = agentRuns.get(runId);
    if (!run) throw new Error(`run não encontrada: ${runId}`);
    if (run.status === "done") return run;
    const agent = agents.get(run.agentId);
    if (!agent) throw new Error("agente em falta");
    const execution = run.executionId ? executions.get(run.executionId) : null;
    if (!execution) throw new Error("execução em falta");

    const hit = this.cacheGet(execution.cacheKey);
    if (hit) {
      const done: AgentRunRecord = {
        ...run,
        status: "done",
        steps: [
          {
            n: 0,
            name: "cas-hit",
            uses: "kernel.cache.get",
            status: "ok",
            input: { cacheKey: execution.cacheKey },
            output: { executionId: hit.id },
            path: ObjectPath.named("agentStep", { id: agent.id, runId, n: "0" }).resolve(),
            at: nowIso(),
          },
        ],
        result: { cacheHit: true, executionId: hit.id, cacheKey: execution.cacheKey },
        finishedAt: nowIso(),
      };
      agentRuns.upsert(done);
      executions.upsert({ ...execution, status: "cached", cacheHit: true, finishedAt: nowIso() });
      return done;
    }

    const jobs: JobState[] = [
      {
        id: "harness",
        name: "agentic-harness",
        status: "in_progress",
        startedAt: nowIso(),
        steps: [],
      },
    ];
    executions.upsert({
      ...execution,
      status: "in_runtime",
      startedAt: nowIso(),
      jobs,
      logs: execution.logs + "entering unique runtime space\n",
    });

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
    agentRuns.upsert({ ...run, status: "planning" });

    const steps = await runHarness({ kernel: this, agent, goal: run.goal, runId, execution });
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
      startedAt: execution.startedAt ?? nowIso(),
      finishedAt: nowIso(),
      jobs,
      logs: execution.logs + steps.map((s) => `[${s.uses}] ${s.name} → ${s.status}\n`).join(""),
    });

    const obj = this.resolveExecution(execution.id);
    const done: AgentRunRecord = {
      ...run,
      status: "done",
      steps,
      result: { objectPath: obj.path, executionId: execution.id, cacheKey: execution.cacheKey },
      finishedAt: nowIso(),
    };
    agentRuns.upsert(done);
    agents.setStatus(agent.id, "idle");
    this.journal("execute", obj.path, { runId, cacheKey: execution.cacheKey });
    return done;
  }

  /** CLI convenience: enqueue + execute (o runner é o CPU). */
  async runAgent(goal: string, agentId = "harness"): Promise<AgentRunRecord> {
    const queued = this.enqueueAgent(goal, agentId);
    if (queued.status === "done") return queued;
    return this.execute(queued.id);
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

  listRules() {
    this.ensureSeeded();
    return rules.list();
  }

  exportPublic() {
    this.ensureSeeded();
    const entries = publishObjects(this.ls("/"), this.listRules());
    this.journal("cdn.export", publicDir(), { n: entries.length });
    return { dir: publicDir(), n: entries.length, entries };
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
    const body = {
      id: obj.id,
      kind: obj.kind,
      path: obj.path,
      pattern: obj.pattern,
      payload: obj.payload,
      metadata: obj.metadata,
    };
    if (process.env.ACTOS_GITFS !== "0") {
      try {
        gitfs().write(obj.path, body);
      } catch {
        /* L3 origin is best-effort until git is available */
      }
    }
    try {
      l1Put(obj.path, body);
    } catch {
      /* L1 edge */
    }
  }

  private trace(name: string, args: unknown, result: unknown, p: string | null) {
    syscalls.insert(name, args, result, p);
  }
}

function stripLive(p: LiveProc): RuntimeProcess {
  const { expiresAtMs: _, ...rest } = p;
  return rest;
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
  "git.status": (k) => k.gitStatus(),
  "path.resolve": (k, a) =>
    k.resolvePath(String(a.pattern ?? PATTERNS.object), (a.params as Record<string, string>) ?? { kind: "blob", id: "x" }),
};

let singleton: Kernel | undefined;
export function getKernel(): Kernel {
  if (!singleton) singleton = new Kernel();
  return singleton;
}

export function resetKernel() {
  singleton = undefined;
  globalThis.__actosLive = undefined;
}
