import { notFound } from "next/navigation";
import { getKernel } from "@/domain/kernel";
import { Card, PathView, Title } from "@/components/ui";
import { ObjectPath } from "@/domain/path";

export default async function ObjetoPathPage({ params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const resolved = "/" + path.join("/");
  const k = getKernel();
  let obj;
  try {
    obj = k.read(resolved);
  } catch {
    const parsed = ObjectPath.parse(resolved);
    if (!parsed) notFound();
    try {
      obj = k.read(ObjectPath.from(parsed.pattern, parsed.params).resolve());
    } catch {
      notFound();
    }
  }

  return (
    <div>
      <Title sub={`pattern ${obj.pattern} · kind ${obj.kind}`}>
        Objeto
      </Title>
      <Card className="px-4 py-4">
        <PathView path={obj.path} />
        <dl className="mt-4 grid gap-2 font-mono text-xs text-mute sm:grid-cols-2">
          <div>id {obj.id}</div>
          <div>updated {obj.updatedAt}</div>
        </dl>
        <pre className="mt-4 overflow-auto rounded-md bg-ink-950 p-4 text-[11px] text-paper scrollbar-thin">
          {JSON.stringify(obj.payload, null, 2)}
        </pre>
        <pre className="mt-3 overflow-auto rounded-md border border-line p-3 text-[11px] text-mute scrollbar-thin">
          metadata {JSON.stringify(obj.metadata, null, 2)}
        </pre>
      </Card>
    </div>
  );
}
