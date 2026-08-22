import Link from "next/link";
import { getKernel } from "@/domain/kernel";
import { AgentForm } from "@/components/AgentForm";
import { Card, PathView, Pill, Title } from "@/components/ui";
import { ago } from "@/lib/format";
import { drainAction } from "@/app/actions";

export default async function AgentesPage() {
  const k = getKernel();
  const list = k.listAgents();
  const runs = k.listAgentRuns();
  const queue = k.listQueue();

  return (
    <div>
      <Title sub="F1: HTTP só enfileira. O CPU é o CLI (`--drain` / `--goal`) ou a GitHub Action. Cache é CAS (sha256 do goal+workflow) — o mesmo goal é HIT. Runtime é RAM com TTL, não SQLite eterno.">
        Harness agentic
      </Title>

      <Card className="mb-6 flex flex-wrap items-center justify-between gap-3 px-4 py-4">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-widest text-agent">fila</div>
          <p className="mt-1 text-sm text-mute">{queue.length} run(s) queued — não estão no runtime até o CPU as pegar.</p>
        </div>
        <form action={drainAction}>
          <button className="rounded-md bg-runtime px-4 py-2 font-mono text-xs font-medium text-ink-950">
            drain (CPU local)
          </button>
        </form>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {list.map((a) => (
          <Card key={a.id} className="px-4 py-4">
            <div className="flex items-center justify-between">
              <Link href={`/agentes/${a.id}`} className="text-lg font-medium hover:text-agent">
                {a.name}
              </Link>
              <Pill status={a.status} />
            </div>
            <p className="mt-2 text-sm text-mute">{a.role}</p>
            <div className="mt-3 font-mono text-[11px] text-mute">workflow {a.workflow}</div>
            <div className="mt-1 flex flex-wrap gap-2">
              {a.memoryPaths.map((p) => (
                <PathView key={p} path={p} />
              ))}
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-6 px-4 py-4">
        <h2 className="mb-3 text-sm font-medium">Disparar o harness</h2>
        <AgentForm />
      </Card>

      <h2 className="mb-3 mt-8 text-sm font-medium">Runs</h2>
      <div className="grid gap-2">
        {runs.map((r) => (
          <Card key={r.id} className="px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-xs">{r.id}</span>
              <Pill status={r.status} />
            </div>
            <p className="mt-1 text-sm text-paper">{r.goal}</p>
            <div className="mt-2 font-mono text-[11px] text-mute">
              {r.steps.length} steps · {ago(r.createdAt)}
              {r.result ? ` · ${JSON.stringify(r.result).slice(0, 80)}` : ""}
            </div>
            {r.steps.length > 0 ? (
              <ol className="mt-3 space-y-1 border-l border-line pl-3">
                {r.steps.map((s) => (
                  <li key={s.n} className="font-mono text-[11px] text-mute">
                    <span className="text-agent">{s.n}</span> {s.uses}{" "}
                    <span className="text-line">→</span> {s.path}
                  </li>
                ))}
              </ol>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}
