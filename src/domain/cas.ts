import { createHash } from "node:crypto";

/** Content-addressed identity. HIT only if the work is the same. */
export function cas(...parts: Array<string | number | boolean | null | undefined>): string {
  const h = createHash("sha256");
  h.update("actos/v1\n");
  for (const p of parts) {
    h.update(String(p ?? ""));
    h.update("\0");
  }
  return h.digest("hex");
}

export function cacheKey(input: {
  workflow: string;
  goal?: string;
  extra?: Record<string, string>;
}): string {
  const extra = Object.entries(input.extra ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  return cas(input.workflow, (input.goal ?? "").trim(), extra);
}
