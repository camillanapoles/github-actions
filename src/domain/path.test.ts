import assert from "node:assert/strict";
import { test } from "node:test";
import { ObjectPath, PATTERNS } from "./path";

test("sucesso: resolve(pattern+id) é estável", () => {
  const p = ObjectPath.named("object", { kind: "execution", id: "ex_1" });
  assert.equal(p.resolve(), "/objects/execution/ex_1");
  assert.equal(p.namespace, "objects");
});

test("sucesso: parse ∘ resolve = identidade", () => {
  const resolved = ObjectPath.named("cache", {
    workflow: "ci.yml",
    sha: "abc123",
    id: "deadbeef",
  }).resolve();
  const parsed = ObjectPath.parse(resolved);
  assert.ok(parsed);
  assert.equal(parsed.pattern, PATTERNS.cache);
  assert.equal(parsed.params.workflow, "ci.yml");
});

test("validação: param em falta falha", () => {
  assert.throws(() => ObjectPath.named("runtimeRun", {}).resolve());
});

test("sucesso F6: objectNs namespaced por repo", () => {
  const p = ObjectPath.named("objectNs", {
    repo: "acme--shop",
    kind: "execution",
    id: "1",
  }).resolve();
  assert.equal(p, "/objects/acme--shop/execution/1");
  const parsed = ObjectPath.parse(p);
  assert.equal(parsed?.params.repo, "acme--shop");
});
