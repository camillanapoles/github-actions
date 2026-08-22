import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");
const persist = path.join(root, "plugin/actos/bin/actos-persist.mjs");
const id = `hello_${Date.now().toString(36)}`;
const r = spawnSync(
  process.execPath,
  [persist, "--kind", "hello", "--repo", "example/hello", "--id", id, "--payload", JSON.stringify({ msg: "hello actos", cpu: "node" })],
  { cwd: root, encoding: "utf8" },
);
process.stdout.write(r.stdout || "");
process.stderr.write(r.stderr || "");
process.exit(r.status ?? 1);
