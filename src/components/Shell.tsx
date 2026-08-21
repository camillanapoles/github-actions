import Link from "next/link";
import { SessionNotice } from "@/components/SessionNotice";

const NAV = [
  { href: "/", label: "Kernel", k: "01" },
  { href: "/runtime", label: "Runtime", k: "02" },
  { href: "/execucoes", label: "Execuções", k: "03" },
  { href: "/objetos", label: "Objetos", k: "04" },
  { href: "/disco", label: "Disco git", k: "04b" },
  { href: "/cdn", label: "CDN", k: "04c" },
  { href: "/agentes", label: "Agentes", k: "05" },
  { href: "/regras", label: "Regras", k: "06" },
  { href: "/sys", label: "Syscalls", k: "07" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <div className="grid-fade pointer-events-none fixed inset-x-0 top-0 h-64" />
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-56 flex-col border-r border-line/80 bg-ink-900/80 px-4 py-6 backdrop-blur md:flex">
        <Link href="/" className="mb-8 px-2">
          <div className="font-mono text-[11px] tracking-[0.28em] text-runtime">ACTOS</div>
          <div className="mt-1 text-sm font-medium text-paper">Actions OS</div>
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="group flex items-center gap-3 rounded-md px-2 py-2 text-sm text-mute transition hover:bg-ink-700 hover:text-paper"
            >
              <span className="font-mono text-[10px] text-line group-hover:text-runtime">{n.k}</span>
              {n.label}
            </Link>
          ))}
        </nav>
        <p className="px-2 font-mono text-[10px] leading-relaxed text-line">
          espaço único = runtime
          <br />
          após resolve = objeto
          <br />
          path = pattern + id
        </p>
      </aside>
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line/60 bg-ink-950/80 px-4 py-3 backdrop-blur md:hidden">
        <span className="font-mono text-xs tracking-[0.28em] text-runtime">ACTOS</span>
        <nav className="flex gap-3 overflow-x-auto font-mono text-[11px] text-mute">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="whitespace-nowrap hover:text-paper">
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="relative md:pl-56">
        <div className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-10">
          <SessionNotice />
          {children}
        </div>
      </main>
    </div>
  );
}
