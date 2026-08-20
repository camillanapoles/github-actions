"use client";

import { useFormStatus } from "react-dom";
import { runAgentAction } from "@/app/actions";
import { useState } from "react";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-agent px-4 py-2 font-mono text-xs font-medium text-ink-950 disabled:opacity-50"
    >
      {pending ? "no runtime…" : "disparar harness"}
    </button>
  );
}

export function AgentForm({ agentId = "harness" }: { agentId?: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <form
      className="flex flex-col gap-3"
      action={async (fd) => {
        const res = await runAgentAction(fd);
        setMsg(res.ok ? `run ${res.id} → ${res.status}` : res.error);
      }}
    >
      <input type="hidden" name="agentId" value={agentId} />
      <label className="font-mono text-[10px] uppercase tracking-widest text-mute">goal</label>
      <textarea
        name="goal"
        required
        rows={3}
        placeholder="Ex.: Resolver execuções in_runtime e cachear em /cache/{workflow}/{sha}/{id}"
        className="resize-none rounded-md border border-line bg-ink-900 px-3 py-2 text-sm text-paper outline-none ring-runtime/40 placeholder:text-line focus:ring-2"
        defaultValue="Indexar o espaço único, persistir objetos e cachear o resultado da Action."
      />
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[11px] text-mute">backend-only · GitHub Action analog</p>
        <Submit />
      </div>
      {msg ? <p className="font-mono text-xs text-runtime">{msg}</p> : null}
    </form>
  );
}
