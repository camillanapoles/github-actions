import "./test/env";
import assert from "node:assert/strict";
import { test } from "node:test";
import { getKernel } from "@/domain/kernel";
import { pendingIrqs } from "@/domain/irq";

test("sucesso: enqueue não é CPU — fica queued e emite IRQ", () => {
  const k = getKernel();
  const run = k.enqueueAgent("qa enqueue only");
  assert.equal(run.status, "queued");
  assert.equal(run.steps.length, 0);
  assert.equal(k.ps().length, 0);
  const irq = pendingIrqs().find((i) => i.runId === run.id);
  assert.ok(irq);
  const body = (run.result as { irq?: { event_type: string } }).irq;
  assert.equal(body?.event_type, "agent.run");
});

test("sucesso: drain é o CPU — run done e sai do runtime", async () => {
  const k = getKernel();
  const q = k.enqueueAgent("qa drain cpu " + Date.now());
  assert.equal(q.status, "queued");
  const out = await k.drain(8);
  assert.ok(out.some((r) => r.id === q.id && r.status === "done"));
  assert.equal(k.ps().length, 0);
});

test("sucesso: mesmo goal = CAS HIT sem reentrar runtime", async () => {
  const k = getKernel();
  const goal = "qa cas hit unique " + Date.now();
  const first = await k.runAgent(goal);
  assert.equal(first.status, "done");
  assert.ok(!(first.result as { cacheHit?: boolean }).cacheHit);
  const second = k.enqueueAgent(goal);
  assert.equal(second.status, "done");
  assert.equal((second.result as { cacheHit?: boolean }).cacheHit, true);
  assert.equal(k.ps().length, 0);
});

test("sucesso: write cria objeto em pattern+id", () => {
  const k = getKernel();
  const obj = k.write({ kind: "note", payload: { ok: true } });
  assert.match(obj.path, /^\/objects\/note\//);
  const got = k.read(obj.path);
  assert.deepEqual(got.payload, { ok: true });
});

test("validação: write /sys é EACCES", () => {
  const k = getKernel();
  assert.throws(
    () => k.write({ kind: "x", path: "/sys/calls/forbidden", payload: {} }),
    /EACCES/,
  );
});

test("sucesso: lookup L1 depois de write", () => {
  const k = getKernel();
  const obj = k.write({ kind: "edge", payload: { n: 7 } });
  const hit = k.lookup(obj.path);
  assert.equal(hit.layer, "L1");
});
