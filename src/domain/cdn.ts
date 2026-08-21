/**
 * CDN layers inside the GitHub workspace.
 *
 *   L1  .actos-l1/{sha}/     Actions-cache analog (7d LRU, edge)
 *   L2  data/tickets/{id}    artifact analog — POINTER only {sha, path, runId}
 *   L3  gitfs / actos/fs     origin
 *
 * Never treat L1 as truth. PR must not become origin (save L1 only as shortcut).
 */
import fs from "node:fs";
import path from "node:path";
import { cas } from "./cas";

const ROOT = process.cwd();
const L1_DIR = path.join(ROOT, ".actos-l1");
const L2_DIR = path.join(ROOT, "data", "tickets");
const INDEX = path.join(L1_DIR, "index.json");

const L1_TTL_MS = 7 * 24 * 3600 * 1000;
const PROMOTE_AFTER_MS = 5 * 24 * 3600 * 1000;

export type L1Entry = {
  sha: string;
  path: string;
  at: string;
  hits: number;
  bytes: number;
};

export type L2Ticket = {
  sha: string;
  path: string;
  runId: string;
  at: string;
};

export type CdnStats = {
  l1: { entries: number; bytes: number; hits: number };
  l2: { tickets: number };
  ttlMs: number;
};

type IndexFile = { entries: Record<string, L1Entry> };

function loadIndex(): IndexFile {
  try {
    return JSON.parse(fs.readFileSync(INDEX, "utf8")) as IndexFile;
  } catch {
    return { entries: {} };
  }
}

function saveIndex(idx: IndexFile) {
  fs.mkdirSync(L1_DIR, { recursive: true });
  fs.writeFileSync(INDEX, JSON.stringify(idx, null, 2));
}

export function l1Key(body: unknown, objectPath: string): string {
  return cas("l1", objectPath, JSON.stringify(body));
}

export function l1Put(objectPath: string, body: unknown): L1Entry {
  const sha = l1Key(body, objectPath);
  const dir = path.join(L1_DIR, sha);
  fs.mkdirSync(dir, { recursive: true });
  const raw = JSON.stringify({ path: objectPath, body }, null, 2);
  fs.writeFileSync(path.join(dir, "payload.json"), raw);
  const idx = loadIndex();
  const prev = idx.entries[sha];
  const entry: L1Entry = {
    sha,
    path: objectPath,
    at: new Date().toISOString(),
    hits: (prev?.hits ?? 0) + 1,
    bytes: raw.length,
  };
  idx.entries[sha] = entry;
  saveIndex(idx);
  return entry;
}

export function l1Get(sha: string): { path: string; body: unknown; entry: L1Entry } | null {
  const idx = loadIndex();
  const entry = idx.entries[sha];
  if (!entry) return null;
  if (Date.now() - Date.parse(entry.at) > L1_TTL_MS) {
    l1Evict(sha);
    return null;
  }
  const file = path.join(L1_DIR, sha, "payload.json");
  if (!fs.existsSync(file)) {
    l1Evict(sha);
    return null;
  }
  const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as { path: string; body: unknown };
  entry.hits += 1;
  entry.at = new Date().toISOString();
  idx.entries[sha] = entry;
  saveIndex(idx);
  return { ...parsed, entry };
}

export function l1GetByPath(objectPath: string): { path: string; body: unknown; entry: L1Entry } | null {
  const idx = loadIndex();
  const found = Object.values(idx.entries).find((e) => e.path === objectPath);
  if (!found) return null;
  return l1Get(found.sha);
}

export function l1Evict(sha: string) {
  const idx = loadIndex();
  delete idx.entries[sha];
  saveIndex(idx);
  const dir = path.join(L1_DIR, sha);
  fs.rmSync(dir, { recursive: true, force: true });
}

export function l2Put(ticket: Omit<L2Ticket, "at">): L2Ticket {
  fs.mkdirSync(L2_DIR, { recursive: true });
  const rec: L2Ticket = { ...ticket, at: new Date().toISOString() };
  fs.writeFileSync(path.join(L2_DIR, `${ticket.runId}.json`), JSON.stringify(rec, null, 2));
  return rec;
}

export function l2List(): L2Ticket[] {
  if (!fs.existsSync(L2_DIR)) return [];
  return fs
    .readdirSync(L2_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(L2_DIR, f), "utf8")) as L2Ticket);
}

export function gc(now = Date.now()): { evicted: string[]; promote: L1Entry[] } {
  const idx = loadIndex();
  const evicted: string[] = [];
  const promote: L1Entry[] = [];
  for (const [sha, e] of Object.entries(idx.entries)) {
    const age = now - Date.parse(e.at);
    if (age > L1_TTL_MS) {
      evicted.push(sha);
      continue;
    }
    if (age > PROMOTE_AFTER_MS && e.hits > 0) promote.push(e);
  }
  for (const sha of evicted) l1Evict(sha);
  return { evicted, promote };
}

export function cdnStats(): CdnStats {
  const idx = loadIndex();
  const entries = Object.values(idx.entries);
  return {
    l1: {
      entries: entries.length,
      bytes: entries.reduce((a, e) => a + e.bytes, 0),
      hits: entries.reduce((a, e) => a + e.hits, 0),
    },
    l2: { tickets: l2List().length },
    ttlMs: L1_TTL_MS,
  };
}

export function l1List(): L1Entry[] {
  return Object.values(loadIndex().entries).sort((a, b) => b.hits - a.hits);
}

export const CDN_PATHS = { L1_DIR, L2_DIR, L1_TTL_MS, PROMOTE_AFTER_MS };
