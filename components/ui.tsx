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

/** Claude's official mark (source: simple-icons "claude", brand color #D97757). Trademark of Anthropic, used to identify the Claude integration. */
export function Spark({ className = "", title, color = "#D97757" }: { className?: string; title?: string; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      <path fill={color} d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" />
    </svg>
  );
}
