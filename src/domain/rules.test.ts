import assert from "node:assert/strict";
import { test } from "node:test";
import { RuleEngine } from "./rules";
import type { RuleRecord } from "./types";

const rules: RuleRecord[] = [
  {
    id: "deny-sys",
    name: "sys imutável",
    matchPattern: "/sys/**",
    op: "write",
    effect: "deny",
    transform: null,
    priority: 90,
    enabled: true,
  },
  {
    id: "allow-obj",
    name: "objetos",
    matchPattern: "/objects/**",
    op: "*",
    effect: "allow",
    transform: null,
    priority: 10,
    enabled: true,
  },
];

test("sucesso: default allow quando nenhuma regra", () => {
  const d = new RuleEngine([]).evaluate("read", "/runtime/runs/1");
  assert.equal(d.allowed, true);
  assert.equal(d.effect, "allow");
});

test("validação: write /sys/** é deny", () => {
  const d = new RuleEngine(rules).evaluate("write", "/sys/calls/x");
  assert.equal(d.allowed, false);
  assert.equal(d.effect, "deny");
});

test("sucesso: write /objects/** é allow", () => {
  const d = new RuleEngine(rules).evaluate("write", "/objects/note/1");
  assert.equal(d.allowed, true);
});
