/**
 * GitFs — L3 origin (Puter analog: LL provider / UUID blob store).
 *
 * Never checks out another branch (Arena session stays on arena/…).
 * Uses GIT_WORK_TREE + commit-tree + update-ref.
 *
 *   refs/heads/actos/fs           disco (append-only)
 *   refs/actos/runtime/{pid}      /proc (force-update; delete = unmount)
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const WORK = path.join(ROOT, ".actos-fs");
const INDEX = path.join(ROOT, ".actos-fs-index");
const BRANCH = "refs/heads/actos/fs";

export type GitFsStatus = {
  head: string | null;
  files: number;
  runtimeRefs: string[];
  workTree: string;
};

function git(args: string[], opts?: { input?: string; env?: NodeJS.ProcessEnv }): { ok: boolean; out: string; err: string } {
  const r = spawnSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
    input: opts?.input,
    env: {
      ...process.env,
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
  return {
    ...process.env,
    GIT_DIR: path.join(ROOT, ".git"),
    GIT_WORK_TREE: WORK,
    GIT_INDEX_FILE: INDEX,
  };
}

function emptyTree(): string {
  const r = git(["mktree"], { input: "" });
  if (r.ok && r.out) return r.out;
  const hashed = git(["hash-object", "-t", "tree", "/dev/null"]);
  if (hashed.ok && hashed.out) return hashed.out;
  throw new Error(`gitfs: empty tree failed ${r.err}`);
}

export class GitFs {
  ensure(): string {
    fs.mkdirSync(WORK, { recursive: true });
    const existing = git(["rev-parse", "--verify", BRANCH]);
    if (existing.ok) return existing.out;
    const tree = emptyTree();
    const commit = git(["commit-tree", tree, "-m", "actos/fs: origin (empty VFS)"]);
    if (!commit.ok) throw new Error(`gitfs init: ${commit.err}`);
    git(["update-ref", BRANCH, commit.out]);
    git(["read-tree", BRANCH], { env: wtEnv() });
    return commit.out;
  }

  head(): string | null {
    const r = git(["rev-parse", "--verify", BRANCH]);
    return r.ok ? r.out : null;
  }

  write(objectPath: string, body: unknown, message?: string): { head: string; file: string } {
    this.ensure();
    git(["read-tree", BRANCH], { env: wtEnv() });
    git(["checkout-index", "-a", "-f"], { env: wtEnv() });
    const rel = objectPath.replace(/^\//, "") + ".json";
    const file = path.join(WORK, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(body, null, 2));
    git(["add", "-A", "--", rel], { env: wtEnv() });
    return this.commit(message ?? `write ${objectPath}`);
  }

  unlink(objectPath: string): { head: string } | null {
    if (!this.head()) return null;
    git(["read-tree", BRANCH], { env: wtEnv() });
    git(["checkout-index", "-a", "-f"], { env: wtEnv() });
    const rel = objectPath.replace(/^\//, "") + ".json";
    const file = path.join(WORK, rel);
    if (fs.existsSync(file)) fs.unlinkSync(file);
    git(["add", "-A", "--", rel], { env: wtEnv() });
    return this.commit(`unlink ${objectPath}`);
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
    if (!fs.existsSync(WORK)) return [];
    const out: string[] = [];
    const walk = (dir: string, base: string) => {
      for (const name of fs.readdirSync(dir)) {
        if (name.startsWith(".")) continue;
        const p = path.join(dir, name);
        const rel = path.join(base, name);
        if (fs.statSync(p).isDirectory()) walk(p, rel);
        else out.push("/" + rel.replace(/\\/g, "/").replace(/\.json$/, ""));
      }
    };
    walk(WORK, "");
    const pref = prefix && prefix !== "/" ? prefix : "";
    return out.filter((p) => !pref || p.startsWith(pref)).sort();
  }

  status(): GitFsStatus {
    const refs = git(["for-each-ref", "--format=%(refname)", "refs/actos/runtime"]);
    return {
      head: this.head(),
      files: this.ls().length,
      runtimeRefs: refs.ok && refs.out ? refs.out.split("\n").filter(Boolean) : [],
      workTree: WORK,
    };
  }

  push(): { ok: boolean; out: string } {
    const head = this.ensure();
    const r = git(["push", "origin", `${BRANCH}:${BRANCH}`]);
    return { ok: r.ok, out: r.ok ? head : r.err || r.out };
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
