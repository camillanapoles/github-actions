import { getKernel } from "@/domain/kernel";
import { SyscallConsole } from "@/components/SyscallConsole";
import { Card, PathView, Title } from "@/components/ui";
import { ago } from "@/lib/format";

export default async function SysPage() {
  const log = getKernel().syscallLog();
  return (
    <div>
      <Title sub="Além do CRUD. O backend expõe syscalls: ps, ls, fork, resolve, cache.stat, snapshot, path.resolve. Cada chamada é um objeto em /sys/calls/{id}.">
        Syscalls
      </Title>
      <Card className="mb-6 px-4 py-4">
        <SyscallConsole />
      </Card>
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
