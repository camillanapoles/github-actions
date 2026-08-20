import { cls, statusTone } from "@/lib/format";

export function Kicker({ children }: { children: React.ReactNode }) {
  return <div className="font-mono text-[11px] tracking-[0.22em] text-runtime">{children}</div>;
}

export function Title({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-8">
      <Kicker>ACTOS / KERNEL</Kicker>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-paper md:text-4xl">{children}</h1>
      {sub ? <p className="mt-3 max-w-2xl text-sm leading-relaxed text-mute">{sub}</p> : null}
    </div>
  );
}

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cls("rounded-xl border border-line/80 bg-ink-800/70 shadow-glow", className)}>{children}</div>
  );
}

export function Pill({ status }: { status: string }) {
  return (
    <span className={cls("font-mono text-[11px] uppercase tracking-wide", statusTone(status))}>{status}</span>
  );
}

export function Metric({
  label,
  value,
  hint,
  tone = "paper",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "paper" | "runtime" | "object" | "agent" | "cache";
}) {
  const color = {
    paper: "text-paper",
    runtime: "text-runtime",
    object: "text-object",
    agent: "text-agent",
    cache: "text-cache",
  }[tone];
  return (
    <Card className="px-4 py-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-mute">{label}</div>
      <div className={cls("mt-2 font-mono text-2xl tick", color)}>{value}</div>
      {hint ? <div className="mt-1 text-xs text-mute">{hint}</div> : null}
    </Card>
  );
}

export function PathView({ path }: { path: string }) {
  return <code className="break-all font-mono text-[11px] text-object">{path}</code>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-10 text-center text-sm text-mute">{children}</div>;
}
