import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");
const models = [{ id: "toy-7b", params: 7e9 }];
const id = `ing_${Date.now().toString(36)}`;
const r = spawnSync(
  process.execPath,
  [
    path.join(root, "plugin/actos/bin/actos-persist.mjs"),
    "--kind", "model-ingest",
    "--repo", "example/ingest",
    "--id", id,
    "--payload",
    JSON.stringify({ n: models.length, models }),
  ],
  { cwd: root, encoding: "utf8" },
);
process.stdout.write(r.stdout || "");
process.exit(r.status ?? 1);
