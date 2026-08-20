import { getKernel } from "@/domain/kernel";
import { Card, PathView, Pill, Title } from "@/components/ui";
import { forkAction } from "@/app/actions";
import { ago } from "@/lib/format";

export default async function RuntimePage() {
  const k = getKernel();
  const ps = k.ps();
  const snap = k.stats().runtime;

  return (
    <div>
      <Title sub="O espaço único. Só existe o que está agora em GitHub Actions runtime — analogia da RAM. Quando o job termina, o kernel faz unmount e o resultado deixa de viver aqui: vira objeto em disco (path).">
        Espaço único
      </Title>

      <Card className="mb-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-line/70 px-4 py-3">
          <span className="font-mono text-[11px] text-mute">htop · actions</span>
          <span className="font-mono text-[11px] text-runtime">{ps.length} procs · {snap.updatedAt}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="text-[10px] uppercase tracking-widest text-line">
              <tr>
                <th className="px-4 py-2">pid</th>
                <th className="px-4 py-2">kind</th>
                <th className="px-4 py-2">workflow</th>
                <th className="px-4 py-2">status</th>
                <th className="px-4 py-2">path</th>
                <th className="px-4 py-2">age</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {ps.map((p) => (
                <tr key={p.pid} className="border-t border-line/40">
                  <td className="px-4 py-3 text-paper">{p.pid}</td>
                  <td className="px-4 py-3 text-agent">{p.kind}</td>
                  <td className="px-4 py-3">{p.workflow}</td>
                  <td className="px-4 py-3">
                    <Pill status={p.status} />
                  </td>
                  <td className="px-4 py-3">
                    <PathView path={p.path} />
                  </td>
                  <td className="px-4 py-3 text-mute">{ago(p.startedAt)}</td>
                  <td className="px-4 py-3">
                    <form action={forkAction}>
                      <input type="hidden" name="runId" value={p.runId} />
                      <button className="text-[11px] text-mute hover:text-runtime">fork</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {ps.length === 0 ? (
            <p className="px-4 py-8 text-sm text-mute">Nenhum processo. O runtime está ocioso — como um kernel sem tasks.</p>
          ) : null}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          ["RAM", "runtime://", "efémero, único, o que a Action ainda não resolveu"],
          ["CPU", "runner ubuntu-latest", "serverless: o compute é o GitHub-hosted runner"],
          ["syscall table", "/sys/calls/{id}", "CRUD não chega — ps, fork, resolve, cache"],
        ].map(([t, p, d]) => (
          <Card key={t} className="px-4 py-4">
            <div className="font-mono text-[11px] text-runtime">{t}</div>
            <div className="mt-2">
              <PathView path={p} />
            </div>
            <p className="mt-2 text-xs text-mute">{d}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
