import { getKernel } from "@/domain/kernel";
import { SyscallConsole } from "@/components/SyscallConsole";
import { Card, PathView, Title } from "@/components/ui";
import { ago } from "@/lib/format";

export default async function SysPage() {
  const k = getKernel();
  const log = k.syscallLog();
  const journal = k.listEvents(30);
  return (
    <div>
      <Title sub="F1 journal append-only (events) + syscalls. resolve corre numa transação. dmesg ≠ origem — o journal é.">
        Syscalls
      </Title>
      <Card className="mb-6 px-4 py-4">
        <SyscallConsole />
      </Card>
      <h2 className="mb-2 text-sm font-medium">journal</h2>
      <div className="mb-8 space-y-1">
        {journal.map((e: { id: string; seq: number; op: string; path: string | null; at: string }) => (
          <Card key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
            <span className="font-mono text-[11px] text-mute">#{e.seq}</span>
            <span className="font-mono text-xs text-runtime">{e.op}</span>
            {e.path ? <PathView path={e.path} /> : <span className="font-mono text-[11px] text-line">—</span>}
            <span className="font-mono text-[11px] text-mute">{ago(e.at)}</span>
          </Card>
        ))}
      </div>
      <div className="space-y-2">
        {log.map((s) => (
          <Card key={s.id} className="px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-xs text-runtime">{s.name}</span>
              <span className="font-mono text-[11px] text-mute">{ago(s.createdAt)}</span>
            </div>
            {s.path ? (
              <div className="mt-1">
                <PathView path={s.path} />
              </div>
            ) : null}
            <pre className="mt-2 max-h-32 overflow-auto font-mono text-[11px] text-mute scrollbar-thin">
              {JSON.stringify({ args: s.args, result: s.result }, null, 2)}
            </pre>
          </Card>
        ))}
      </div>
    </div>
  );
}
