import fs from "node:fs";
import path from "node:path";
import { getKernel } from "@/domain/kernel";
import { publishObjects, publicDir } from "@/domain/public-cdn";

const k = getKernel();
if (process.env.ACTOS_GITFS !== "0") {
  const h = k.hydrateFromL3();
  console.log("[cdn-public] hydrate", h.n);
}
const out = publishObjects(k.ls("/"), k.listRules());
console.log("[cdn-public]", publicDir(), "n=", out.length);
for (const e of out.slice(0, 12)) console.log("  ", e.path, "→", e.immutable);

// Example 06 — publica páginas estáticas convertidas (Docker→ACTOS) em /webpage
// sem sobreescrever a UI raiz do ACTOS (publicDir() jé tem os objetos em /obj, /objects).
// Corre DEPOIS do publishObjects, que faz rmSync de publicDir() no início.
const webRoot = path.join(process.cwd(), "webpage");
const cdn = publicDir();
if (fs.existsSync(webRoot)) {
  copyDir(webRoot, cdn);
  console.log("[cdn-public] webpage/ merged →", cdn);
}

function copyDir(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else if (e.name !== ".git" && e.name !== "node_modules") fs.copyFileSync(s, d);
  }
}
