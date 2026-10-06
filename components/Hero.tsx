"use client";
import { useRef } from "react";
import market from "@/data/market_data.json";
import { Badge, Spark } from "./ui";
import { CountUp } from "./Motion";

type Stat = { label: string; value: number | string; sub?: string };

export default function Hero({ stats }: { stats: Stat[] }) {
  const ref = useRef<HTMLElement>(null);
  const move = (x: number, y: number) => {
    const r = ref.current?.getBoundingClientRect(); if (!r) return;
    ref.current!.style.setProperty("--mx", `${x - r.left}px`); ref.current!.style.setProperty("--my", `${y - r.top}px`);
  };
  const pts = market.sp_recent.map((p) => p.p);
  const lo = Math.min(...pts), hi = Math.max(...pts);
  const d = pts.map((v, i) => `${i ? "L" : "M"}${(i / (pts.length - 1)) * 100},${40 - ((v - lo) / (hi - lo)) * 36 - 2}`).join(" ");
  const sp = market.items.find((i) => i.id === "spx")!;
  return (
    <section id="home" ref={ref} onPointerMove={(e) => move(e.clientX, e.clientY)} className="spot relative overflow-hidden">
      <div className="mx-auto max-w-6xl px-4 sm:px-8 pt-14 sm:pt-24 pb-16 sm:pb-24">
        <div className="fade-up inline-flex items-center gap-2 rounded-full border border-line bg-paper/70 backdrop-blur px-3 py-1.5 text-sm text-brown" style={{ ["--d" as string]: "0ms" }}>
          <Spark className="h-4 w-4" /> Research lab, built with Claude
        </div>
        <div className="mt-8 grid lg:grid-cols-[1.25fr_1fr] gap-10 items-end">
          <div>
            <h1 aria-label="FLOW" className="font-serif font-semibold leading-[0.82] tracking-[0.02em] text-[27vw] sm:text-[11.5rem]">
              {"FLOW".split("").map((c, i) => <span key={i} aria-hidden className="hero-letter bg-gradient-to-b from-ink via-brown to-clay-dark bg-clip-text text-transparent [-webkit-background-clip:text]" style={{ ["--i" as string]: i }}>{c}</span>)}
            </h1>
            <p className="fade-up font-serif italic text-3xl sm:text-5xl mt-6 text-clay" style={{ ["--d" as string]: "450ms" }}>Research the edge.</p>
            <p className="fade-up mt-5 max-w-xl text-lg sm:text-xl text-muted leading-relaxed" style={{ ["--d" as string]: "600ms" }}>An interactive laboratory for investing, trading, strategy, and ideas.</p>
            <div className="fade-up mt-8 flex flex-wrap gap-3" style={{ ["--d" as string]: "750ms" }}>
              <a href="#opportunities" className="rounded-full bg-ink text-cream px-6 py-3 font-medium transition-transform duration-200 hover:-translate-y-0.5 active:scale-95">Explore the lab</a>
              <button onClick={() => dispatchEvent(new Event("flow:ask"))} className="inline-flex items-center gap-2 rounded-full bg-paper border border-line px-5 py-3 font-medium hover:border-clay">
                <Spark className="h-4 w-4" /> Ask Claude
              </button>
            </div>
          </div>
          <figure className="fade-up relative" style={{ ["--d" as string]: "300ms" }} aria-label={`S&P 500 over the last 5 years, now ${sp.value.toLocaleString()}`}>
            <Spark className="float absolute -top-6 right-2 h-10 w-10 opacity-90" />
            <div className="rounded-[28px] border border-line bg-paper/80 backdrop-blur p-5 sm:p-6 shadow-[0_30px_80px_-50px_rgb(41_35_31/.5)]">
              <div className="flex items-baseline justify-between"><span className="text-xs uppercase tracking-wider text-faint">S&amp;P 500 · 5 years</span><Badge t="CURRENT DATA" /></div>
              <div className="num font-serif text-4xl mt-1">{sp.value.toLocaleString()}</div>
              <div className="text-sm text-pos">+{((sp.change_12m ?? 0) * 100).toFixed(1)}% in 12 months</div>
              <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="mt-4 h-28 w-full overflow-visible" aria-hidden>
                <defs><linearGradient id="hg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c6613f" stopOpacity=".22" /><stop offset="1" stopColor="#c6613f" stopOpacity="0" /></linearGradient></defs>
                <path d={`${d} L100,40 L0,40 Z`} fill="url(#hg)" className="fade-up" style={{ ["--d" as string]: "1400ms" }} />
                <path d={d} pathLength={1} className="draw" fill="none" stroke="#c6613f" strokeWidth="1.4" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
              </svg>
            </div>
          </figure>
        </div>
        <div className="mt-16 sm:mt-24 grid grid-cols-2 sm:grid-cols-5 gap-y-8 gap-x-6 border-t border-line pt-8">
          {stats.map((s, i) => (
            <div key={s.label} className="fade-up min-w-0" style={{ ["--d" as string]: `${900 + i * 80}ms` }}>
              <div className="text-xs uppercase tracking-wider text-faint">{s.label}</div>
              <div className="font-serif text-3xl sm:text-4xl mt-1">{typeof s.value === "number" ? <CountUp to={s.value} /> : <span className="text-2xl sm:text-3xl">{s.value}</span>}</div>
              {s.sub && <div className="text-sm text-muted mt-1">{s.sub}</div>}
            </div>
          ))}
        </div>
        <p className="mt-10 flex flex-wrap gap-2 items-center text-sm text-muted">
          Every result is labeled: <Badge t="EDUCATION" /> <Badge t="SIMULATION" /> <Badge t="BACKTEST" /> <Badge t="CURRENT DATA" /> <Badge t="STALE DATA" /> <Badge t="RESEARCH HYPOTHESIS" />
        </p>
        <p className="mt-3 text-sm text-faint">Educational research only. No trades are executed. Historical performance does not guarantee future results.</p>
      </div>
    </section>
  );
}
