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

test("01 hello-cpu persiste objecto namespaced", () => {
  const r = run("examples/01-hello-cpu/run.mjs");
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /\/objects\/example--hello\/hello\//);
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
