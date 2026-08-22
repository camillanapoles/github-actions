/**
 * Path pattern + id — analog to an OS filesystem inode path.
 *
 * After a GitHub Actions execution is resolved, every result becomes an
 * object stored at a path derived from a pattern and identifiers.
 *
 *   /runtime/runs/{id}                      live process (RAM)
 *   /objects/{kind}/{id}                    persisted object (disk)
 *   /cache/{workflow}/{sha}/{id}            cached execution result
 *   /agents/{id}/runs/{runId}/steps/{step}  agent trace
 *   /rules/{id}                             policy
 */

export type Namespace = "runtime" | "objects" | "cache" | "agents" | "rules" | "sys";

export const PATTERNS = {
  runtimeSpace: "/runtime",
  runtimeRun: "/runtime/runs/{id}",
  runtimeJob: "/runtime/runs/{id}/jobs/{jobId}",
  object: "/objects/{kind}/{id}",
  objectNs: "/objects/{repo}/{kind}/{id}",
  cache: "/cache/{workflow}/{sha}/{id}",
  cacheNs: "/cache/{repo}/{workflow}/{sha}/{id}",
  agent: "/agents/{id}",
  agentRun: "/agents/{id}/runs/{runId}",
  agentStep: "/agents/{id}/runs/{runId}/steps/{n}",
  rule: "/rules/{id}",
  syscall: "/sys/calls/{id}",
} as const;

export type PatternName = keyof typeof PATTERNS;

const TOKEN = /\{(\w+)\}/g;

export class ObjectPath {
  constructor(
    public readonly pattern: string,
    public readonly params: Record<string, string>,
  ) {}

  get namespace(): Namespace {
    const n = this.pattern.split("/").filter(Boolean)[0];
    return (n as Namespace) ?? "objects";
  }

  resolve(): string {
    return this.pattern.replace(TOKEN, (_, key: string) => {
      const value = this.params[key];
      if (!value) {
        throw new Error(`Path param ausente: {${key}} em ${this.pattern}`);
      }
      return encodeURIComponent(value);
    });
  }

  parent(): string {
    const resolved = this.resolve();
    const i = resolved.lastIndexOf("/");
    return i <= 0 ? "/" : resolved.slice(0, i);
  }

  static from(pattern: string, params: Record<string, string>): ObjectPath {
    return new ObjectPath(pattern, params);
  }

  static named(name: PatternName, params: Record<string, string>): ObjectPath {
    return new ObjectPath(PATTERNS[name], params);
  }

  static parse(resolved: string): { pattern: string; params: Record<string, string> } | null {
    const normalized = resolved.startsWith("/") ? resolved : `/${resolved}`;
    for (const pattern of Object.values(PATTERNS)) {
      const params = matchPattern(pattern, normalized);
      if (params) return { pattern, params };
    }
    return null;
  }

  static globPrefix(prefix: string): string {
    return prefix.endsWith("/") ? prefix : `${prefix}/`;
  }
}

function matchPattern(pattern: string, path: string): Record<string, string> | null {
  const names: string[] = [];
  const regex = new RegExp(
    "^" +
      pattern.replace(TOKEN, (_, name: string) => {
        names.push(name);
        return "([^/]+)";
      }) +
      "$",
  );
  const m = path.match(regex);
  if (!m) return null;
  const params: Record<string, string> = {};
  names.forEach((name, i) => {
    params[name] = decodeURIComponent(m[i + 1]);
  });
  return params;
}

export function kindFromPath(path: string): string {
  const parts = path.split("/").filter(Boolean);
  if (parts[0] === "objects") return parts[1] ?? "unknown";
  return parts[0] ?? "unknown";
}

/** owner/name → path segment (gh-aw repo-memory namespacing). */
export function repoSlug(raw?: string): string {
  const r = raw || process.env.ACTOS_REPO || process.env.GITHUB_REPOSITORY || "local/actos";
  return r.replace(/[^A-Za-z0-9._-]+/g, "--");
}
