"use client";
import { useMemo, useState } from "react";
import f from "@/data/flow_formulas.json";
import inv from "@/data/investments.json";
import { Badge, H3, Section } from "./ui";
import { ppt } from "@/lib/fmt";

const NAMES: Record<string, string> = { g: "Growth", o: "Optionality", m: "Momentum", x: "Expectation gap", c: "Catalyst", q: "Quality", b: "Balance sheet", v: "Valuation", lowvol: "Low volatility" };
type W = Record<string, number>;
function score(w: W, s: Record<string, number>) { return Object.entries(w).reduce((a, [k, v]) => a + v * (k === "lowvol" ? 10 - s.s : s[k]), 0); }

export default function Formulas() {
  const [mode, setMode] = useState<"extreme" | "core">("extreme");
  const base = (mode === "extreme" ? f.extreme.weights : f.core.weights) as W;
  const [w, setW] = useState<{ extreme: W; core: W }>({ extreme: { ...f.extreme.weights }, core: { ...f.core.weights } });
  const cur = w[mode];
  const tot = Object.values(cur).reduce((a, b) => a + b, 0) || 1;
  const ranked = useMemo(() => inv.items
    .filter((i) => mode === "core" || i.scores.b >= 5)
    .map((i) => ({ t: i.ticker, s: score(Object.fromEntries(Object.entries(cur).map(([k, v]) => [k, v / tot])), i.scores as Record<string, number>) }))
    .sort((a, b) => b.s - a.s).slice(0, 10), [cur, tot, mode]);
  const official = (mode === "extreme" ? f.extreme.top : f.core.top) as string[];
  const overlap = ranked.filter((r) => official.includes(r.t)).length;
  const E = f.extreme, C = f.core;
  const rows: [string, string, string][] = [
    ["Risk", "Very high", "Moderate"], ["Potential upside (top-10 avg, 3y)", `Bull ${ppt(E.avg_bull)} · Extreme ${ppt(E.avg_xbull)}`, `Bull ${ppt(C.avg_bull)} · Extreme ${ppt(C.avg_xbull)}`],
    ["Potential downside (bear, 3y)", ppt(E.avg_bear), ppt(C.avg_bear)], ["Volatility score (0–10)", String(E.avg_vol_score), String(C.avg_vol_score)],
    ["Maximum drawdown", E.est_maxdd, C.est_maxdd], ["Time horizon", E.horizon, C.horizon], ["Diversification", "8 names, ≤20% each, correlated themes", "12 names, ≤12% each, ≤30% per sector"],
    ["Complexity", "5 inputs + gate + kill rule", "6 inputs + trend overlay"], ["Robustness (top-10 stability under ±50% weight noise)", `${Math.round(E.robustness * 100)}%`, `${Math.round(C.robustness * 100)}%`],
    ["Correlation with momentum alone", String(E.corr_momentum), String(C.corr_momentum)], ["Historical / backtest", "None at stock level (no point-in-time data)", "Trend overlay: 1900–2026 tested"],
    ["Out-of-sample", E.oos, C.oos], ["Best environment", E.best_env, C.best_env], ["Worst environment", E.worst_env, C.worst_env], ["Failure mode", E.failure[0], C.failure[0]],
  ];
  return (
    <Section id="formulas" n="14 — FLOW Formulas" title="Two formulas. Opposite jobs." lede="FLOW EXTREME hunts asymmetric upside and accepts brutal drawdowns. FLOW CORE compounds while avoiding ruin. CORE is not a weaker EXTREME — their rankings are negatively correlated.">
      <div className="flex flex-wrap items-center gap-2 mb-8"><Badge t="RESEARCH HYPOTHESIS" /><span className="text-sm text-muted num">Rank correlation EXTREME vs CORE: {f.corr_extreme_core} · shared top-10 names: {f.overlap_top10}</span></div>
      <div className="grid md:grid-cols-2 gap-px bg-line border border-line rounded-2xl overflow-hidden">
        {[E, C].map((x, n) => (
          <div key={x.name} className={n === 0 ? "bg-ink text-cream p-6 sm:p-8" : "bg-paper p-6 sm:p-8"}>
            <div className={`text-xs uppercase tracking-[0.18em] ${n === 0 ? "text-coral" : "text-clay"}`}>{n === 0 ? "Super-risky" : "Less-risky"}</div>
            <h3 className="font-serif text-4xl mt-2">{x.name}</h3>
            <p className={`mt-4 font-mono text-[13px] leading-6 ${n === 0 ? "text-sand" : "text-brown"}`}>{x.formula}</p>
            <p className={`mt-4 text-sm ${n === 0 ? "text-sand" : "text-muted"}`}>{n === 0 ? E.sizing : `${C.sizing} ${C.overlay}`}</p>
            <ul className={`mt-5 space-y-2 text-sm ${n === 0 ? "text-cream/90" : ""}`}>{x.why_weights.map((y) => <li key={y} className="flex gap-2"><span className={n === 0 ? "text-coral" : "text-clay"}>·</span>{y}</li>)}</ul>
            <div className={`mt-6 text-xs uppercase tracking-wider ${n === 0 ? "text-sand" : "text-faint"}`}>Current top 10</div>
            <div className="mt-2 flex flex-wrap gap-1.5">{(x.top as string[]).map((t) => <span key={t} className={`rounded px-2 py-0.5 text-xs font-semibold ${n === 0 ? "bg-white/10" : "bg-beige"}`}>{t}</span>)}</div>
          </div>
        ))}
      </div>

      <div className="mt-16">
        <H3>Head to head</H3>
        <div className="mt-6 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wider border-b border-line"><th className="py-2 font-medium text-faint w-[26%]" /><th className="font-medium text-clay-dark">FLOW EXTREME</th><th className="font-medium text-pos">FLOW CORE</th></tr></thead>
            <tbody className="divide-y divide-line">{rows.map(([k, a, b]) => <tr key={k} className="align-top"><td className="py-2.5 pr-4 text-muted">{k}</td><td className="py-2.5 pr-4">{a}</td><td className="py-2.5">{b}</td></tr>)}</tbody>
          </table>
        </div>
      </div>

      <div className="mt-16 grid lg:grid-cols-[1fr_1fr] gap-12">
        <div>
          <div className="flex items-center gap-2"><H3>Stress the weights yourself</H3><Badge t="SIMULATION" /></div>
          <p className="text-sm text-muted mt-2">Change any weight and watch the ranking. A good formula should not depend on exact numbers.</p>
          <div role="tablist" className="mt-4 flex gap-2">
            {(["extreme", "core"] as const).map((m) => <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={`rounded-full px-4 py-1.5 text-sm font-medium ${mode === m ? "bg-ink text-cream" : "bg-beige hover:bg-sand"}`}>{m === "extreme" ? "EXTREME" : "CORE"}</button>)}
          </div>
          <div className="mt-5 space-y-3">
            {Object.keys(base).map((k) => (
              <div key={k} className="grid grid-cols-[120px_1fr_44px] items-center gap-3">
                <label htmlFor={`fw-${k}`} className="text-sm">{NAMES[k]}</label>
                <input id={`fw-${k}`} type="range" min={0} max={0.6} step={0.05} value={cur[k]} onChange={(e) => setW({ ...w, [mode]: { ...cur, [k]: +e.target.value } })} />
                <span className="num text-sm text-muted text-right">{Math.round((cur[k] / tot) * 100)}%</span>
              </div>
            ))}
          </div>
          <button onClick={() => setW({ ...w, [mode]: { ...base } })} className="mt-3 text-sm text-clay hover:underline">Reset to FLOW weights</button>
        </div>
        <div>
          <div className="flex items-baseline justify-between"><div className="text-xs uppercase tracking-wider text-faint">Your top 10</div><div className="text-sm num" aria-live="polite">{overlap}/10 match FLOW&apos;s list</div></div>
          <ol className="mt-3 divide-y divide-line border-y border-line">
            {ranked.map((r, i) => (
              <li key={r.t} className="py-2 grid grid-cols-[24px_64px_1fr_44px] items-center gap-3 text-sm">
                <span className="num text-faint">{i + 1}</span><span className={`font-semibold ${official.includes(r.t) ? "" : "text-clay"}`}>{r.t}</span>
                <span className="h-1.5 rounded-full bg-beige overflow-hidden"><span className="block h-full bg-clay anim-w" style={{ width: `${r.s * 10}%` }} /></span>
                <span className="num text-right">{r.s.toFixed(1)}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="mt-16">
        <H3>Versions tested and rejected</H3>
        <div className="mt-6 grid md:grid-cols-2 gap-10">
          {[E, C].map((x) => (
            <div key={x.name}>
              <div className="text-xs uppercase tracking-wider text-faint mb-2">{x.name}</div>
              <ul className="divide-y divide-line border-y border-line">{x.versions.map((v) => <li key={v.name} className="py-3 text-sm"><div className="font-medium">{v.name}</div><div className="text-muted mt-0.5">{v.verdict}</div><div className="text-xs text-faint mt-1 num">Top 5: {v.top5.join(", ")} · stability {Math.round(v.stability * 100)}% · corr. w/ momentum {v.corr_momentum}</div></li>)}</ul>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
