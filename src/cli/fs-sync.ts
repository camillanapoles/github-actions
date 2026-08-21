/**
 * Sync L3. Não troca o branch da sessão.
 *
 *   npx tsx src/cli/fs-sync.ts --init
 *   npx tsx src/cli/fs-sync.ts --status
 *   npx tsx src/cli/fs-sync.ts --push
 */
import { gitfs } from "@/domain/gitfs";

function has(flag: string) {
  return process.argv.includes(`--${flag}`);
}

function main() {
  const fs = gitfs();
  if (has("init") || has("status") || process.argv.length <= 2) {
    const head = fs.ensure();
    console.log("[actos/fs] head", head);
    console.log("[actos/fs]", JSON.stringify(fs.status(), null, 2));
  }
  if (has("push")) {
    const r = fs.push();
    console.log("[actos/fs] push", r.ok ? "ok" : r.out);
    if (!r.ok) process.exit(1);
  }
}

main();
