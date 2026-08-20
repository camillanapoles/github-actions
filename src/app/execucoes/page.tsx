import { getKernel } from "@/domain/kernel";
import { Card, PathView, Pill, Title } from "@/components/ui";
import { ago, shortSha } from "@/lib/format";
import { resolveAction } from "@/app/actions";
import { PATTERNS } from "@/domain/path";
import { ObjectPath } from "@/domain/path";

/**
 * Page async: Server Component lê a base e devolve
 * o resultado de execuções cacheadas das GitHub Actions.
 */
export default async function ExecucoesPage() {
  const k = getKernel();
  const all = k.listExecutions();
  const cached = all.filter((e) => e.status === "cached");
  const live = all.filter((e) => e.status === "in_runtime");

  return (
    <div>
      <Title sub="Page async (RSC). Os dados vêm da base — não do browser. Cada execução cacheada é o resultado materializado de uma GitHub Action, já resolvida em objeto.">
        Execuções cacheadas
      </Title>

      {live.length > 0 ? (
        <Card className="mb-6 px-4 py-4">
          <div className="mb-3 font-mono text-[11px] uppercase tracking-widest text-runtime">ainda no espaço único</div>
          <ul className="space-y-3">
            {live.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-mono text-sm">{e.workflow}</div>
                  <PathView path={ObjectPath.named("runtimeRun", { id: e.runId }).resolve()} />
                </div>
                <form action={resolveAction}>
                  <input type="hidden" name="id" value={e.id} />
                  <button className="rounded-md border border-runtime/40 px-3 py-1.5 font-mono text-[11px] text-runtime hover:bg-runtime/10">
                    resolve → objeto
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="mb-4 font-mono text-[11px] text-mute">
        pattern {PATTERNS.cache} · {cached.length} no disco analog
      </div>

      <div className="grid gap-4">
        {all.map((e) => {
          const cachePath = ObjectPath.named("cache", {
            workflow: e.workflow,
            sha: e.sha,
            id: e.id,
          }).resolve();
          const objectPath = ObjectPath.named("object", { kind: "execution", id: e.id }).resolve();
          return (
            <Card key={e.id} className="px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-paper">{e.workflow}</span>
                    <Pill status={e.status} />
                    {e.cacheHit ? <span className="font-mono text-[10px] text-cache">HIT</span> : null}
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-mute">
                    run {e.runId} · {e.event} · {e.actor} · {e.branch} @ {shortSha(e.sha)} · {ago(e.createdAt)}
                  </div>
                </div>
                <div className="text-right font-mono text-[11px] text-mute">{e.conclusion ?? "—"}</div>
              </div>
              <div className="mt-3 grid gap-1">
                <div>
                  <span className="mr-2 font-mono text-[10px] text-line">OBJ</span>
                  <PathView path={objectPath} />
                </div>
                <div>
                  <span className="mr-2 font-mono text-[10px] text-line">CACHE</span>
                  <PathView path={cachePath} />
                </div>
                <div>
                  <span className="mr-2 font-mono text-[10px] text-line">KEY</span>
                  <code className="font-mono text-[11px] text-cache">{e.cacheKey}</code>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {e.jobs.flatMap((j) =>
                  j.steps.map((s) => (
                    <span
                      key={j.id + s.name}
                      className="rounded border border-line px-2 py-1 font-mono text-[10px] text-mute"
                    >
                      {s.name}
                    </span>
                  )),
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
