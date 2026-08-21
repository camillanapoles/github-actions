import { db, nid, nowIso } from "./client";
import type {
  AgentRecord,
  AgentRunRecord,
  AgentStatus,
  AgentStep,
  ExecutionRecord,
  ExecutionStatus,
  JobState,
  JournalEvent,
  RuleRecord,
  RuntimeProcess,
  RuntimeSnapshot,
  StoredObjectRecord,
  SyscallRecord,
} from "@/domain/types";

function parse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export class ObjectRepo {
  get(id: string): StoredObjectRecord | null {
    const row = db()
      .prepare("SELECT * FROM objects WHERE id = ?")
      .get(id) as Record<string, string> | undefined;
    return row ? this.map(row) : null;
  }

  byPath(p: string): StoredObjectRecord | null {
    const row = db()
      .prepare("SELECT * FROM objects WHERE path = ?")
      .get(p) as Record<string, string> | undefined;
    return row ? this.map(row) : null;
  }

  list(opts?: { kind?: string; prefix?: string; limit?: number }): StoredObjectRecord[] {
    let sql = "SELECT * FROM objects WHERE 1=1";
    const args: string[] = [];
    if (opts?.kind) {
      sql += " AND kind = ?";
      args.push(opts.kind);
    }
    if (opts?.prefix) {
      sql += " AND path LIKE ?";
      args.push(`${opts.prefix}%`);
    }
    sql += " ORDER BY updated_at DESC LIMIT ?";
    args.push(String(opts?.limit ?? 200));
    const rows = db().prepare(sql).all(...args) as Record<string, string>[];
    return rows.map((r) => this.map(r));
  }

  upsert(obj: Omit<StoredObjectRecord, "createdAt" | "updatedAt"> & { createdAt?: string }): StoredObjectRecord {
    const existing = this.get(obj.id) ?? this.byPath(obj.path);
    const ts = nowIso();
    const createdAt = existing?.createdAt ?? obj.createdAt ?? ts;
    db()
      .prepare(
        `INSERT INTO objects (id, kind, path, pattern, payload, metadata, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           kind=excluded.kind, path=excluded.path, pattern=excluded.pattern,
           payload=excluded.payload, metadata=excluded.metadata, updated_at=excluded.updated_at`,
      )
      .run(
        obj.id,
        obj.kind,
        obj.path,
        obj.pattern,
        JSON.stringify(obj.payload),
        JSON.stringify(obj.metadata),
        createdAt,
        ts,
      );
    return this.get(obj.id)!;
  }

  delete(id: string): boolean {
    const res = db().prepare("DELETE FROM objects WHERE id = ?").run(id);
    return Number(res.changes) > 0;
  }

  kinds(): Array<{ kind: string; count: number }> {
    const rows = db()
      .prepare("SELECT kind, COUNT(*) as count FROM objects GROUP BY kind ORDER BY count DESC")
      .all() as Array<{ kind: string; count: number }>;
    return rows.map((r) => ({ kind: r.kind, count: Number(r.count) }));
  }

  private map(row: Record<string, string>): StoredObjectRecord {
    return {
      id: row.id,
      kind: row.kind,
      path: row.path,
      pattern: row.pattern,
      payload: parse(row.payload, {}),
      metadata: parse(row.metadata, {}),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export class ExecutionRepo {
  get(id: string): ExecutionRecord | null {
    const row = db()
      .prepare("SELECT * FROM executions WHERE id = ?")
      .get(id) as Record<string, unknown> | undefined;
    return row ? this.map(row) : null;
  }

  list(opts?: { status?: ExecutionStatus; workflow?: string; cached?: boolean; limit?: number }): ExecutionRecord[] {
    let sql = "SELECT * FROM executions WHERE 1=1";
    const args: Array<string | number> = [];
    if (opts?.status) {
      sql += " AND status = ?";
      args.push(opts.status);
    }
    if (opts?.workflow) {
      sql += " AND workflow = ?";
      args.push(opts.workflow);
    }
    if (opts?.cached) {
      sql += " AND status = 'cached'";
    }
    sql += " ORDER BY created_at DESC LIMIT ?";
    args.push(opts?.limit ?? 100);
    const rows = db().prepare(sql).all(...args) as Record<string, unknown>[];
    return rows.map((r) => this.map(r));
  }

  upsert(ex: ExecutionRecord): ExecutionRecord {
    db()
      .prepare(
        `INSERT INTO executions (
          id, run_id, workflow, event, status, conclusion, sha, branch, actor,
          cache_key, cache_hit, started_at, finished_at, jobs, logs, object_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          status=excluded.status, conclusion=excluded.conclusion, cache_hit=excluded.cache_hit,
          started_at=excluded.started_at, finished_at=excluded.finished_at, jobs=excluded.jobs,
          logs=excluded.logs, object_id=excluded.object_id`,
      )
      .run(
        ex.id,
        ex.runId,
        ex.workflow,
        ex.event,
        ex.status,
        ex.conclusion,
        ex.sha,
        ex.branch,
        ex.actor,
        ex.cacheKey,
        ex.cacheHit ? 1 : 0,
        ex.startedAt,
        ex.finishedAt,
        JSON.stringify(ex.jobs),
        ex.logs,
        ex.objectId,
        ex.createdAt,
      );
    return this.get(ex.id)!;
  }

  byCacheKey(key: string): ExecutionRecord | null {
    const row = db()
      .prepare("SELECT * FROM executions WHERE cache_key = ? AND status = 'cached' ORDER BY created_at DESC LIMIT 1")
      .get(key) as Record<string, unknown> | undefined;
    return row ? this.map(row) : null;
  }

  stats() {
    const rows = db()
      .prepare("SELECT status, COUNT(*) as c FROM executions GROUP BY status")
      .all() as Array<{ status: string; c: number }>;
    const byStatus: Record<string, number> = {};
    for (const r of rows) byStatus[r.status] = Number(r.c);
    const hits = db()
      .prepare("SELECT COUNT(*) as c FROM executions WHERE cache_hit = 1")
      .get() as { c: number };
    return { byStatus, cacheHits: Number(hits.c), total: Object.values(byStatus).reduce((a, b) => a + b, 0) };
  }

  private map(row: Record<string, unknown>): ExecutionRecord {
    return {
      id: String(row.id),
      runId: String(row.run_id),
      workflow: String(row.workflow),
      event: String(row.event),
      status: row.status as ExecutionStatus,
      conclusion: row.conclusion ? String(row.conclusion) : null,
      sha: String(row.sha),
      branch: String(row.branch),
      actor: String(row.actor),
      cacheKey: String(row.cache_key),
      cacheHit: Boolean(Number(row.cache_hit)),
      startedAt: row.started_at ? String(row.started_at) : null,
      finishedAt: row.finished_at ? String(row.finished_at) : null,
      jobs: parse<JobState[]>(String(row.jobs), []),
      logs: String(row.logs ?? ""),
      objectId: row.object_id ? String(row.object_id) : null,
      createdAt: String(row.created_at),
    };
  }
}

export class RuleRepo {
  list(): RuleRecord[] {
    const rows = db()
      .prepare("SELECT * FROM rules ORDER BY priority DESC")
      .all() as Record<string, unknown>[];
    return rows.map((r) => this.map(r));
  }

  get(id: string): RuleRecord | null {
    const row = db().prepare("SELECT * FROM rules WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    return row ? this.map(row) : null;
  }

  upsert(rule: RuleRecord): RuleRecord {
    db()
      .prepare(
        `INSERT INTO rules (id, name, match_pattern, op, effect, transform, priority, enabled)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name=excluded.name, match_pattern=excluded.match_pattern, op=excluded.op,
           effect=excluded.effect, transform=excluded.transform, priority=excluded.priority,
           enabled=excluded.enabled`,
      )
      .run(
        rule.id,
        rule.name,
        rule.matchPattern,
        rule.op,
        rule.effect,
        rule.transform,
        rule.priority,
        rule.enabled ? 1 : 0,
      );
    return this.get(rule.id)!;
  }

  delete(id: string): boolean {
    return Number(db().prepare("DELETE FROM rules WHERE id = ?").run(id).changes) > 0;
  }

  private map(row: Record<string, unknown>): RuleRecord {
    return {
      id: String(row.id),
      name: String(row.name),
      matchPattern: String(row.match_pattern),
      op: row.op as RuleRecord["op"],
      effect: row.effect as RuleRecord["effect"],
      transform: row.transform ? String(row.transform) : null,
      priority: Number(row.priority),
      enabled: Boolean(Number(row.enabled)),
    };
  }
}

export class AgentRepo {
  list(): AgentRecord[] {
    return (db().prepare("SELECT * FROM agents ORDER BY created_at").all() as Record<string, unknown>[]).map((r) =>
      this.map(r),
    );
  }

  get(id: string): AgentRecord | null {
    const row = db().prepare("SELECT * FROM agents WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    return row ? this.map(row) : null;
  }

  upsert(a: AgentRecord): AgentRecord {
    db()
      .prepare(
        `INSERT INTO agents (id, name, role, workflow, status, memory_paths, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name, role=excluded.role,
           workflow=excluded.workflow, status=excluded.status, memory_paths=excluded.memory_paths`,
      )
      .run(a.id, a.name, a.role, a.workflow, a.status, JSON.stringify(a.memoryPaths), a.createdAt);
    return this.get(a.id)!;
  }

  setStatus(id: string, status: AgentStatus) {
    db().prepare("UPDATE agents SET status = ? WHERE id = ?").run(status, id);
  }

  private map(row: Record<string, unknown>): AgentRecord {
    return {
      id: String(row.id),
      name: String(row.name),
      role: String(row.role),
      workflow: String(row.workflow),
      status: row.status as AgentStatus,
      memoryPaths: parse(String(row.memory_paths), []),
      createdAt: String(row.created_at),
    };
  }
}

export class AgentRunRepo {
  list(agentId?: string): AgentRunRecord[] {
    const rows = agentId
      ? (db()
          .prepare("SELECT * FROM agent_runs WHERE agent_id = ? ORDER BY created_at DESC")
          .all(agentId) as Record<string, unknown>[])
      : (db().prepare("SELECT * FROM agent_runs ORDER BY created_at DESC LIMIT 50").all() as Record<string, unknown>[]);
    return rows.map((r) => this.map(r));
  }

  get(id: string): AgentRunRecord | null {
    const row = db().prepare("SELECT * FROM agent_runs WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    return row ? this.map(row) : null;
  }

  queued(limit = 16): AgentRunRecord[] {
    const rows = db()
      .prepare("SELECT * FROM agent_runs WHERE status = 'queued' ORDER BY created_at ASC LIMIT ?")
      .all(limit) as Record<string, unknown>[];
    return rows.map((r) => this.map(r));
  }

  upsert(run: AgentRunRecord): AgentRunRecord {
    db()
      .prepare(
        `INSERT INTO agent_runs (id, agent_id, goal, status, execution_id, steps, result, created_at, finished_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET status=excluded.status, execution_id=excluded.execution_id,
           steps=excluded.steps, result=excluded.result, finished_at=excluded.finished_at`,
      )
      .run(
        run.id,
        run.agentId,
        run.goal,
        run.status,
        run.executionId,
        JSON.stringify(run.steps),
        JSON.stringify(run.result),
        run.createdAt,
        run.finishedAt,
      );
    return this.get(run.id)!;
  }

  private map(row: Record<string, unknown>): AgentRunRecord {
    return {
      id: String(row.id),
      agentId: String(row.agent_id),
      goal: String(row.goal),
      status: row.status as AgentStatus,
      executionId: row.execution_id ? String(row.execution_id) : null,
      steps: parse<AgentStep[]>(String(row.steps), []),
      result: parse(row.result ? String(row.result) : null, null),
      createdAt: String(row.created_at),
      finishedAt: row.finished_at ? String(row.finished_at) : null,
    };
  }
}

export class RuntimeRepo {
  snapshot(): RuntimeSnapshot {
    const row = db()
      .prepare("SELECT * FROM runtime_space WHERE id = 'kernel'")
      .get() as Record<string, string>;
    return {
      id: "kernel",
      processes: parse<RuntimeProcess[]>(row.processes, []),
      updatedAt: row.updated_at,
    };
  }

  save(processes: RuntimeProcess[]): RuntimeSnapshot {
    const ts = nowIso();
    db()
      .prepare("UPDATE runtime_space SET processes = ?, updated_at = ? WHERE id = 'kernel'")
      .run(JSON.stringify(processes), ts);
    return { id: "kernel", processes, updatedAt: ts };
  }
}

export class SyscallRepo {
  list(limit = 40): SyscallRecord[] {
    const rows = db()
      .prepare("SELECT * FROM syscalls ORDER BY created_at DESC LIMIT ?")
      .all(limit) as Record<string, unknown>[];
    return rows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      args: parse(String(r.args), {}),
      result: parse(r.result ? String(r.result) : null, null),
      path: r.path ? String(r.path) : null,
      createdAt: String(r.created_at),
    }));
  }

  insert(name: string, args: unknown, result: unknown, path: string | null): SyscallRecord {
    const rec: SyscallRecord = {
      id: nid("sys"),
      name,
      args,
      result,
      path,
      createdAt: nowIso(),
    };
    db()
      .prepare("INSERT INTO syscalls (id, name, args, result, path, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(rec.id, rec.name, JSON.stringify(args), JSON.stringify(result), path, rec.createdAt);
    return rec;
  }
}

export class EventRepo {
  append(op: string, path: string | null, payload: unknown): JournalEvent {
    const row = db().prepare("SELECT COALESCE(MAX(seq), 0) as s FROM events").get() as { s: number };
    const rec: JournalEvent = {
      id: nid("ev"),
      seq: Number(row.s) + 1,
      op,
      path,
      payload,
      at: nowIso(),
    };
    db()
      .prepare("INSERT INTO events (id, seq, op, path, payload, at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(rec.id, rec.seq, rec.op, path, JSON.stringify(payload), rec.at);
    return rec;
  }

  list(limit = 80): JournalEvent[] {
    const rows = db()
      .prepare("SELECT * FROM events ORDER BY seq DESC LIMIT ?")
      .all(limit) as Record<string, unknown>[];
    return rows.map((r) => ({
      id: String(r.id),
      seq: Number(r.seq),
      op: String(r.op),
      path: r.path ? String(r.path) : null,
      payload: parse(String(r.payload), {}),
      at: String(r.at),
    }));
  }
}

export const objects = new ObjectRepo();
export const executions = new ExecutionRepo();
export const rules = new RuleRepo();
export const agents = new AgentRepo();
export const agentRuns = new AgentRunRepo();
export const runtime = new RuntimeRepo();
export const syscalls = new SyscallRepo();
export const events = new EventRepo();
