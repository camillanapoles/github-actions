/**
 * Retorno injetado FORA do commit: Step Summary, stdout, comentário no PR, label.
 * Quem não lê git history também vê a melhor prática.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const MARKER = "<!-- arena-agent-session-notice -->";
const TAG = "arena-agent";

function noticeMarkdown(): string {
  const file = path.join(process.cwd(), "harness/rules/arena-session.md");
  const body = fs.existsSync(file)
    ? fs.readFileSync(file, "utf8")
    : "Não faças merge enquanto iterares. Commit/push só no ramo arena/. Tag arena-agent.";
  return `${MARKER}\n\n${body}\n`;
}

function gh(args: string[]): { ok: boolean; out: string } {
  const r = spawnSync("gh", args, { encoding: "utf8" });
  return { ok: r.status === 0, out: (r.stdout || r.stderr || "").trim() };
}

async function main() {
  const md = noticeMarkdown();
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) fs.appendFileSync(summary, `\n${md}\n`);
  console.log(md);

  const pr =
    process.env.PR_NUMBER ||
    process.env.GITHUB_PR_NUMBER ||
    gh(["pr", "view", "--json", "number", "-q", ".number"]).out;

  if (!pr) {
    console.log("[arena-agent] sem PR — notice só em stdout/summary (non-commit)");
    return;
  }

  gh(["label", "create", TAG, "--description", "Sessão de agente web (Arena). Não merge enquanto itera.", "--color", "3DFF9A"]);
  gh(["pr", "edit", pr, "--add-label", TAG]);

  const comments = gh(["pr", "view", pr, "--comments", "--json", "comments", "-q", ".comments[].body"]);
  const already = comments.out.includes(MARKER);
  if (already) {
    console.log("[arena-agent] notice já no PR (sticky) — não duplicar");
    return;
  }
  const tmp = path.join(process.cwd(), ".arena-notice.md");
  fs.writeFileSync(tmp, md);
  const posted = gh(["pr", "comment", pr, "--body-file", tmp]);
  fs.unlinkSync(tmp);
  console.log(posted.ok ? `[arena-agent] comentário injetado no PR #${pr}` : posted.out);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
