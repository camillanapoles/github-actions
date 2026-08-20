import { nid, nowIso } from "./client";
import { agentRuns, agents, executions, objects, rules, runtime } from "./repo";
import { ObjectPath, PATTERNS } from "@/domain/path";
import type { ExecutionRecord, JobState, RuntimeProcess } from "@/domain/types";

export function seedIfEmpty() {
  if (objects.list({ limit: 1 }).length > 0) return;
  seed();
}

export function seed() {
  const ts = nowIso();

  rules.upsert({
    id: "allow-objects",
    name: "objetos públicos",
    matchPattern: "/objects/**",
    op: "*",
    effect: "allow",
    transform: null,
    priority: 10,
    enabled: true,
  });
  rules.upsert({
    id: "allow-cache",
    name: "cache de execuções",
    matchPattern: "/cache/**",
    op: "read",
    effect: "allow",
    transform: null,
    priority: 20,
    enabled: true,
  });
  rules.upsert({
    id: "redact-runtime-logs",
    name: "redact logs em runtime",
    matchPattern: "/runtime/**",
    op: "read",
    effect: "transform",
    transform: "redact-logs",
    priority: 40,
    enabled: true,
  });
  rules.upsert({
    id: "deny-sys-write",
    name: "sys é imutável",
    matchPattern: "/sys/**",
    op: "write",
    effect: "deny",
    transform: null,
    priority: 90,
    enabled: true,
  });
  rules.upsert({
    id: "strip-secrets",
    name: "strip secrets em agent-step",
    matchPattern: "/agents/**/steps/**",
    op: "read",
    effect: "transform",
    transform: "strip-secrets",
    priority: 50,
    enabled: true,
  });
  ensureArenaSessionRule();

  agents.upsert({
    id: "harness",
    name: "Harness",
    role: "Agente de workflow. Corre como GitHub Action; o backend é o kernel.",
    workflow: "agent-harness.yml",
    status: "idle",
    memoryPaths: ["/objects", "/cache", "/runtime"],
    createdAt: ts,
  });
  agents.upsert({
    id: "cache-weaver",
    name: "Cache Weaver",
    role: "Lê execuções resolvidas e as tece em objetos cacheados.",
    workflow: "cache-executions.yml",
    status: "idle",
    memoryPaths: ["/cache", "/objects/execution"],
    createdAt: ts,
  });

  const workflows = [
    { file: "ci.yml", event: "push" },
    { file: "agent-harness.yml", event: "workflow_dispatch" },
    { file: "runtime-persist.yml", event: "workflow_run" },
    { file: "cache-executions.yml", event: "schedule" },
  ];

  const shas = [
    "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678",
    "b2c3d4e5f60718293a4b5c6d7e8f90123456789a",
    "c3d4e5f60718293a4b5c6d7e8f90123456789abc",
    "d4e5f60718293a4b5c6d7e8f90123456789abcde",
  ];

  const processes: RuntimeProcess[] = [];

  for (let i = 0; i < 12; i++) {
    const wf = workflows[i % workflows.length];
    const sha = shas[i % shas.length];
    const id = `ex_${(1000 + i).toString(36)}`;
    const runId = `98765${100 + i}`;
    const cacheHit = i % 3 === 0;
    const inRuntime = i === 1 || i === 5;
    const failed = i === 8;
    const jobs = makeJobs(wf.file, failed, inRuntime);
    const status = inRuntime ? "in_runtime" : failed ? "failed" : "cached";
    const created = new Date(Date.now() - (12 - i) * 3600_000).toISOString();
    const started = new Date(Date.parse(created) + 2000).toISOString();
    const finished = inRuntime ? null : new Date(Date.parse(started) + 40_000 + i * 1200).toISOString();
    const cacheKey = `actos-${wf.file}-${sha.slice(0, 12)}-${i % 4}`;

    const rec: ExecutionRecord = {
      id,
      runId,
      workflow: wf.file,
      event: wf.event,
      status,
      conclusion: inRuntime ? null : failed ? "failure" : "success",
      sha,
      branch: i % 2 === 0 ? "main" : "arena/01a01e33-github-actions",
      actor: i % 2 === 0 ? "camillanapoles" : "actos-bot",
      cacheKey,
      cacheHit,
      startedAt: started,
      finishedAt: finished,
      jobs,
      logs: logFor(wf.file, status, cacheHit),
      objectId: null,
      createdAt: created,
    };

    if (status === "cached" || status === "failed") {
      const obj = objects.upsert({
        id,
        kind: "execution",
        path: ObjectPath.named("object", { kind: "execution", id }).resolve(),
        pattern: PATTERNS.object,
        payload: rec,
        metadata: { cacheKey, runId },
        createdAt: created,
      });
      rec.objectId = obj.id;
      objects.upsert({
        id: `cache_${id}`,
        kind: "cache",
        path: ObjectPath.named("cache", { workflow: wf.file, sha, id }).resolve(),
        pattern: PATTERNS.cache,
        payload: {
          hit: cacheHit,
          executionId: id,
          workflow: wf.file,
          sha,
          conclusion: rec.conclusion,
        },
        metadata: { source: "seed" },
        createdAt: created,
      });
    } else {
      processes.push({
        pid: runId,
        runId,
        workflow: wf.file,
        kind: wf.file.includes("agent") ? "agent" : "action",
        status: "running",
        startedAt: started,
        path: ObjectPath.named("runtimeRun", { id: runId }).resolve(),
        memoryHint: `${jobs.length} jobs`,
      });
    }
    executions.upsert(rec);
  }

  runtime.save(processes);

  objects.upsert({
    id: "manifest",
    kind: "manifest",
    path: "/objects/manifest/kernel",
    pattern: PATTERNS.object,
    payload: {
      name: "ACTOS",
      analogy: "GitHub Actions ≡ sistema operacional",
      uniqueSpace: "runtime",
      afterResolve: "tudo é objeto, path = pattern + id, depois regras",
    },
    metadata: { system: true },
    createdAt: ts,
  });

  agentRuns.upsert({
    id: "arun_seed",
    agentId: "harness",
    goal: "Indexar execuções cacheadas e montar o espaço único.",
    status: "done",
    executionId: "ex_rsc",
    steps: [
      {
        n: 1,
        name: "plan/Inspecionar espaço único",
        uses: "kernel.ps",
        status: "ok",
        input: {},
        output: { processes: processes.length },
        path: "/agents/harness/runs/arun_seed/steps/1",
        at: ts,
      },
      {
        n: 2,
        name: "resolve/Cachear resultado",
        uses: "kernel.cache.put",
        status: "ok",
        input: {},
        output: { ok: true },
        path: "/agents/harness/runs/arun_seed/steps/2",
        at: ts,
      },
    ],
    result: { seeded: true },
    createdAt: ts,
    finishedAt: ts,
  });
}

export function ensureArenaSessionRule() {
  rules.upsert({
    id: "arena-session",
    name: "arena-agent: não merge enquanto itera",
    matchPattern: "/runtime/**",
    op: "exec",
    effect: "allow",
    transform: null,
    priority: 100,
    enabled: true,
  });
  objects.upsert({
    id: "arena-session",
    kind: "rule-doc",
    path: "/objects/rule-doc/arena-session",
    pattern: PATTERNS.object,
    payload: {
      tag: "arena-agent",
      auto: "commit+push only arena/<session>",
      endWhen: ["merge", "fim", "fechar", "encerrar"],
      nonCommit: "PR comment + UI banner + Action summary",
      doNot: "apagar o ramo arena/… nem trabalhar noutro branch",
    },
    metadata: { tag: "arena-agent", system: true },
  });
}

function makeJobs(workflow: string, failed: boolean, running: boolean): JobState[] {
  return [
    {
      id: "job_1",
      name: workflow.replace(".yml", ""),
      status: running ? "in_progress" : failed ? "failed" : "completed",
      conclusion: running ? undefined : failed ? "failure" : "success",
      startedAt: nowIso(),
      finishedAt: running ? undefined : nowIso(),
      steps: [
        { name: "Set up job", conclusion: "success", durationMs: 420 },
        { name: "Checkout", conclusion: "success", durationMs: 1100 },
        { name: "Run harness / persist", conclusion: failed ? "failure" : running ? "in_progress" : "success", durationMs: 8400 },
        { name: "Upload objects (pattern+id)", conclusion: running ? "queued" : "success", durationMs: 600 },
      ],
    },
  ];
}

function logFor(workflow: string, status: string, cacheHit: boolean): string {
  return [
    `##[group] ${workflow}`,
    cacheHit ? "Cache hit for key actos-*" : "Cache miss — entering unique runtime space",
    `status=${status}`,
    "Write objects at /objects/{kind}/{id}",
    "Apply rules on path",
    status === "in_runtime" ? "ainda no espaço único (RAM analog)" : "resolved → objeto persistido",
    "##[endgroup]",
  ].join("\n");
}

const isMain = process.argv[1]?.includes("seed");
if (isMain) {
  seed();
  console.log("ACTOS db seeded.");
}
