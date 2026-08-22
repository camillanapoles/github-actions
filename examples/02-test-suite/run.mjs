import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const t = spawnSync(process.execPath, ["--test", path.join(here, "sample.test.mjs")], { encoding: "utf8" });
const id = `test_${Date.now().toString(36)}`;
const persist = spawnSync(
  process.execPath,
  [
    path.join(root, "plugin/actos/bin/actos-persist.mjs"),
    "--kind", "test",
    "--repo", "example/suite",
    "--id", id,
    "--payload",
    JSON.stringify({ status: t.status, ok: t.status === 0, log: (t.stdout || "").slice(-2000) }),
  ],
  { cwd: root, encoding: "utf8" },
);
process.stdout.write(persist.stdout || "");
process.exit(t.status === 0 && persist.status === 0 ? 0 : 1);
