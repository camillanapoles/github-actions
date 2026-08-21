import { getKernel } from "@/domain/kernel";
import { Card, PathView, Title } from "@/components/ui";

export default async function DiscoPage() {
  const k = getKernel();
  const st = k.gitStatus();
  const files = k.gitLs("/");

  return (
    <div>
      <Title sub="L3 origin = refs/heads/actos/fs (órfão). 14 ahead / 5 behind da main é o facto correcto: o disco não leva código. Head tem de avançar (append). ls é ls-tree, não o worktree da sessão.">
        Disco · actos/fs
      </Title>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Card className="px-4 py-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-mute">head local / origin</div>
          <div className="mt-2 break-all font-mono text-xs text-object">{st.head?.slice(0, 12) ?? "—"}</div>
          <div className="mt-1 break-all font-mono text-[10px] text-mute">{st.remoteHead?.slice(0, 12) ?? "sem origin"}</div>
        </Card>
        <Card className="px-4 py-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-mute">inodes no tree</div>
          <div className="mt-2 font-mono text-2xl text-runtime">{st.files}</div>
        </Card>
        <Card className="px-4 py-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-mute">refs runtime</div>
          <div className="mt-2 font-mono text-2xl text-agent">{st.runtimeRefs.length}</div>
        </Card>
      </div>

      {st.runtimeRefs.length > 0 ? (
        <Card className="mb-6 px-4 py-4">
          <div className="mb-2 font-mono text-[11px] text-runtime">/proc · refs/actos/runtime/*</div>
          <ul className="space-y-1 font-mono text-[11px] text-mute">
            {st.runtimeRefs.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="grid gap-1">
        {files.length === 0 ? (
          <p className="text-sm text-mute">Tree vazia. Um `write` ou `npm run agent` materializa paths no origin git.</p>
        ) : (
          files.map((p) => (
            <Card key={p} className="px-4 py-2">
              <PathView path={p} />
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
