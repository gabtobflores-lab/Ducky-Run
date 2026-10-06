"use client";
import { useMemo, useState } from "react";
import sw from "@/data/swing_backtests.json";
import edu from "@/data/education.json";
import strat from "@/data/trading_strategies.json";
import inv from "@/data/investments.json";
import market from "@/data/market_data.json";
import { Badge, Expand, H3, Note, Section } from "./ui";
import { pct, num } from "@/lib/fmt";

type St = NonNullable<(typeof sw.strategies)[number]["train"]>;
const ROWS: [string, (s: St) => string][] = [
  ["Trades", (s) => String(s.trades)], ["Win rate", (s) => pct(s.win_rate, 0)], ["Average win", (s) => pct(s.avg_win, 1)], ["Average loss", (s) => pct(s.avg_loss, 1)],
  ["Profit factor", (s) => num(s.profit_factor)], ["Payoff (risk/reward)", (s) => num(s.payoff)], ["Max drawdown", (s) => pct(s.maxdd, 0)], ["Avg hold (days)", (s) => num(s.avg_hold, 0)], ["Exposure", (s) => pct(s.exposure, 0)],
];
const verdict = (tr?: St | null, te?: St | null) => {
  if (!tr || !te) return ["n/a", "text-muted"];
  if ((tr.profit_factor ?? 0) > 1.3 && (te.profit_factor ?? 0) > 1.3) return ["Survived out-of-sample", "text-pos"];
  if ((te.profit_factor ?? 0) < 1) return ["Failed out-of-sample", "text-neg"];
  return ["Inconsistent", "text-gold"];
};

export default function Swing() {
  const [id, setId] = useState(sw.strategies[0].id);
  const s = sw.strategies.find((x) => x.id === id)!;
  const [v, c] = verdict(s.train, s.test);
  return (
    <Section id="swing" n="06 — Swing Trading" title="Days to weeks." lede="What moves prices over a few weeks — and which classic rules survive contact with out-of-sample data.">
      <div className="flex items-center gap-2 mb-4"><Badge t="EDUCATION" /></div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-10 border-t border-line">
        {edu.swing.map((e) => <div key={e.term} className="py-4 border-b border-line"><div className="font-medium">{e.term}</div><p className="text-sm text-muted mt-1 leading-relaxed">{e.simple}</p></div>)}
      </div>

      <div className="mt-20">
        <div className="flex items-center gap-2 flex-wrap"><H3>Strategy experiments</H3><Badge t="BACKTEST" /></div>
        <Note>{sw.data_note} Costs: {sw.cost_assumption}. Split: {sw.split}.</Note>
        <div className="grid lg:grid-cols-[260px_1fr] gap-8">
          <div role="tablist" aria-label="Swing strategies" className="flex lg:flex-col gap-1 overflow-x-auto scrollbar-none -mx-4 px-4 lg:mx-0 lg:px-0">
            {sw.strategies.map((x) => { const [vv, cc] = verdict(x.train, x.test); return (
              <button key={x.id} role="tab" aria-selected={id === x.id} onClick={() => setId(x.id)} className={`shrink-0 text-left rounded-lg px-3 py-2.5 transition-colors ${id === x.id ? "bg-ink text-cream" : "hover:bg-beige"}`}>
                <div className="text-sm font-medium whitespace-nowrap">{x.name}</div><div className={`text-xs ${id === x.id ? "text-sand" : cc}`}>{vv}</div>
              </button>); })}
            {strat.untested.slice(0, 2).map((u) => <div key={u.name} className="shrink-0 rounded-lg px-3 py-2.5 text-faint"><div className="text-sm whitespace-nowrap">{u.name}</div><div className="text-xs">Not tested</div></div>)}
          </div>
          <div role="tabpanel">
            <div className="flex items-baseline justify-between gap-4 flex-wrap"><h4 className="font-serif text-3xl">{s.name}</h4><span className={`text-sm font-medium ${c}`}>{v}</span></div>
            <p className="text-muted mt-2">{s.why}</p>
            <ul className="mt-4 text-sm space-y-1">{s.rules.map((r) => <li key={r} className="flex gap-2"><span className="text-clay">→</span>{r}</li>)}</ul>
            <table className="mt-6 w-full text-sm num">
              <thead><tr className="text-left text-faint text-xs uppercase tracking-wider border-b border-line"><th className="py-2 font-medium">Metric</th><th className="font-medium">Train 1986–2005</th><th className="font-medium">Test 2006–2026</th></tr></thead>
              <tbody className="divide-y divide-line">{ROWS.map(([k, f]) => <tr key={k}><td className="py-2 text-muted">{k}</td><td>{s.train ? f(s.train) : "—"}</td><td className="font-medium">{s.test ? f(s.test) : "—"}</td></tr>)}</tbody>
            </table>
            <p className="text-xs text-faint mt-3">Win rate alone is misleading: pullback rules win often but lose more per loser (payoff &lt; 1). One regime shift turns them negative.</p>
          </div>
        </div>
        <div className="mt-10 border-t border-line">
          {strat.untested.map((u) => <Expand key={u.name} title={u.name} meta="not tested">{u.reason}</Expand>)}
        </div>
      </div>
      <Scanner />
    </Section>
  );
}

/* ----------------------------- simulated scanner ----------------------------- */
const F = [
  { k: "trend", label: "Trend", key: "m" }, { k: "momentum", label: "Momentum", key: "m" }, { k: "lowvol", label: "Calm volatility", key: "s", inv: true },
  { k: "rs", label: "Relative strength", key: "x" }, { k: "valuation", label: "Valuation", key: "v" }, { k: "catalyst", label: "Catalyst", key: "c" },
] as const;
function Scanner() {
  const riskOn = market.items.find((i) => i.id === "spx")?.above_10m_sma;
  const [w, setW] = useState<Record<string, number>>({ trend: 3, momentum: 2, lowvol: 1, rs: 1, valuation: 1, catalyst: 2 });
  const [regime, setRegime] = useState(true);
  const [minMom, setMinMom] = useState(5);
  const ranked = useMemo(() => {
    const tot = Object.values(w).reduce((a, b) => a + b, 0) || 1;
    return inv.items.filter((i) => i.scores.m >= minMom).map((i) => {
      const parts = F.map((f) => { const raw = (i.scores as Record<string, number>)[f.key]; const val = "inv" in f ? 10 - raw : raw; return { k: f.label, c: (w[f.k] / tot) * val }; });
      let score = parts.reduce((a, p) => a + p.c, 0);
      if (regime && !riskOn) score *= 0.6;
      return { t: i.ticker, n: i.company, score, parts: parts.sort((a, b) => b.c - a.c) };
    }).sort((a, b) => b.score - a.score).slice(0, 10);
  }, [w, regime, minMom, riskOn]);
  return (
    <div className="mt-20 border-t border-line pt-12">
      <div className="flex items-center gap-2 flex-wrap"><H3>Simulated swing scanner</H3><Badge t="SIMULATION" /></div>
      <p className="text-muted mt-2 max-w-3xl">Ranks the research universe on swing-relevant traits. Inputs are FLOW&apos;s mid-2026 factor scores, not live prices — an educational model of how a scanner thinks.</p>
      <div className="mt-8 grid lg:grid-cols-[320px_1fr] gap-10">
        <div className="space-y-3">
          {F.map((f) => (
            <div key={f.k} className="grid grid-cols-[1fr_120px_20px] items-center gap-3">
              <label htmlFor={`f-${f.k}`} className="text-sm">{f.label}</label>
              <input id={`f-${f.k}`} type="range" min={0} max={5} value={w[f.k]} onChange={(e) => setW({ ...w, [f.k]: +e.target.value })} />
              <span className="num text-sm text-muted">{w[f.k]}</span>
            </div>
          ))}
          <div className="grid grid-cols-[1fr_120px_20px] items-center gap-3"><label htmlFor="f-min" className="text-sm">Min momentum</label><input id="f-min" type="range" min={0} max={9} value={minMom} onChange={(e) => setMinMom(+e.target.value)} /><span className="num text-sm text-muted">{minMom}</span></div>
          <label className="flex items-center gap-2 text-sm pt-2"><input type="checkbox" checked={regime} onChange={(e) => setRegime(e.target.checked)} className="accent-clay h-4 w-4" />Market-regime filter (now: <span className={riskOn ? "text-pos" : "text-neg"}>{riskOn ? "risk-on" : "risk-off"}</span>)</label>
        </div>
        <ol className="divide-y divide-line border-y border-line" aria-live="polite">
          {ranked.length === 0 && <li className="py-6 text-muted">No candidates pass the momentum filter.</li>}
          {ranked.map((r, i) => (
            <li key={r.t} className="py-3 grid grid-cols-[28px_1fr_auto] gap-3 items-center">
              <span className="num text-faint">{i + 1}</span>
              <div className="min-w-0">
                <div><span className="font-semibold">{r.t}</span> <span className="text-muted text-sm">{r.n}</span></div>
                <div className="text-xs text-muted mt-0.5 truncate">Why: {r.parts.slice(0, 3).map((p) => p.k.toLowerCase()).join(" + ")}</div>
                <div className="mt-1.5 flex h-1.5 rounded-full overflow-hidden bg-beige">{r.parts.map((p, j) => <span key={p.k} className="anim-w" style={{ width: `${p.c * 10}%`, background: ["#c6613f", "#dc8a6c", "#b88a3c", "#93877c", "#4b3a2e", "#ddd2bf"][j] }} title={`${p.k} ${p.c.toFixed(1)}`} />)}</div>
              </div>
              <span className="num font-serif text-2xl">{r.score.toFixed(1)}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
