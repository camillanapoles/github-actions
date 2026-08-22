#!/usr/bin/env node
/**
 * Write a resolved object at pattern+id. No Docker. No kernel required.
 *
 *   node actos-persist.mjs --kind execution --id 123 --payload '{"ok":true}'
 *   node actos-persist.mjs --kind plan --repo acme/shop --stdin < result.json
 *
 * Out: data/objects/objects/{repo?}/{kind}/{id}.json
 */
import fs from "node:fs";
import path from "node:path";

function arg(name, fallback = "") {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function slug(raw) {
  return String(raw).replace(/[^A-Za-z0-9._-]+/g, "--");
}

const kind = arg("kind", "execution");
const repoRaw = arg("repo", process.env.ACTOS_REPO || process.env.GITHUB_REPOSITORY || "");
const id =
  arg("id") ||
  process.env.GITHUB_RUN_ID ||
  `loc_${Date.now().toString(36)}`;
const repo = repoRaw ? slug(repoRaw) : "";

let payload = {};
if (process.argv.includes("--stdin")) {
  payload = JSON.parse(fs.readFileSync(0, "utf8") || "{}");
} else if (arg("payload")) {
  payload = JSON.parse(arg("payload"));
} else if (arg("file")) {
  payload = JSON.parse(fs.readFileSync(arg("file"), "utf8"));
}

const objectPath = repo
  ? `/objects/${repo}/${kind}/${id}`
  : `/objects/${kind}/${id}`;
const pattern = repo ? "/objects/{repo}/{kind}/{id}" : "/objects/{kind}/{id}";
const rec = {
  id: repo ? `${repo}__${id}` : id,
  kind,
  path: objectPath,
  pattern,
  payload: {
    ...payload,
    repo: repoRaw || undefined,
    sha: process.env.GITHUB_SHA || payload.sha,
    workflow: process.env.GITHUB_WORKFLOW || payload.workflow,
    runId: process.env.GITHUB_RUN_ID || payload.runId,
    actor: process.env.GITHUB_ACTOR || payload.actor,
  },
  metadata: { source: "actos-persist", at: new Date().toISOString() },
};

const file = path.join(process.cwd(), "data", "objects", objectPath.replace(/^\//, "") + ".json");
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, JSON.stringify(rec, null, 2));
console.log("[actos-persist]", objectPath, "→", file);
console.log(JSON.stringify({ path: objectPath, file, id: rec.id }));
