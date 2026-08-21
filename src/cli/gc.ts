/**
 * CDN GC: promote L1→L3, emit L2 ticket, print stats.
 *
 *   npx tsx src/cli/gc.ts --promote
 *   npx tsx src/cli/gc.ts --ticket <runId>
 *   npx tsx src/cli/gc.ts --stat
 */
import { getKernel } from "@/domain/kernel";
import { cdnStats, l1List, l2Put } from "@/domain/cdn";

function has(f: string) {
  return process.argv.includes(`--${f}`);
}
function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : "";
}

function main() {
  const k = getKernel();
  if (has("ticket")) {
    const runId = arg("ticket") || process.env.GITHUB_RUN_ID || "local";
    const top = l1List()[0];
    if (top) {
      const t = l2Put({ sha: top.sha, path: top.path, runId });
      console.log("[cdn] L2 ticket", JSON.stringify(t));
    } else {
      l2Put({ sha: "empty", path: "/objects/manifest/kernel", runId });
      console.log("[cdn] L2 empty ticket");
    }
    return;
  }
  if (has("promote")) {
    const r = k.promoteCdn();
    console.log("[cdn] gc", r);
    return;
  }
  console.log("[cdn]", JSON.stringify({ stats: cdnStats(), l1: l1List().slice(0, 8) }, null, 2));
}

main();
