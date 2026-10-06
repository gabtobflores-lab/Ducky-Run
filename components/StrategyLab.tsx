"use client";
import { useState } from "react";
import q from "@/data/quant_experiments.json";
import strat from "@/data/trading_strategies.json";
import { Badge, H3, Note, Section } from "./ui";
import { Bars, Equity, SensChart } from "./Charts";
import { pct, num } from "@/lib/fmt";

type Ex = (typeof q.experiments)[number] & { sensitivity?: { p: number; train_sharpe: number; test_sharpe: number }[]; robust_share?: number | null; note?: string };
const EX = q.experiments as Ex[];
const LAB = Object.fromEntries(strat.lab.map((l) => [l.id, l]));
const CURVE: Record<string, string> = { trend_sma: "trend", tsmom: "tsmom", vol_target: "vol_target" };
const passed = (e: Ex) => e.test.sharpe >= e.bh_test.sharpe && e.test.sharpe >= e.train.sharpe * 0.7 && e.test.maxdd > e.bh_test.maxdd;

export default function StrategyLab() {
  const [id, setId] = useState(EX[0].id);
  const e = EX.find((x) => x.id === id)!;
  const lab = LAB[id];
  const ck = CURVE[id];
  const curve = ck ? (q.curves as Record<string, { d: string; v: number }[]>)[ck].map((p, i) => ({ d: p.d, s: p.v, b: q.curves.bh[i]?.v })) : null;
  const cmp = EX.map((x) => ({ name: x.name.split(" (")[0].replace("Relative strength: ", "RS: ").replace("Trend + calm-volatility override", "Trend+vol").replace("Valuation timing", "Value timing").replace("Volatility targeting", "Vol target").replace("Value + trend", "Value+trend").replace("Time-series momentum", "TS momentum").replace("Trend following", "Trend").replace("Mean reversion", "Mean rev."), v: x.test.sharpe }));
  const MR: [string, (s: Ex["train"]) => string][] = [["CAGR", (s) => pct(s.cagr, 1)], ["Volatility", (s) => pct(s.vol, 1)], ["Max drawdown", (s) => pct(s.maxdd, 0)], ["Sharpe", (s) => num(s.sharpe)], ["Sortino", (s) => num(s.sortino)]];
  return (
    <Section id="strategy" n="08 — Strategy Lab" title="Explain. Test. Break." lede="Eight classic strategies on 126 years of data. Each is explained, backtested, stress-tested, compared — and attacked." tone="paper">
      <div className="flex items-center gap-2 mb-6 flex-wrap"><Badge t="BACKTEST" /><span className="text-sm text-muted">{q.split} · {q.cost_assumption} · S&amp;P 500 monthly total return</span></div>
      <div className="grid lg:grid-cols-[260px_1fr] gap-8">
        <div role="tablist" aria-label="Strategies" className="flex lg:flex-col gap-1 overflow-x-auto scrollbar-none -mx-4 px-4 lg:mx-0 lg:px-0">
          {EX.map((x) => (
            <button key={x.id} role="tab" aria-selected={id === x.id} onClick={() => setId(x.id)} className={`shrink-0 text-left rounded-lg px-3 py-2.5 transition-colors ${id === x.id ? "bg-ink text-cream" : "hover:bg-beige"}`}>
              <div className="text-sm font-medium whitespace-nowrap">{LAB[x.id].name}</div>
              <div className={`text-xs ${id === x.id ? "text-sand" : passed(x) ? "text-pos" : "text-neg"}`}>{passed(x) ? "Survived" : "Rejected"} · test Sharpe {num(x.test.sharpe)}</div>
            </button>
          ))}
        </div>
        <div role="tabpanel" className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap"><span className="text-xs uppercase tracking-wider text-faint">{e.family}</span>{e.note && <span className="text-xs text-muted">{e.note}</span>}</div>
          <h4 className="font-serif text-3xl mt-1">{e.name}</h4>
          <p className="text-muted mt-2">{lab.explain} <span className="text-ink">Hypothesis:</span> {e.hypothesis}</p>
          <ul className="mt-3 text-sm space-y-1">{e.rules.map((r) => <li key={r} className="flex gap-2"><span className="text-clay">→</span>{r}</li>)}</ul>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm num">
              <thead><tr className="text-left text-faint text-xs uppercase tracking-wider border-b border-line"><th className="py-2 font-medium" /><th className="font-medium">Train</th><th className="font-medium">B&amp;H train</th><th className="font-medium">Test</th><th className="font-medium">B&amp;H test</th></tr></thead>
              <tbody className="divide-y divide-line">{MR.map(([k, f]) => <tr key={k}><td className="py-2 text-muted">{k}</td><td>{f(e.train)}</td><td className="text-faint">{f(e.bh_train)}</td><td className="font-semibold">{f(e.test)}</td><td className="text-faint">{f(e.bh_test)}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="mt-8 grid md:grid-cols-2 gap-8">
            <div>
              <div className="text-xs uppercase tracking-wider text-faint">Stress test</div><p className="mt-1">{lab.stress}</p>
              <div className="text-xs uppercase tracking-wider text-clay mt-5">Attempt to break it</div><p className="mt-1">{lab.breakit}</p>
            </div>
            {e.sensitivity && (
              <div>
                <div className="text-xs uppercase tracking-wider text-faint mb-1">Parameter sensitivity — Sharpe by parameter value</div>
                <SensChart data={e.sensitivity} bh={e.bh_test.sharpe} label="Train and test Sharpe across parameter values" />
                <p className="text-xs text-muted">{e.robust_share != null && `${Math.round(e.robust_share * 100)}% of settings beat buy-and-hold out-of-sample. `}Flat lines = robust. Spikes = overfitting risk.</p>
              </div>
            )}
          </div>
          {curve && <div className="mt-8"><div className="text-xs uppercase tracking-wider text-faint mb-1">Growth of $1 since 1900 (log)</div><Equity data={curve} h={240} /></div>}
        </div>
      </div>

      <div className="mt-20 grid lg:grid-cols-2 gap-12 [&>*]:min-w-0">
        <div>
          <H3>Compare: out-of-sample Sharpe</H3>
          <p className="text-sm text-muted mt-1">1980–2026. Buy &amp; hold = {num(EX[0].bh_test.sharpe)}. Relative strength uses 2000–2026.</p>
          <div className="mt-4"><Bars data={cmp} k="v" label="Test Sharpe" fmt={(v) => v.toFixed(2)} highlight="Trend" h={260} /></div>
        </div>
        <div>
          <H3>Walk-forward test</H3>
          <p className="text-sm text-muted mt-1">{q.walk_forward.method}</p>
          <div className="mt-5 grid grid-cols-3 gap-4">
            {([["Walk-forward", q.walk_forward.result], ["Fixed 10-mo", q.walk_forward.fixed10], ["Buy & hold", q.walk_forward.bh]] as [string, typeof q.walk_forward.bh][]).map(([k, s]) => (
              <div key={k}><div className="text-xs text-faint uppercase tracking-wider">{k}</div><div className="num font-serif text-3xl mt-1">{num(s.sharpe)}</div><div className="text-xs text-muted num">{pct(s.cagr, 1)}/yr · DD {pct(s.maxdd, 0)}</div></div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-1.5 text-xs num">{q.walk_forward.log.map((l) => <span key={l.decade} className="rounded bg-beige px-2 py-1">{l.decade}s: {l.chosen_sma}m</span>)}</div>
          <p className="text-sm mt-4">Choosing the &quot;best&quot; length with hindsight-free data did slightly worse than simply fixing 10 months — optimization added nothing.</p>
        </div>
      </div>

      <div className="mt-16 grid lg:grid-cols-2 gap-12 [&>*]:min-w-0">
        <div>
          <H3>Market regimes</H3>
          <p className="text-sm text-muted mt-1">Trend following vs buy-and-hold by decade. It loses in roaring decades and wins in crashes.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[380px] text-sm num">
              <thead><tr className="text-left text-faint text-xs uppercase tracking-wider border-b border-line"><th className="py-2 font-medium">Decade</th><th className="font-medium">B&amp;H /yr</th><th className="font-medium">Trend /yr</th><th className="font-medium">B&amp;H DD</th><th className="font-medium">Trend DD</th></tr></thead>
              <tbody className="divide-y divide-line">{q.regimes.map((r) => <tr key={r.decade}><td className="py-1.5">{r.decade}</td><td className={r.bh_cagr < 0 ? "text-neg" : ""}>{pct(r.bh_cagr, 1)}</td><td className={r.trend_cagr > r.bh_cagr ? "text-pos font-medium" : ""}>{pct(r.trend_cagr, 1)}</td><td className="text-faint">{pct(r.bh_maxdd, 0)}</td><td className="text-faint">{pct(r.trend_maxdd, 0)}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
        <div>
          <H3>Anti-overfitting</H3>
          <p className="text-sm text-muted mt-1">{q.overfitting_demo.lesson}</p>
          <div className="mt-5 grid grid-cols-3 gap-4">
            <div><div className="text-xs text-faint uppercase tracking-wider">Best 10 · train</div><div className="num font-serif text-3xl mt-1">{num(q.overfitting_demo.best10_train_sharpe)}</div></div>
            <div><div className="text-xs text-faint uppercase tracking-wider">Same 10 · test</div><div className="num font-serif text-3xl mt-1 text-neg">{num(q.overfitting_demo.best10_test_sharpe)}</div></div>
            <div><div className="text-xs text-faint uppercase tracking-wider">All 300 · test</div><div className="num font-serif text-3xl mt-1">{num(q.overfitting_demo.all_test_sharpe)}</div></div>
          </div>
          <p className="text-sm mt-4">Train/test rank correlation: <span className="num">{q.overfitting_demo.corr_train_test}</span> — close to zero. Picking winners in-sample predicted almost nothing.</p>
          <ul className="mt-5 text-sm space-y-2 text-muted">
            <li><span className="text-ink font-medium">Look-ahead bias:</span> every signal is computed at month-end and applied the following month.</li>
            <li><span className="text-ink font-medium">Survivorship bias:</span> the index includes failed companies as they dropped out — but the stock universe above does not.</li>
            <li><span className="text-ink font-medium">Data leakage:</span> the 1980 split was fixed before testing; no parameter was tuned on test data.</li>
            <li><span className="text-ink font-medium">Parameter sensitivity:</span> full grids are shown, not just the winner.</li>
          </ul>
        </div>
      </div>
      <Note>Optimize for robustness, not for an impressive backtest. A rule that only works with one exact parameter is a description of the past, not a strategy.</Note>
    </Section>
  );
}
