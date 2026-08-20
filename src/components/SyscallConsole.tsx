"use client";

import { useFormStatus } from "react-dom";
import { syscallAction } from "@/app/actions";
import { useState } from "react";

const HINTS = ["ps", "ls", "cache.stat", "snapshot", "path.resolve", "read", "fork", "resolve"];

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-runtime px-3 py-2 font-mono text-xs font-medium text-ink-950 disabled:opacity-50"
    >
      {pending ? "trap…" : "exec"}
    </button>
  );
}

export function SyscallConsole() {
  const [out, setOut] = useState<string>("");
  return (
    <div>
      <form
        className="flex flex-col gap-2 md:flex-row"
        action={async (fd) => {
          const res = await syscallAction(fd);
          setOut(JSON.stringify(res.rec, null, 2));
        }}
      >
        <input
          name="name"
          list="sys-names"
          defaultValue="ps"
          className="w-full rounded-md border border-line bg-ink-900 px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-runtime/40 md:w-40"
        />
        <datalist id="sys-names">
          {HINTS.map((h) => (
            <option key={h} value={h} />
          ))}
        </datalist>
        <input
          name="args"
          placeholder='args JSON — {"prefix":"/objects"} ou um path'
          className="flex-1 rounded-md border border-line bg-ink-900 px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-runtime/40"
        />
        <Submit />
      </form>
      {out ? (
        <pre className="mt-4 max-h-80 overflow-auto rounded-md border border-line bg-ink-950 p-3 font-mono text-[11px] text-mute scrollbar-thin">
          {out}
        </pre>
      ) : null}
    </div>
  );
}
