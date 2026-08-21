import assert from "node:assert/strict";
import { test } from "node:test";
import { cacheKey, cas } from "./cas";

test("sucesso: CAS é determinístico", () => {
  assert.equal(cas("a", "b"), cas("a", "b"));
  assert.notEqual(cas("a", "b"), cas("a", "c"));
});

test("sucesso: mesmo goal+workflow = mesma cacheKey", () => {
  const a = cacheKey({ workflow: "agent-harness.yml", goal: "indexar", extra: { agent: "harness" } });
  const b = cacheKey({ workflow: "agent-harness.yml", goal: "indexar", extra: { agent: "harness" } });
  assert.equal(a, b);
  assert.equal(a.length, 64);
});

test("validação: extras ordenados não mudam a chave", () => {
  const a = cacheKey({ workflow: "w", extra: { z: "1", a: "2" } });
  const b = cacheKey({ workflow: "w", extra: { a: "2", z: "1" } });
  assert.equal(a, b);
});
