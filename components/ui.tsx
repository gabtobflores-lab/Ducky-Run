import type { ReactNode } from "react";

export function Section({ id, n, title, lede, children, tone = "cream" }: { id: string; n: string; title: string; lede?: string; children: ReactNode; tone?: "cream" | "paper" | "ink" }) {
  const bg = tone === "paper" ? "bg-paper" : tone === "ink" ? "bg-ink text-cream" : "";
  return (
    <section id={id} aria-labelledby={`${id}-h`} className={`${bg} border-t border-line/80 ${tone === "ink" ? "border-ink" : ""}`}>
      <div className="mx-auto max-w-6xl px-4 sm:px-8 py-16 sm:py-24">
        <div className="mb-10 sm:mb-14 max-w-3xl">
          <p className={`text-xs font-medium tracking-[0.18em] uppercase ${tone === "ink" ? "text-coral" : "text-clay"}`}>{n}</p>
          <h2 id={`${id}-h`} className="font-serif text-4xl sm:text-6xl leading-[1.02] tracking-tight mt-3">{title}</h2>
          {lede && <p className={`mt-5 text-lg sm:text-xl leading-relaxed ${tone === "ink" ? "text-sand" : "text-muted"}`}>{lede}</p>}
        </div>
        {children}
      </div>
    </section>
  );
}

const BADGE: Record<string, string> = {
  EDUCATION: "bg-beige text-brown",
  SIMULATION: "bg-blush text-clay-dark",
  BACKTEST: "bg-[#e3e9dc] text-pos",
  "CURRENT DATA": "bg-[#e3e9dc] text-pos",
  "STALE DATA": "bg-[#f1e4c9] text-[#7a5a1f]",
  "RESEARCH HYPOTHESIS": "bg-[#ece4f0] text-[#5d4670]",
};
export function Badge({ t }: { t: string }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide whitespace-nowrap ${BADGE[t] ?? "bg-beige text-brown"}`}>{t}</span>;
}

export function H3({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h3 className={`font-serif text-2xl sm:text-3xl tracking-tight ${className}`}>{children}</h3>;
}

export function Stat({ label, value, sub, cls = "" }: { label: string; value: ReactNode; sub?: ReactNode; cls?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-xs uppercase tracking-wider text-faint">{label}</div>
      <div className={`num font-serif text-3xl sm:text-4xl mt-1 ${cls}`}>{value}</div>
      {sub && <div className="text-sm text-muted mt-1">{sub}</div>}
    </div>
  );
}

export function Expand({ title, children, meta }: { title: ReactNode; children: ReactNode; meta?: ReactNode }) {
  return (
    <details className="group border-b border-line">
      <summary className="flex items-center gap-3 py-4 hover:text-clay-dark">
        <svg className="chev h-3.5 w-3.5 shrink-0 text-clay" viewBox="0 0 12 12" aria-hidden><path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <span className="flex-1 font-medium">{title}</span>
        {meta && <span className="text-sm text-muted">{meta}</span>}
      </summary>
      <div className="pb-5 pl-6.5 text-muted leading-relaxed">{children}</div>
    </details>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted border-l-2 border-clay/60 pl-3 my-6 max-w-3xl leading-relaxed">{children}</p>;
}

export function Spark({ className = "", title }: { className?: string; title?: string }) {
  // Original FLOW-drawn spark: 10 tapered rays of varied length
  const rays = [1, 0.78, 0.95, 0.72, 1, 0.82, 0.92, 0.7, 0.98, 0.8];
  return (
    <svg viewBox="-50 -50 100 100" className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      {rays.map((l, i) => (
        <path key={i} transform={`rotate(${i * 36 + (i % 2) * 4})`} d={`M-4.2 0 Q-3 ${-46 * l * 0.55} 0 ${-46 * l} Q3 ${-46 * l * 0.55} 4.2 0 Z`} fill="currentColor" />
      ))}
      <circle r="6" fill="currentColor" />
    </svg>
  );
}
