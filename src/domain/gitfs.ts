/**
 * GitFs — L3 origin (Puter analog: LL provider / UUID blob store).
 *
 * Never checks out another branch (Arena session stays on arena/…).
 * Uses GIT_WORK_TREE + commit-tree + update-ref.
 *
 *   refs/heads/actos/fs           disco (append-only)
 *   refs/actos/runtime/{pid}      /proc (force-update; delete = unmount)
 *
 * Contract: if origin/actos/fs exists, ATTACH to it. Never mint a second
 * orphan — that is the 14-ahead / frozen-disk failure mode.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BRANCH = "refs/heads/actos/fs";
const REMOTE = "origin";

export type GitFsStatus = {
  head: string | null;
  files: number;
  runtimeRefs: string[];
  workTree: string;
  attached: boolean;
  remoteHead: string | null;
};

function dirs() {
  return {
    gitDir: process.env.ACTOS_GIT_DIR || path.join(ROOT, ".git"),
    work: process.env.ACTOS_FS_WORK || path.join(ROOT, ".actos-fs"),
    index: process.env.ACTOS_FS_INDEX || path.join(ROOT, ".actos-fs-index"),
  };
}

function git(args: string[], opts?: { input?: string; env?: NodeJS.ProcessEnv }): { ok: boolean; out: string; err: string } {
  const { gitDir } = dirs();
  const r = spawnSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
    input: opts?.input,
    env: {
      ...process.env,
      GIT_DIR: gitDir,
      GIT_AUTHOR_NAME: "actos-kernel",
      GIT_AUTHOR_EMAIL: "actos@localhost",
      GIT_COMMITTER_NAME: "actos-kernel",
      GIT_COMMITTER_EMAIL: "actos@localhost",
      ...(opts?.env ?? {}),
    },
  });
  return {
    ok: r.status === 0,
    out: (r.stdout ?? "").trim(),
    err: (r.stderr ?? "").trim(),
  };
}

function wtEnv(): NodeJS.ProcessEnv {
  const { gitDir, work, index } = dirs();
  return {
    ...process.env,
    GIT_DIR: gitDir,
    GIT_WORK_TREE: work,
    GIT_INDEX_FILE: index,
  };
}

function emptyTree(): string {
  const r = git(["mktree"], { input: "" });
  if (r.ok && r.out) return r.out;
  const hashed = git(["hash-object", "-t", "tree", "/dev/null"]);
  if (hashed.ok && hashed.out) return hashed.out;
  throw new Error(`gitfs: empty tree failed ${r.err}`);
}

function relFile(objectPath: string): string {
  return objectPath.replace(/^\//, "") + ".json";
}

export class GitFs {
  /** Fast-forward local BRANCH from origin. Never force. */
  attach(): { head: string | null; fetched: boolean; error?: string } {
    const fetch = git(["fetch", REMOTE, `${BRANCH}:${BRANCH}`]);
    if (fetch.ok) {
      const head = this.head();
      return { head, fetched: true };
    }
    const existing = this.head();
    return { head: existing, fetched: false, error: fetch.err || fetch.out };
  }

  ensure(): string {
    const existing = git(["rev-parse", "--verify", BRANCH]);
    if (existing.ok) return existing.out;
    const attached = this.attach();
    if (attached.head) return attached.head;
    const tree = emptyTree();
    const commit = git(["commit-tree", tree, "-m", "actos/fs: origin (empty VFS)"]);
    if (!commit.ok) throw new Error(`gitfs init: ${commit.err}`);
    git(["update-ref", BRANCH, commit.out]);
    return commit.out;
  }

  head(): string | null {
    const r = git(["rev-parse", "--verify", BRANCH]);
    return r.ok ? r.out : null;
  }

  remoteHead(): string | null {
    const r = git(["ls-remote", "--heads", REMOTE, "actos/fs"]);
    if (!r.ok || !r.out) return null;
    return r.out.split(/\s+/)[0] || null;
  }

  write(objectPath: string, body: unknown, message?: string): { head: string; file: string } {
    this.materializeWorktree();
    const { work } = dirs();
    const rel = relFile(objectPath);
    const file = path.join(work, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(body, null, 2));
    git(["add", "-A", "--", rel], { env: wtEnv() });
    return this.commit(message ?? `write ${objectPath}`);
  }

  unlink(objectPath: string): { head: string } | null {
    if (!this.head()) return null;
    this.materializeWorktree();
    const { work } = dirs();
    const rel = relFile(objectPath);
    const file = path.join(work, rel);
    if (fs.existsSync(file)) fs.unlinkSync(file);
    git(["add", "-A", "--", rel], { env: wtEnv() });
    return this.commit(`unlink ${objectPath}`);
  }

  read(objectPath: string): unknown | null {
    if (!this.head()) return null;
    const rel = relFile(objectPath);
    const r = git(["show", `${BRANCH}:${rel}`]);
    if (!r.ok) return null;
    try {
      return JSON.parse(r.out);
    } catch {
      return r.out;
    }
  }

  mountRef(pid: string, payload: unknown): string {
    const blob = git(["hash-object", "-w", "--stdin"], { input: JSON.stringify(payload) });
    if (!blob.ok) throw new Error(blob.err);
    const treeIn = `100644 blob ${blob.out}\tproc.json\n`;
    const tree = git(["mktree"], { input: treeIn });
    if (!tree.ok) throw new Error(tree.err);
    const commit = git(["commit-tree", tree.out, "-m", `mount ${pid}`]);
    if (!commit.ok) throw new Error(commit.err);
    git(["update-ref", `refs/actos/runtime/${pid}`, commit.out]);
    return commit.out;
  }

  unmountRef(pid: string): void {
    git(["update-ref", "-d", `refs/actos/runtime/${pid}`]);
  }

  ls(prefix = ""): string[] {
    if (!this.head()) return [];
    const r = git(["ls-tree", "-r", "--name-only", BRANCH]);
    if (!r.ok || !r.out) return [];
    const pref = prefix && prefix !== "/" ? prefix.replace(/\/$/, "") : "";
    return r.out
      .split("\n")
      .filter(Boolean)
      .map((rel) => "/" + rel.replace(/\.json$/, ""))
      .filter((p) => !pref || p === pref || p.startsWith(pref + "/"))
      .sort();
  }

  status(): GitFsStatus {
    const refs = git(["for-each-ref", "--format=%(refname)", "refs/actos/runtime"]);
    const head = this.head();
    return {
      head,
      files: this.ls().length,
      runtimeRefs: refs.ok && refs.out ? refs.out.split("\n").filter(Boolean) : [],
      workTree: dirs().work,
      attached: Boolean(head),
      remoteHead: this.remoteHead(),
    };
  }

  push(): { ok: boolean; out: string; head: string | null } {
    this.ensure();
    const attached = this.attach();
    const head = this.head();
    if (!head) return { ok: false, out: "gitfs: no local actos/fs", head: null };
    const remote = this.remoteHead();
    if (remote && remote !== head) {
      const ancestor = git(["merge-base", "--is-ancestor", remote, head]);
      if (!ancestor.ok) {
        return {
          ok: false,
          out: `gitfs: refuse non-ff push (local ${head.slice(0, 7)} vs origin ${remote.slice(0, 7)}). attach first; never force-push actos/fs.`,
          head,
        };
      }
    }
    const r = git(["push", REMOTE, `${BRANCH}:${BRANCH}`]);
    return { ok: r.ok, out: r.ok ? (attached.head ?? head) : r.err || r.out, head };
  }

  private materializeWorktree() {
    this.ensure();
    const { work } = dirs();
    fs.mkdirSync(work, { recursive: true });
    git(["read-tree", BRANCH], { env: wtEnv() });
    git(["checkout-index", "-a", "-f"], { env: wtEnv() });
  }

  private commit(message: string): { head: string; file: string } {
    const tree = git(["write-tree"], { env: wtEnv() });
    if (!tree.ok) throw new Error(`write-tree: ${tree.err}`);
    const parent = this.head();
    const args = parent
      ? ["commit-tree", tree.out, "-p", parent, "-m", message]
      : ["commit-tree", tree.out, "-m", message];
    const commit = git(args, { env: wtEnv() });
    if (!commit.ok) throw new Error(`commit-tree: ${commit.err}`);
    git(["update-ref", BRANCH, commit.out]);
    return { head: commit.out, file: tree.out };
  }
}

let singleton: GitFs | undefined;
export function gitfs(): GitFs {
  if (!singleton) singleton = new GitFs();
  return singleton;
}

export function resetGitfs() {
  singleton = undefined;
}
