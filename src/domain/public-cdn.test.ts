import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { publishObjects } from "./public-cdn";
import type { RuleRecord, StoredObjectRecord } from "./types";

function obj(partial: Partial<StoredObjectRecord> & { path: string; kind: string; payload: unknown }): StoredObjectRecord {
  const ts = new Date().toISOString();
  return {
    id: partial.id ?? partial.path,
    pattern: "/objects/{kind}/{id}",
    metadata: {},
    createdAt: ts,
    updatedAt: ts,
    ...partial,
  };
}

const rules: RuleRecord[] = [
  {
    id: "deny-secret-kind",
    name: "deny",
    matchPattern: "/objects/secret/**",
    op: "read",
    effect: "deny",
    transform: null,
    priority: 80,
    enabled: true,
  },
  {
    id: "strip",
    name: "strip",
    matchPattern: "/objects/note/**",
    op: "read",
    effect: "transform",
    transform: "strip-secrets",
    priority: 50,
    enabled: true,
  },
];

test("sucesso: URL imutável obj/{sha}.json e estável por path", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pub-"));
  const out = publishObjects(
    [obj({ path: "/objects/note/n1", kind: "note", payload: { hello: 1, token: "s3cret" } })],
    rules,
    dir,
  );
  assert.equal(out.length, 1);
  assert.match(out[0].immutable, /^\/obj\/[a-f0-9]{64}\.json$/);
  const published = JSON.parse(fs.readFileSync(path.join(dir, out[0].immutable.slice(1)), "utf8"));
  assert.equal(published.payload.token, "***");
  assert.equal(published.payload.hello, 1);
});

test("validação: deny e /runtime /agents não saem para o público", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pub-"));
  const out = publishObjects(
    [
      obj({ path: "/objects/secret/x", kind: "secret", payload: { n: 1 } }),
      obj({ path: "/runtime/runs/1", kind: "run", payload: { n: 1 } }),
      obj({ path: "/agents/harness/runs/a", kind: "agent-run", payload: { token: "x" } }),
      obj({ path: "/objects/manifest/kernel", kind: "manifest", payload: { ok: true } }),
    ],
    rules,
    dir,
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].path, "/objects/manifest/kernel");
});
