import Link from "next/link";
import { getKernel } from "@/domain/kernel";
import { AgentForm } from "@/components/AgentForm";
import { Card, PathView, Pill, Title } from "@/components/ui";
import { ago } from "@/lib/format";

export default async function AgentesPage() {
  const k = getKernel();
  const list = k.listAgents();
  const runs = k.listAgentRuns();

  return (
    <div>
      <Title sub="IA agentic harness que usa workflow. O agente não corre no browser: é GitHub Action (harness/github/agent-harness.yml) e, localmente, o mesmo CLI (src/cli/agent.ts). Cada step é objeto em /agents/{id}/runs/{runId}/steps/{n}.">
        Harness agentic
      </Title>

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
