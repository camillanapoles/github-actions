import { SESSION_PRACTICE } from "@/lib/session-practice";

/** Aviso non-commit: quem não lê git history também vê a prática. */
export function SessionNotice() {
  return (
    <aside className="mb-8 rounded-xl border border-agent/35 bg-agent/5 px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] tracking-[0.22em] text-agent">{SESSION_PRACTICE.tag}</span>
        <span className="text-sm font-medium text-paper">{SESSION_PRACTICE.title}</span>
      </div>
      <ol className="mt-3 list-decimal space-y-1 pl-4 text-xs leading-relaxed text-mute">
        {SESSION_PRACTICE.lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ol>
    </aside>
  );
}
