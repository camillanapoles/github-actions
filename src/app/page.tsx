import Link from "next/link";
import { getKernel } from "@/domain/kernel";
import { Card, Metric, PathView, Pill, Title } from "@/components/ui";
import { ago } from "@/lib/format";

export default async function HomePage() {
  const k = getKernel();
  const stats = k.stats();
  const ps = k.ps();
  const cached = k.listCachedExecutions().slice(0, 5);
  const runs = k.listAgentRuns().slice(0, 4);
  const kinds = stats.kinds;

  return (
    <div>
      <Title sub="GitHub Actions como sistema operacional. O que está em runtime é o espaço único. Depois de resolvido, tudo vira objeto armazenado em path = pattern + id, e as regras decidem leitura e escrita. O harness agentic é backend — uma Action.">
        Kernel
      </Title>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="espaço único" value={stats.runtime.processes} hint="processos em runtime" tone="runtime" />
        <Metric
          label="execuções cacheadas"
          value={stats.executions.byStatus.cached ?? 0}
          hint={`${stats.executions.cacheHits} cache hits`}
          tone="cache"
        />
        <Metric label="objetos" value={stats.objects} hint={`${kinds.length} kinds`} tone="object" />
        <Metric label="regras ativas" value={stats.rules} hint={`${stats.agents} agentes`} tone="agent" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <div className="flex items-center justify-between border-b border-line/70 px-4 py-3">
            <h2 className="text-sm font-medium">Runtime · ps</h2>
            <Link href="/runtime" className="font-mono text-[11px] text-mute hover:text-runtime">
              /runtime →
            </Link>
          </div>
          <div className="divide-y divide-line/50">
            {ps.length === 0 ? (
              <p className="px-4 py-8 text-sm text-mute">espaço único vazio — nada em voo nas Actions.</p>
            ) : (
              ps.map((p) => (
                <div key={p.pid} className="flex items-start justify-between gap-4 px-4 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="live-dot h-1.5 w-1.5 rounded-full bg-runtime" />
                      <span className="font-mono text-xs text-paper">{p.workflow}</span>
                      <Pill status={p.status} />
                    </div>
                    <div className="mt-1">
                      <PathView path={p.path} />
                    </div>
                  </div>
                  <div className="text-right font-mono text-[11px] text-mute">
                    pid {p.pid}
                    <div>{ago(p.startedAt)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <div className="border-b border-line/70 px-4 py-3">
            <h2 className="text-sm font-medium">Mapa de kinds</h2>
          </div>
          <ul className="space-y-2 px-4 py-4">
            {kinds.map((knd) => (
              <li key={knd.kind} className="flex items-center justify-between font-mono text-xs">
                <span className="text-mute">{knd.kind}</span>
                <span className="text-object">{knd.count}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between border-b border-line/70 px-4 py-3">
            <h2 className="text-sm font-medium">Execuções cacheadas</h2>
            <Link href="/execucoes" className="font-mono text-[11px] text-mute hover:text-cache">
              page async →
            </Link>
          </div>
          <ul className="divide-y divide-line/50">
            {cached.map((e) => (
              <li key={e.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="font-mono text-xs text-paper">{e.workflow}</div>
                  <div className="mt-1 text-[11px] text-mute">
                    {e.cacheHit ? "HIT" : "MISS→STORE"} · {e.cacheKey}
                  </div>
                </div>
                <Pill status={e.status} />
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <div className="flex items-center justify-between border-b border-line/70 px-4 py-3">
            <h2 className="text-sm font-medium">Harness</h2>
            <Link href="/agentes" className="font-mono text-[11px] text-mute hover:text-agent">
              /agentes →
            </Link>
          </div>
          <ul className="divide-y divide-line/50">
            {runs.map((r) => (
              <li key={r.id} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-paper">{r.id}</span>
                  <Pill status={r.status} />
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-mute">{r.goal}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-6 px-5 py-5">
        <h2 className="text-sm font-medium">Ciclo de vida — analogia OS</h2>
        <ol className="mt-4 grid gap-3 md:grid-cols-4">
          {[
            ["1. syscall exec", "workflow entra no espaço único /runtime/runs/{id}"],
            ["2. runtime", "único espaço: o que a Action ainda está a correr"],
            ["3. resolve", "tudo vira objeto — payload serializado"],
            ["4. path + regras", "grava em pattern+id; ACL decide read/write"],
          ].map(([t, d]) => (
            <li key={t} className="rounded-lg border border-line/60 bg-ink-900 px-3 py-3">
              <div className="font-mono text-[11px] text-runtime">{t}</div>
              <p className="mt-2 text-xs leading-relaxed text-mute">{d}</p>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
