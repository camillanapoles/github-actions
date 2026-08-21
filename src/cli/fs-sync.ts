/**
 * Sync L3. Não troca o branch da sessão.
 *
 *   npx tsx src/cli/fs-sync.ts --init
 *   npx tsx src/cli/fs-sync.ts --status
 *   npx tsx src/cli/fs-sync.ts --attach
 *   npx tsx src/cli/fs-sync.ts --push
 */
import { gitfs } from "@/domain/gitfs";
import { getKernel } from "@/domain/kernel";

function has(flag: string) {
  return process.argv.includes(`--${flag}`);
}

function main() {
  const fs = gitfs();
  if (has("attach")) {
    const r = fs.attach();
    console.log("[actos/fs] attach", JSON.stringify(r));
    if (!r.head) process.exit(1);
  }
  if (has("init") || has("status") || process.argv.length <= 2) {
    const head = fs.ensure();
    console.log("[actos/fs] head", head);
    console.log("[actos/fs]", JSON.stringify(fs.status(), null, 2));
  }
  if (has("push")) {
    const attached = fs.attach();
    console.log("[actos/fs] attach", JSON.stringify(attached));
    try {
      getKernel().writeProcStat({ reason: "fs-sync --push" });
    } catch (err) {
      console.error("[actos/fs] proc.stat", err);
    }
    const r = fs.push();
    console.log("[actos/fs] push", r.ok ? "ok" : r.out);
    if (!r.ok) process.exit(1);
  }
}

main();
