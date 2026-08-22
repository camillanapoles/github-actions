import { notFound } from "next/navigation";
import { getKernel } from "@/domain/kernel";
import { AgentForm } from "@/components/AgentForm";
import { Card, PathView, Pill, Title } from "@/components/ui";

export default async function AgentePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const k = getKernel();
  const agent = k.getAgent(id);
  if (!agent) notFound();
  const runs = k.listAgentRuns(agent.id);

  return (
    <div>
      <Title sub={agent.role}>{agent.name}</Title>
      <Card className="mb-6 px-4 py-4">
        <div className="flex items-center gap-3">
          <Pill status={agent.status} />
          <span className="font-mono text-xs text-mute">{agent.workflow}</span>
        </div>
        <div className="mt-3">
          <PathView path={`/agents/${agent.id}`} />
        </div>
        <div className="mt-6">
          <AgentForm agentId={agent.id} />
        </div>
      </Card>
      <div className="space-y-2">
        {runs.map((r) => (
          <Card key={r.id} className="px-4 py-3">
            <div className="font-mono text-xs text-paper">{r.goal}</div>
            <div className="mt-1 text-[11px] text-mute">
              {r.status} · {r.steps.length} steps
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
