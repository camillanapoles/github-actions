import { getKernel } from "@/domain/kernel";
import { Card, PathView, Title } from "@/components/ui";

export default async function PublicoPage() {
  const k = getKernel();
  const pub = k.exportPublic();
  return (
    <div>
      <Title sub="F5 — CDN público. Regras primeiro (deny some, redact secrets). URL imutável /obj/{sha}.json e estável pelo path. GitHub Pages = puter.hosting.create(dir) — liga-se depois na main, sem merge da sessão.">
        Público
      </Title>
      <Card className="mb-6 px-4 py-4">
        <div className="font-mono text-[11px] text-mute">{pub.dir}</div>
        <div className="mt-1 font-mono text-2xl text-object">{pub.n} objectos</div>
      </Card>
      <div className="grid gap-1">
        {pub.entries.slice(0, 60).map((e) => (
          <Card key={e.sha} className="px-4 py-2">
            <PathView path={e.path} />
            <div className="mt-1 font-mono text-[11px] text-cache">{e.immutable}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
