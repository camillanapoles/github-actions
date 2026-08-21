import { getKernel } from "@/domain/kernel";
import { Card, PathView, Title } from "@/components/ui";

export default async function CdnPage() {
  const { stats, l1, l2 } = getKernel().cdn();
  return (
    <div>
      <Title sub="F3 — hierarquia CDN. L1 = edge (Actions cache analog, 7d LRU). L2 = ticket {sha, path, runId}, não o blob. L3 = actos/fs. Pedes um path; o HIT é o hash, não o branch.">
        CDN · L1 / L2 / L3
      </Title>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Card className="px-4 py-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-cache">L1 edge</div>
          <div className="mt-2 font-mono text-2xl text-paper">{stats.l1.entries}</div>
          <p className="mt-1 text-xs text-mute">
            {stats.l1.hits} hits · {stats.l1.bytes} B · TTL 7d
          </p>
        </Card>
        <Card className="px-4 py-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-agent">L2 tickets</div>
          <div className="mt-2 font-mono text-2xl text-paper">{stats.l2.tickets}</div>
          <p className="mt-1 text-xs text-mute">artifact retention-days: 1 · só ponteiro</p>
        </Card>
        <Card className="px-4 py-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-object">L3 origin</div>
          <div className="mt-2 font-mono text-sm text-paper">actos/fs</div>
          <p className="mt-1 text-xs text-mute">git blob = verdade. L1 nunca é origem.</p>
        </Card>
      </div>

      <h2 className="mb-2 text-sm font-medium">L1</h2>
      <div className="mb-6 grid gap-1">
        {l1.length === 0 ? (
          <p className="text-sm text-mute">edge vazio — um write aquece o PoP.</p>
        ) : (
          l1.slice(0, 40).map((e) => (
            <Card key={e.sha} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
              <PathView path={e.path} />
              <span className="font-mono text-[11px] text-mute">
                {e.hits} hits · {e.sha.slice(0, 12)}
              </span>
            </Card>
          ))
        )}
      </div>

      <h2 className="mb-2 text-sm font-medium">L2 tickets</h2>
      <div className="grid gap-1">
        {l2.map((t) => (
          <Card key={t.runId + t.sha} className="px-4 py-2 font-mono text-[11px] text-mute">
            run {t.runId} → {t.sha.slice(0, 16)} · {t.path}
          </Card>
        ))}
      </div>
    </div>
  );
}
