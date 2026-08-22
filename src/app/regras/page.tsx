import { getKernel } from "@/domain/kernel";
import { Card, PathView, Pill, Title } from "@/components/ui";
import { toggleRuleAction } from "@/app/actions";

export default async function RegrasPage() {
  const list = getKernel().listRules();
  return (
    <div>
      <Title sub="Depois da leitura/escrita no path (pattern + id), as regras correm — analogia chmod / LSM. Default allow. Prioridade descendente. Transform pode redactar logs ou secrets.">
        Regras
      </Title>
      <div className="grid gap-3">
        {list.map((r) => (
          <Card key={r.id} className="flex flex-wrap items-center justify-between gap-4 px-4 py-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{r.name}</span>
                <Pill status={r.enabled ? r.effect : "idle"} />
              </div>
              <div className="mt-2 flex flex-wrap gap-3 font-mono text-[11px] text-mute">
                <span>op {r.op}</span>
                <span>prio {r.priority}</span>
                {r.transform ? <span>transform {r.transform}</span> : null}
              </div>
              <div className="mt-1">
                <PathView path={r.matchPattern} />
              </div>
            </div>
            <form action={toggleRuleAction}>
              <input type="hidden" name="id" value={r.id} />
              <button className="rounded-md border border-line px-3 py-1.5 font-mono text-[11px] text-mute hover:text-paper">
                {r.enabled ? "disable" : "enable"}
              </button>
            </form>
          </Card>
        ))}
      </div>
    </div>
  );
}
