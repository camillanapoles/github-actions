import Link from "next/link";
import { getKernel } from "@/domain/kernel";
import { Card, PathView, Title } from "@/components/ui";
import { writeObjectAction } from "@/app/actions";
import { ago } from "@/lib/format";

export default async function ObjetosPage() {
  const k = getKernel();
  const list = k.ls("/");
  const kinds = [...new Set(list.map((o) => o.kind))];

  return (
    <div>
      <Title sub="Backend orientado a objeto. A base não é uma tabela solta: cada row é um StoredObject com path derivado de pattern + id. CRUD existe; as syscalls (write com regras, resolve, cache) estão acima.">
        Object store
      </Title>

      <Card className="mb-6 px-4 py-4">
        <form action={writeObjectAction} className="grid gap-3 md:grid-cols-[140px_1fr_auto]">
          <input
            name="kind"
            defaultValue="note"
            className="rounded-md border border-line bg-ink-900 px-3 py-2 font-mono text-sm"
            placeholder="kind"
          />
          <input
            name="payload"
            defaultValue='{"hello":"actos"}'
            className="rounded-md border border-line bg-ink-900 px-3 py-2 font-mono text-sm"
          />
          <button className="rounded-md bg-object px-4 py-2 font-mono text-xs text-ink-950">write</button>
        </form>
        <p className="mt-2 font-mono text-[11px] text-mute">grava em /objects/{"{kind}"}/{"{id}"} · regras aplicadas no write</p>
      </Card>

      <div className="mb-4 flex flex-wrap gap-2">
        {kinds.map((kind) => (
          <span key={kind} className="rounded-full border border-line px-3 py-1 font-mono text-[11px] text-mute">
            {kind}
          </span>
        ))}
      </div>

      <div className="grid gap-2">
        {list.map((o) => (
          <Link key={o.id} href={`/objetos${o.path}`}>
            <Card className="px-4 py-3 transition hover:border-object/40">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <PathView path={o.path} />
                  <div className="mt-1 font-mono text-[11px] text-mute">
                    {o.kind} · {o.pattern} · {ago(o.updatedAt)}
                  </div>
                </div>
                <span className="font-mono text-[10px] text-line">{o.id}</span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
