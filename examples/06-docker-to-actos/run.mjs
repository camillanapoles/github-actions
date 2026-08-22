#!/usr/bin/env node
// Example 06 — Docker ➞ ACTOS (converter o llm-infra-planner).
//
// CPU local: garante que webpage/llm-infra-planner/ existe (build real do clone,
// ou fallback estático) e persiste um objecto `llmcalc-page` — o "resultado" que
// o container Docker produzia num volume efémrero.
//
// Corre: node examples/06-docker-to-actos/run.mjs

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const planner = path.join(here, "llm-infra-planner");
const dist = path.join(planner, "dist");
const web = path.join(root, "webpage", "llm-infra-planner");
const PERSIST = path.join(root, "plugin", "actos", "bin", "actos-persist.mjs");

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dest, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else if (e.name !== ".git" && e.name !== "node_modules") fs.copyFileSync(s, d);
  }
}

// CPU step (no Docker): usa o build real se existir; senão gera fallback estático.
let built = false;
if (fs.existsSync(path.join(dist, "index.html"))) {
  copyDir(dist, web);
  built = true;
} else if (!fs.existsSync(path.join(web, "index.html"))) {
  fs.mkdirSync(web, { recursive: true });
  fs.writeFileSync(path.join(web, "index.html"), fallbackHtml());
}

// SPA fallback (deep-link best-effort na GitHub Pages).
if (!fs.existsSync(path.join(web, "404.html"))) {
  fs.copyFileSync(path.join(web, "index.html"), path.join(web, "404.html"));
}

// Persiste o resultado como objecto ACTOS (o que o container antigo produzia).
const id = `llmcalc-page_${Date.now().toString(36)}`;
const payload = JSON.stringify({
  source: "docker→actos",
  project: "llm-infra-planner",
  effect: "serves LLMcalc SPA — same as nginx in Dockerfile",
  built,
  page: "/llm-infra-planner/",
  generatedAt: new Date().toISOString(),
});

const r = spawnSync(
  process.execPath,
  [
    PERSIST,
    "--kind", "llmcalc-page",
    "--repo", "camillanapoles/github-actions",
    "--id", id,
    "--payload", payload,
  ],
  { cwd: root, encoding: "utf8" },
);
process.stdout.write(r.stdout);
if (r.status !== 0) {
  process.stderr.write(r.stderr);
  process.exit(r.status ?? 1);
}
process.exit(0);

function fallbackHtml() {
  return `<!doctype html><meta charset="utf-8"><title>LLMcalc — Docker→ACTOS</title>
<body style="font-family:system-ui;background:#07080c;color:#e8edf5;padding:2rem">
<h1>LLMcalc (Docker ➞ ACTOS)</h1>
<p>Este diretório é gerado por <code>examples/06-docker-to-actos/run.mjs</code>.
Corre <code>npm ci &amp;&amp; npx vite build</code> no clone de <code>llm-infra-planner</code>
para produzir a SPA real que o Docker/nginx servia.</p>
</body>`;
}
