import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

function run(rel) {
  return spawnSync(process.execPath, [path.join(root, rel)], { cwd: root, encoding: "utf8" });
}

function objectsDir() {
  return path.join(root, "data", "objects", "objects");
}

function countObjects() {
  if (!fs.existsSync(objectsDir())) return 0;
  let n = 0;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".json")) n += 1;
    }
  };
  walk(objectsDir());
  return n;
}

test("actos-persist --help não escreve objectos", () => {
  const before = countObjects();
  const h = spawnSync(
    process.execPath,
    [path.join(root, "plugin/actos/bin/actos-persist.mjs"), "--help"],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(h.status, 0, h.stderr);
  assert.match(h.stdout, /uso:/);
  assert.doesNotMatch(h.stdout, /actos-persist\]/);
  assert.equal(countObjects(), before);
});

test("01 hello-cpu persiste objecto namespaced e válido", () => {
  const r = run("examples/01-hello-cpu/run.mjs");
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /\/objects\/example--hello\/hello\//);
  const line = r.stdout.split("\n").find((l) => l.startsWith("{"));
  const out = JSON.parse(line);
  const file = out.file;
  assert.ok(fs.existsSync(file), `objecto devia existir: ${file}`);
  const obj = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(obj.kind, "hello");
  assert.equal(obj.path, out.path);
  assert.ok(obj.payload && typeof obj.payload === "object");
  assert.ok(obj.payload.msg || obj.payload.repo);
});

test("02 test-suite persiste kind=test", () => {
  const r = run("examples/02-test-suite/run.mjs");
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /\/objects\/example--suite\/test\//);
});

test("03 data-ingest persiste model-ingest", () => {
  const r = run("examples/03-data-ingest/run.mjs");
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /model-ingest/);
});

test("04 static-build cria dist e persiste", () => {
  const r = run("examples/04-static-build/run.mjs");
  assert.equal(r.status, 0, r.stderr);
  assert.ok(fs.existsSync(path.join(root, "examples/04-static-build/dist/index.html")));
});

test("05 hub-ingest emite contrato POST /api/ingest", () => {
  const r = run("examples/05-hub-ingest/run.mjs");
  assert.equal(r.status, 0, r.stderr);
  const body = JSON.parse(r.stdout);
  assert.ok(body.repo && body.kind && body.payload);
});

test("06 docker→actos: gera webpage/llm-infra-planner e persiste llmcalc-page", () => {
  const r = run("examples/06-docker-to-actos/run.mjs");
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /llmcalc-page/);
  assert.ok(fs.existsSync(path.join(root, "webpage/llm-infra-planner/index.html")));
});
