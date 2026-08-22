import type { RuleDecision, RuleOp, RuleRecord, StoredObjectRecord } from "./types";

/**
 * Rules are the permission + transform layer — analog to an OS
 * (chmod, ACLs, LSM). After every read/write, the path is matched
 * against ordered rules (priority desc).
 */
export class RuleEngine {
  constructor(private rules: RuleRecord[]) {}

  evaluate(op: RuleOp, path: string, object?: StoredObjectRecord | null): RuleDecision {
    const applicable = this.rules
      .filter((r) => r.enabled)
      .filter((r) => r.op === "*" || r.op === op)
      .filter((r) => matchGlob(r.matchPattern, path))
      .sort((a, b) => b.priority - a.priority);

    if (applicable.length === 0) {
      return {
        allowed: true,
        ruleId: null,
        effect: "allow",
        reason: "nenhuma regra — default allow (unix-like)",
      };
    }

    const rule = applicable[0];
    if (rule.effect === "deny") {
      return {
        allowed: false,
        ruleId: rule.id,
        effect: "deny",
        reason: `negado por ${rule.name}`,
      };
    }

    if (rule.effect === "transform" && object && rule.transform) {
      return {
        allowed: true,
        ruleId: rule.id,
        effect: "transform",
        reason: `transformado por ${rule.name}`,
        transformed: applyTransform(object.payload, rule.transform),
      };
    }

    return {
      allowed: true,
      ruleId: rule.id,
      effect: "allow",
      reason: `permitido por ${rule.name}`,
    };
  }
}

function matchGlob(pattern: string, path: string): boolean {
  const rx = new RegExp(
    "^" +
      pattern
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\*\*/g, ":::GLOBSTAR:::")
        .replace(/\*/g, "[^/]*")
        .replace(/:::GLOBSTAR:::/g, ".*") +
      "$",
  );
  return rx.test(path);
}

function applyTransform(payload: unknown, transform: string): unknown {
  if (transform === "redact-logs" && payload && typeof payload === "object") {
    const clone = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
    if (typeof clone.logs === "string") clone.logs = "[redacted]";
    return clone;
  }
  if (transform === "strip-secrets" && payload && typeof payload === "object") {
    const clone = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
    walkRedact(clone);
    return clone;
  }
  return payload;
}

function walkRedact(node: Record<string, unknown>) {
  for (const [k, v] of Object.entries(node)) {
    if (/secret|token|password|key/i.test(k)) node[k] = "***";
    else if (v && typeof v === "object") walkRedact(v as Record<string, unknown>);
  }
}
