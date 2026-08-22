/**
 * F5 — CDN público. Como puter.hosting.create(dir):
 * um prefixo do VFS, já passado pelas regras, vira árvore estática.
 *
 *   .actos-cdn/obj/{sha}.json          URL imutável
 *   .actos-cdn/objects/{kind}/{id}.json  URL estável (último)
 *   .actos-cdn/index.json
 */
import fs from "node:fs";
import path from "node:path";
import { cas } from "./cas";
import { RuleEngine } from "./rules";
import type { RuleRecord, StoredObjectRecord } from "./types";

export function publicDir() {
  return process.env.ACTOS_CDN || path.join(process.cwd(), ".actos-cdn");
}

/** Project Pages live at /{repo}/ — a leading /obj 404s on the user site. */
export function cdnBase(): string {
  if (process.env.ACTOS_CDN_BASE != null) return process.env.ACTOS_CDN_BASE.replace(/\/$/, "");
  const repo = process.env.GITHUB_REPOSITORY || "";
  const name = repo.split("/")[1];
  return name ? `/${name}` : "";
}

function href(rel: string): string {
  const base = cdnBase();
  return base ? `${base}/${rel}` : `./${rel}`;
}

export type PublicEntry = {
  sha: string;
  path: string;
  kind: string;
  immutable: string;
  stable: string;
};

function skipPath(p: string) {
  return p.startsWith("/runtime") || p.startsWith("/sys") || p.startsWith("/agents");
}

export function publishObjects(
  list: StoredObjectRecord[],
  rules: RuleRecord[],
  outDir = publicDir(),
): PublicEntry[] {
  const engine = new RuleEngine(rules);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(outDir, "obj"), { recursive: true });
  const published: PublicEntry[] = [];

  for (const obj of list) {
    if (skipPath(obj.path)) continue;
    const d = engine.evaluate("read", obj.path, obj);
    if (!d.allowed) continue;
    const payload = d.transformed ?? obj.payload;
    const body = { path: obj.path, kind: obj.kind, payload, public: true };
    const sha = cas("pub", obj.path, JSON.stringify(payload));
    const immutableRel = `obj/${sha}.json`;
    const stableRel = `${obj.path.replace(/^\//, "")}.json`;
    fs.mkdirSync(path.join(outDir, path.dirname(stableRel)), { recursive: true });
    const json = JSON.stringify(body, null, 2);
    fs.writeFileSync(path.join(outDir, immutableRel), json);
    fs.writeFileSync(path.join(outDir, stableRel), json);
    published.push({
      sha,
      path: obj.path,
      kind: obj.kind,
      immutable: href(immutableRel),
      stable: href(stableRel),
    });
  }

  fs.writeFileSync(
    path.join(outDir, "index.json"),
    JSON.stringify({ n: published.length, base: cdnBase() || ".", entries: published }, null, 2),
  );
  fs.writeFileSync(
    path.join(outDir, "index.html"),
    `<!doctype html><meta charset="utf-8"><title>ACTOS CDN</title>
<body style="font-family:monospace;background:#07080c;color:#e8edf5;padding:2rem">
<h1>ACTOS public CDN</h1>
<p>${published.length} objects · immutable ./obj/{sha}.json · base ${cdnBase() || "."}</p>
<ul>${published.map((e) => `<li><a style="color:#6ea8ff" href="./obj/${e.sha}.json">${e.path}</a></li>`).join("")}</ul>
</body>`,
  );
  return published;
}
