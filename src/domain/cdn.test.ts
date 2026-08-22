import "./../test/env";
import assert from "node:assert/strict";
import { test } from "node:test";
import { gc, l1Get, l1Put, l2List, l2Put } from "./cdn";

test("sucesso: L1 put/get pelo sha", () => {
  const e = l1Put("/objects/note/n1", { hello: "cdn" });
  const hit = l1Get(e.sha);
  assert.ok(hit);
  assert.equal(hit.path, "/objects/note/n1");
  assert.deepEqual(hit.body, { hello: "cdn" });
});

test("sucesso: L2 é ticket, não blob", () => {
  const t = l2Put({ sha: "abc", path: "/objects/x", runId: "run1" });
  assert.equal(t.sha, "abc");
  assert.ok(!("payload" in t));
  assert.equal(l2List().some((x) => x.runId === "run1"), true);
});

test("validação: gc não evicta L1 quente", () => {
  l1Put("/objects/hot/h", { n: 1 });
  const r = gc(Date.now());
  assert.equal(r.evicted.length, 0);
});
