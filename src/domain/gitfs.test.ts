import "./../test/env";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { GitFs, resetGitfs } from "./gitfs";

function sh(cwd: string, args: string[]) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout);
  return (r.stdout ?? "").trim();
}

function tempRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "actos-gitfs-"));
  sh(dir, ["init", "-b", "main"]);
  sh(dir, ["config", "user.email", "qa@actos"]);
  sh(dir, ["config", "user.name", "qa"]);
  sh(dir, ["commit", "--allow-empty", "-m", "seed"]);
  return dir;
}

test("sucesso: write + ls-tree + read sem checkout do ramo", () => {
  const repo = tempRepo();
  process.env.ACTOS_GIT_DIR = path.join(repo, ".git");
  process.env.ACTOS_FS_WORK = path.join(repo, "wt");
  process.env.ACTOS_FS_INDEX = path.join(repo, "idx");
  resetGitfs();
  const fsx = new GitFs();
  fsx.write("/objects/note/n1", { ok: true }, "write /objects/note/n1");
  assert.deepEqual(fsx.ls("/objects"), ["/objects/note/n1"]);
  assert.deepEqual(fsx.read("/objects/note/n1"), { ok: true });
  const branch = sh(repo, ["rev-parse", "--abbrev-ref", "HEAD"]);
  assert.equal(branch, "main");
});

test("sucesso E14: tagCas é idempotente e não faz overwrite", () => {
  const repo = tempRepo();
  process.env.ACTOS_GIT_DIR = path.join(repo, ".git");
  process.env.ACTOS_FS_WORK = path.join(repo, "wt");
  process.env.ACTOS_FS_INDEX = path.join(repo, "idx");
  resetGitfs();
  const fsx = new GitFs();
  fsx.write("/objects/note/n2", { v: 1 });
  const sha = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const first = fsx.tagCas(sha, "/objects/note/n2");
  const second = fsx.tagCas(sha, "/objects/note/n2");
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(fsx.listCasTags().length, 1);
});

test("sucesso E15: kernel hydrateFromL3 projecta o tree", async () => {
  const repo = tempRepo();
  process.env.ACTOS_GIT_DIR = path.join(repo, ".git");
  process.env.ACTOS_FS_WORK = path.join(repo, "wt");
  process.env.ACTOS_FS_INDEX = path.join(repo, "idx");
  process.env.ACTOS_GITFS = "1";
  resetGitfs();
  const fsx = new GitFs();
  fsx.write("/objects/note/hyd1", {
    id: "hyd1",
    kind: "note",
    path: "/objects/note/hyd1",
    pattern: "/objects/{kind}/{id}",
    payload: { from: "l3" },
    metadata: {},
  });
  const { resetDb } = await import("@/db/client");
  const { resetKernel, getKernel } = await import("@/domain/kernel");
  resetDb();
  resetKernel();
  const k = getKernel();
  const h = k.hydrateFromL3();
  assert.ok(h.paths.includes("/objects/note/hyd1"));
  const got = k.read("/objects/note/hyd1");
  assert.deepEqual(got.payload, { from: "l3" });
  process.env.ACTOS_GITFS = "0";
});

test("validação: attach recusa segundo órfão — usa o origin", () => {
  const origin = tempRepo();
  process.env.ACTOS_GIT_DIR = path.join(origin, ".git");
  process.env.ACTOS_FS_WORK = path.join(origin, "wt");
  process.env.ACTOS_FS_INDEX = path.join(origin, "idx");
  resetGitfs();
  const originFs = new GitFs();
  const first = originFs.write("/proc/stat", { n: 1 }, "write /proc/stat").head;

  const clone = fs.mkdtempSync(path.join(os.tmpdir(), "actos-clone-"));
  sh(clone, ["clone", origin, "."]);
  process.env.ACTOS_GIT_DIR = path.join(clone, ".git");
  process.env.ACTOS_FS_WORK = path.join(clone, "wt");
  process.env.ACTOS_FS_INDEX = path.join(clone, "idx");
  resetGitfs();
  const cloneFs = new GitFs();
  const attached = cloneFs.attach();
  assert.equal(attached.head, first);
  assert.deepEqual(cloneFs.read("/proc/stat"), { n: 1 });
});
