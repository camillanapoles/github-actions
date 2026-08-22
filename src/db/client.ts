import fs from "node:fs";
import path from "node:path";
import { FileDb } from "./file-db";

type DbLike = {
  exec(sql: string): void;
  prepare(sql: string): {
    run: (...args: unknown[]) => { changes?: number };
    get: (...args: unknown[]) => unknown;
    all: (...args: unknown[]) => unknown[];
  };
  close?: () => void;
};

function dataDir() {
  return path.dirname(dbPath());
}
function dbPath() {
  return process.env.ACTOS_DB || path.join(process.cwd(), "data", "actos.db");
}

declare global {
  // eslint-disable-next-line no-var
  var __actosDb: DbLike | undefined;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS objects (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  pattern TEXT NOT NULL,
  payload TEXT NOT NULL,
  metadata TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_objects_kind ON objects(kind);
CREATE INDEX IF NOT EXISTS idx_objects_pattern ON objects(pattern);

CREATE TABLE IF NOT EXISTS executions (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  workflow TEXT NOT NULL,
  event TEXT NOT NULL,
  status TEXT NOT NULL,
  conclusion TEXT,
  sha TEXT NOT NULL,
  branch TEXT NOT NULL,
  actor TEXT NOT NULL,
  cache_key TEXT NOT NULL,
  cache_hit INTEGER NOT NULL DEFAULT 0,
  started_at TEXT,
  finished_at TEXT,
  jobs TEXT NOT NULL,
  logs TEXT NOT NULL DEFAULT '',
  object_id TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_exec_status ON executions(status);
CREATE INDEX IF NOT EXISTS idx_exec_workflow ON executions(workflow);

CREATE TABLE IF NOT EXISTS runtime_space (
  id TEXT PRIMARY KEY,
  processes TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  match_pattern TEXT NOT NULL,
  op TEXT NOT NULL,
  effect TEXT NOT NULL,
  transform TEXT,
  priority INTEGER NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  workflow TEXT NOT NULL,
  status TEXT NOT NULL,
  memory_paths TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_runs (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  goal TEXT NOT NULL,
  status TEXT NOT NULL,
  execution_id TEXT,
  steps TEXT NOT NULL,
  result TEXT,
  created_at TEXT NOT NULL,
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS syscalls (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  args TEXT NOT NULL,
  result TEXT,
  path TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  seq INTEGER NOT NULL,
  op TEXT NOT NULL,
  path TEXT,
  payload TEXT NOT NULL,
  at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_seq ON events(seq);
`;

export function db(): DbLike {
  if (globalThis.__actosDb) return globalThis.__actosDb;
  fs.mkdirSync(dataDir(), { recursive: true });
  let instance: DbLike;
  if (process.env.ACTOS_FILEDB === "1") {
    instance = new FileDb(dbPath() + ".json");
  } else {
    try {
      // Node 22+: experimental. Node 20 (Actions default / gh-aw engines) has no node:sqlite.
      const { DatabaseSync } = require("node:sqlite") as { DatabaseSync: new (p: string) => DbLike };
      instance = new DatabaseSync(dbPath());
    } catch {
      instance = new FileDb(dbPath() + ".json");
    }
  }
  instance.exec(SCHEMA);
  instance.exec("INSERT OR IGNORE INTO runtime_space (id, processes, updated_at) VALUES ('kernel', '[]', datetime('now'))");
  globalThis.__actosDb = instance;
  return instance;
}

export function resetDb() {
  try {
    globalThis.__actosDb?.close?.();
  } catch {
    /* */
  }
  globalThis.__actosDb = undefined;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function nid(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}

export function tx<T>(fn: () => T): T {
  const d = db();
  d.exec("BEGIN");
  try {
    const out = fn();
    d.exec("COMMIT");
    return out;
  } catch (err) {
    try {
      d.exec("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw err;
  }
}
