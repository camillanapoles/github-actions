import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const dist = path.join(here, "dist");
fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(path.join(dist, "index.html"), "<!doctype html><title>ok</title>");
const id = `bld_${Date.now().toString(36)}`;
const r = spawnSync(
  process.execPath,
  [
    path.join(root, "plugin/actos/bin/actos-persist.mjs"),
    "--kind", "build",
    "--repo", "example/site",
    "--id", id,
    "--payload",
    JSON.stringify({ files: ["index.html"], docker: false }),
  ],
  { cwd: root, encoding: "utf8" },
);
process.stdout.write(r.stdout || "");
process.exit(r.status ?? 1);
