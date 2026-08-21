export type ExecutionStatus =
  | "queued"
  | "in_runtime"
  | "resolved"
  | "cached"
  | "failed";

export type AgentStatus =
  | "queued"
  | "idle"
  | "planning"
  | "acting"
  | "persisting"
  | "done"
  | "sliced"
  | "failed";

export type RuleOp = "read" | "write" | "exec" | "*";
export type RuleEffect = "allow" | "deny" | "transform";

export type JobState = {
  id: string;
  name: string;
  status: "queued" | "in_progress" | "completed" | "failed";
  conclusion?: string;
  startedAt?: string;
  finishedAt?: string;
  steps: Array<{
    name: string;
    conclusion: string;
    durationMs: number;
  }>;
};

export type ExecutionRecord = {
  id: string;
  runId: string;
  workflow: string;
  event: string;
  status: ExecutionStatus;
  conclusion: string | null;
  sha: string;
  branch: string;
  actor: string;
  cacheKey: string;
  cacheHit: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  jobs: JobState[];
  logs: string;
  objectId: string | null;
  createdAt: string;
};

export type StoredObjectRecord = {
  id: string;
  kind: string;
  path: string;
  pattern: string;
  payload: unknown;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type RuleRecord = {
  id: string;
  name: string;
  matchPattern: string;
  op: RuleOp;
  effect: RuleEffect;
  transform: string | null;
  priority: number;
  enabled: boolean;
};

export type AgentRecord = {
  id: string;
  name: string;
  role: string;
  workflow: string;
  status: AgentStatus;
  memoryPaths: string[];
  createdAt: string;
};

export type AgentStep = {
  n: number;
  name: string;
  uses: string;
  status: "ok" | "skip" | "fail";
  input: unknown;
  output: unknown;
  path: string;
  at: string;
};

export type AgentRunRecord = {
  id: string;
  agentId: string;
  goal: string;
  status: AgentStatus;
  executionId: string | null;
  steps: AgentStep[];
  result: unknown;
  createdAt: string;
  finishedAt: string | null;
};

export type RuntimeProcess = {
  pid: string;
  runId: string;
  ppid?: string;
  workflow: string;
  kind: "action" | "agent";
  status: "running" | "sleeping" | "zombie";
  startedAt: string;
  expiresAt?: string;
  path: string;
  memoryHint: string;
};

export type JournalEvent = {
  id: string;
  seq: number;
  op: string;
  path: string | null;
  payload: unknown;
  at: string;
};

export type RuntimeSnapshot = {
  id: string;
  processes: RuntimeProcess[];
  updatedAt: string;
};

export type SyscallRecord = {
  id: string;
  name: string;
  args: unknown;
  result: unknown;
  path: string | null;
  createdAt: string;
};

export type RuleDecision = {
  allowed: boolean;
  ruleId: string | null;
  effect: RuleEffect;
  reason: string;
  transformed?: unknown;
};
