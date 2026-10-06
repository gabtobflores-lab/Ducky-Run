"use client";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import edu from "@/data/education.json";
import { DEFAULTS, discover, run, type Discovery, type Params } from "@/lib/quant";
import { Badge, Expand, H3, Note, Section } from "./ui";
import { Drawdown, Equity } from "./Charts";
import { pct, num } from "@/lib/fmt";

const PRESETS: [string, number, number][] = [["Full 1900–2026", 1900, 2026], ["Train 1900–1979", 1900, 1979], ["Test 1980–2026", 1980, 2026], ["Since 2000", 2000, 2026]];

export default function Quant() {
  const [p, setP] = useState<Params>(DEFAULTS);
  const dp = useDeferredValue(p);
  const r = useMemo(() => run(dp), [dp]);
  const up = <K extends keyof Params>(k: K, v: Params[K]) => setP((x) => ({ ...x, [k]: v }));
  const slider = (k: keyof Params, label: string, min: number, max: number, step: number, fmt: (v: number) => string) => (
    <div>
      <div className="flex justify-between text-sm"><label htmlFor={`q-${k}`}>{label}</label><span className="num text-muted">{fmt(p[k] as number)}</span></div>
      <input id={`q-${k}`} type="range" min={min} max={max} step={step} value={p[k] as number} onChange={(e) => up(k, +e.target.value as never)} />
    </div>
  );
  const M: [string, string, string?][] = [
    ["Total return", r.total > 9 ? `${Math.round(1 + r.total).toLocaleString()}×` : pct(r.total, 0)], ["Annualized", pct(r.cagr, 1), r.cagr > r.bh.cagr ? "text-pos" : ""], ["Volatility", pct(r.vol, 1)], ["Max drawdown", pct(r.maxdd, 0), "text-neg"],
    ["Sharpe", num(r.sharpe), r.sharpe > r.bh.sharpe ? "text-pos" : "text-neg"], ["Sortino", num(r.sortino)], ["Win rate", pct(r.win, 0)], ["Trades", String(r.trades)],
    ["Average win", pct(r.avgWin, 1)], ["Average loss", pct(r.avgLoss, 1)], ["Profit factor", num(r.pf)], ["Exposure", pct(r.exposure, 0)],
  ];
  return (
    <Section id="quant" n="07 — Quant Trading" title="Measure everything." lede="The vocabulary of quantitative trading, then a playground running on 126 years of real S&P 500 data — in your browser.">
      <div className="flex items-center gap-2 mb-2"><Badge t="EDUCATION" /></div>
      <div className="grid md:grid-cols-2 gap-x-12 border-t border-line">
        {[edu.quant.slice(0, 13), edu.quant.slice(13)].map((col, i) => <div key={i}>{col.map((q) => <Expand key={q.term} title={<span>{q.term} <span className="text-muted font-normal">— {q.simple}</span></span>}>{q.deep}</Expand>)}</div>)}
      </div>

      <div className="mt-20" id="playground">
        <div className="flex items-center gap-2 flex-wrap"><H3>Quant playground</H3><Badge t="BACKTEST" /></div>
        <p className="text-muted mt-2 max-w-3xl">Rule: invested when price is above its moving average AND momentum exceeds the entry threshold; exit when either breaks (exit threshold). Signals are decided at month-end and applied the next month. 10 bps per trade. Cash earns a T-bill proxy.</p>
        <div className="mt-8 grid lg:grid-cols-[300px_1fr] gap-10">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map(([l, a, b]) => <button key={l} onClick={() => setP((x) => ({ ...x, from: a, to: b }))} className={`rounded-full px-3 py-1 text-xs ${p.from === a && p.to === b ? "bg-ink text-cream" : "bg-beige hover:bg-sand"}`}>{l}</button>)}
            </div>
            {slider("ma", "Moving-average period", 1, 24, 1, (v) => (v <= 1 ? "off" : `${v} mo`))}
            {slider("mom", "Momentum period", 1, 24, 1, (v) => `${v} mo`)}
            {slider("entry", "Entry threshold (momentum)", -0.2, 0.2, 0.01, (v) => (v <= -0.2 ? "off" : pct(v, 0)))}
            {slider("exit", "Exit threshold (momentum)", -0.3, 0.1, 0.01, (v) => (v <= -0.3 ? "off" : pct(v, 0)))}
            {slider("volLook", "Volatility lookback", 3, 36, 1, (v) => `${v} mo`)}
            {slider("volCap", "Volatility filter (max)", 0, 0.4, 0.01, (v) => (v === 0 ? "off" : pct(v, 0)))}
            {slider("maxAlloc", "Maximum allocation", 0.1, 1, 0.05, (v) => pct(v, 0))}
            <div className="grid grid-cols-2 gap-3">
              <div><label htmlFor="q-reb" className="text-sm">Rebalancing</label>
                <select id="q-reb" value={p.rebalance} onChange={(e) => up("rebalance", +e.target.value as 1 | 3 | 12)} className="mt-1 w-full rounded-md border border-sand bg-paper px-2 py-2 text-sm"><option value={1}>Monthly</option><option value={3}>Quarterly</option><option value={12}>Yearly</option></select></div>
              <div><label htmlFor="q-wt" className="text-sm">Weighting</label>
                <select id="q-wt" value={p.weighting} onChange={(e) => up("weighting", e.target.value as Params["weighting"])} className="mt-1 w-full rounded-md border border-sand bg-paper px-2 py-2 text-sm"><option value="binary">All-in / out</option><option value="vol">Vol-target 15%</option><option value="momentum">Momentum-scaled</option></select></div>
            </div>
            <button onClick={() => setP(DEFAULTS)} className="text-sm text-clay hover:underline">Reset to 10-month trend</button>
          </div>
          <div className="min-w-0">
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-px bg-line border border-line rounded-xl overflow-hidden">
              {M.map(([k, v, c]) => <div key={k} className="bg-paper px-3 py-3"><div className="text-[11px] uppercase tracking-wider text-faint">{k}</div><div className={`num text-lg font-medium mt-0.5 ${c ?? ""}`}>{v}</div></div>)}
            </div>
            <div className="mt-2 text-xs text-muted num">Buy &amp; hold same period: {pct(r.bh.cagr, 1)}/yr · Sharpe {num(r.bh.sharpe)} · max DD {pct(r.bh.maxdd, 0)} · vol {pct(r.bh.vol, 1)}</div>
            <div className="mt-6"><div className="flex gap-4 text-xs text-muted mb-1"><span><i className="inline-block w-3 h-0.5 bg-clay align-middle mr-1" />Strategy</span><span><i className="inline-block w-3 h-0.5 bg-[#b9ab98] align-middle mr-1" />Buy &amp; hold</span><span className="ml-auto">Growth of $1 · log scale</span></div><Equity data={r.curve} /></div>
            <div className="mt-2"><Drawdown data={r.curve} /></div>
          </div>
        </div>
        <Note>If a setting only looks good on one preset, it is probably overfit. Check “Train” and “Test” separately — the honest test is whether a rule chosen on Train still works on Test.</Note>
      </div>
      <DiscoveryLab />
    </Section>
  );
}

const KEY = "flow.discoveries.v1";
function DiscoveryLab() {
  const [log, setLog] = useState<Discovery[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { try { const s = localStorage.getItem(KEY); if (s) setLog(JSON.parse(s)); } catch {} }, []);
  const save = (l: Discovery[]) => { setLog(l); try { localStorage.setItem(KEY, JSON.stringify(l.slice(0, 50))); } catch {} };
  const go = () => { setBusy(true); setTimeout(() => { save([discover(), ...log]); setBusy(false); }, 30); };
  const acc = log.filter((d) => d.verdict === "ACCEPTED").length;
  return (
    <div className="mt-20 border-t border-line pt-12" id="discovery">
      <div className="flex items-center gap-2 flex-wrap"><H3>Strategy discovery</H3><Badge t="BACKTEST" /></div>
      <p className="text-muted mt-2 max-w-3xl">FLOW generates a hypothesis, writes rules, backtests on 1900–1979, tests out-of-sample on 1980–2026, stress-tests neighbors, red-teams it, and accepts or rejects. Failed experiments are kept — they are research too.</p>
      <ol className="mt-6 flex flex-wrap gap-x-2 gap-y-1 text-xs uppercase tracking-wider text-faint" aria-label="Pipeline">
        {["Hypothesis", "Rules", "Backtest", "Stress test", "Out-of-sample", "Red team", "Accept / reject"].map((s, i) => <li key={s}>{i > 0 && <span className="mr-2">→</span>}{s}</li>)}
      </ol>
      <div className="mt-6 flex items-center gap-4 flex-wrap">
        <button onClick={go} disabled={busy} className="rounded-full bg-clay text-paper px-5 py-2.5 font-medium hover:bg-clay-dark disabled:opacity-60">{busy ? "Testing…" : "Generate & test a hypothesis"}</button>
        {log.length > 0 && <span className="text-sm text-muted num">{log.length} experiments · {acc} accepted · {log.length - acc} rejected</span>}
        {log.length > 0 && <button onClick={() => save([])} className="text-sm text-faint hover:text-neg">Clear log</button>}
      </div>
      <ul className="mt-6 divide-y divide-line border-y border-line" aria-live="polite">
        {log.length === 0 && <li className="py-6 text-muted text-sm">No experiments yet. Your log is stored in this browser only.</li>}
        {log.map((d, i) => (
          <li key={d.id} className={`py-4 ${i === 0 ? "msg-in" : ""}`}>
            <div className="flex items-start gap-3 justify-between flex-wrap">
              <p className="font-medium max-w-2xl">{d.hypothesis}</p>
              <span className={`text-xs font-semibold tracking-wider rounded-full px-2.5 py-1 ${d.verdict === "ACCEPTED" ? "bg-[#e3e9dc] text-pos" : "bg-blush text-neg"}`}>{d.verdict}</span>
            </div>
            <div className="mt-2 grid sm:grid-cols-2 lg:grid-cols-5 gap-x-4 gap-y-1 text-xs">
              {d.checks.map((c) => <div key={c.name} className={c.pass ? "text-pos" : "text-neg"}><span aria-hidden>{c.pass ? "✓" : "✕"}</span> {c.name}<span className="block text-muted">{c.detail}</span></div>)}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
