import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "actos-qa-"));
process.env.ACTOS_DB = path.join(dir, "t.db");
process.env.ACTOS_L1 = path.join(dir, "l1");
process.env.ACTOS_L2 = path.join(dir, "l2");
process.env.ACTOS_IRQ = path.join(dir, "irq.jsonl");
process.env.ACTOS_GITFS = "0";
// Match GitHub Actions Node 20 (no node:sqlite). Local Node 22 would hide FileDb bugs.
process.env.ACTOS_FILEDB = "1";

export const tmpDir = dir;
