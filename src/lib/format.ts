export function ago(iso: string | null | undefined): string {
  if (!iso) return "—";
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return `${Math.floor(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function shortSha(sha: string): string {
  return sha.slice(0, 7);
}

export function cls(...xs: Array<string | false | null | undefined>): string {
  return xs.filter(Boolean).join(" ");
}

export function statusTone(status: string): string {
  if (status === "in_runtime" || status === "running" || status === "acting" || status === "planning")
    return "text-runtime";
  if (status === "cached" || status === "done" || status === "success" || status === "completed") return "text-object";
  if (status === "failed" || status === "fail" || status === "deny") return "text-danger";
  if (status === "queued" || status === "idle") return "text-mute";
  return "text-agent";
}
