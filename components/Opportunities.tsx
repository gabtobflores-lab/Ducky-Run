"use client";
import { useMemo, useState } from "react";
import inv from "@/data/investments.json";
import edu from "@/data/education.json";
import { Badge, H3, Note, Section } from "./ui";
import { ppt } from "@/lib/fmt";

type Item = (typeof inv.items)[number];
const ITEMS = inv.items as Item[];
const BY = Object.fromEntries(ITEMS.map((i) => [i.ticker, i]));
const TOP = inv.top10.map((t) => BY[t]);
const SC = ["bear", "base", "bull", "xbull"] as const;
const SCL: Record<string, string> = { bear: "Bear", base: "Base", bull: "Bull", xbull: "Extreme bull" };

function ScenarioBar({ s, max = 200 }: { s: Item["scenarios"]; max?: number }) {
  const min = -100;
  const x = (v: number) => ((v - min) / (max - min)) * 100;
  return (
    <div className="relative h-7" aria-label={`Bear ${s.bear}%, base ${s.base}%, bull ${s.bull}%, extreme bull ${s.xbull}%`} role="img">
      <div className="absolute top-1/2 h-px w-full bg-sand" />
      <div className="absolute top-0 bottom-0 w-px bg-faint" style={{ left: `${x(0)}%` }} />
      <div className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-gradient-to-r from-neg/60 via-sand to-pos/60" style={{ left: `${x(s.bear)}%`, width: `${x(Math.min(max, s.bull)) - x(s.bear)}%` }} />
      {SC.map((k) => <span key={k} title={`${SCL[k]} ${s[k]}%`} className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-paper ${k === "base" ? "h-3.5 w-3.5 bg-ink" : k === "xbull" ? "h-2.5 w-2.5 bg-clay" : "h-2.5 w-2.5 bg-muted"}`} style={{ left: `${x(Math.min(max, s[k]))}%` }} />)}
    </div>
  );
}

export default function Opportunities() {
  const [sel, setSel] = useState(TOP[0].ticker);
  const [w, setW] = useState({ bear: 25, base: 45, bull: 22, xbull: 8 });
  const [sort, setSort] = useState<{ k: string; d: 1 | -1 }>({ k: "flow_rank_score", d: -1 });
  const [rev, setRev] = useState(2), [mar, setMar] = useState(1.2), [mult, setMult] = useState(1), [sh, setSh] = useState(1);
  const it = BY[sel];
  const tw = w.bear + w.base + w.bull + w.xbull;
  const ev = SC.reduce((a, k) => a + (w[k] / tw) * it.scenarios[k], 0);

  const rows = useMemo(() => {
    const get = (i: Item, k: string): number | string => (k in i.scenarios ? i.scenarios[k as keyof Item["scenarios"]] : (i as unknown as Record<string, number | string>)[k] ?? -99);
    return [...ITEMS].sort((a, b) => { const x = get(a, sort.k), y = get(b, sort.k); return (x > y ? 1 : x < y ? -1 : 0) * sort.d; });
  }, [sort]);
  const th = (k: string, label: string, cls = "") => (
    <th className={`font-medium py-2 ${cls}`} aria-sort={sort.k === k ? (sort.d === 1 ? "ascending" : "descending") : "none"}>
      <button className="hover:text-ink inline-flex items-center gap-1" onClick={() => setSort((s) => ({ k, d: s.k === k ? ((-s.d) as 1 | -1) : -1 }))}>{label}{sort.k === k && <span aria-hidden>{sort.d === 1 ? "↑" : "↓"}</span>}</button>
    </th>
  );
  const mOut = rev * mar * mult / sh;

  return (
    <Section id="opportunities" n="04 — Opportunities" title="Ten that matter." lede="Thirty candidates researched across growth, value, contrarian and second-order bets. Ranked on risk/reward, quality and expectation gap — not on recent performance.">
      <div className="flex flex-wrap items-center gap-2 mb-8"><Badge t="RESEARCH HYPOTHESIS" /><span className="text-sm text-muted">Metrics are approximate as of mid-2026 and must be verified. 3-year scenario ranges.</span></div>

      <ol className="border-t border-line">
        {TOP.map((i, n) => (
          <li key={i.ticker} className="border-b border-line">
            <details className="group" open={n === 0}>
              <summary className="grid grid-cols-[2rem_1fr_auto] sm:grid-cols-[2.5rem_220px_1fr_80px] items-center gap-x-4 py-4">
                <span className="font-serif text-2xl text-clay num">{n + 1}</span>
                <span className="min-w-0"><span className="font-semibold">{i.ticker}</span> <span className="text-muted">{i.company}</span><span className="block text-xs text-faint truncate">{i.sector}</span></span>
                <span className="hidden sm:block"><ScenarioBar s={i.scenarios} /></span>
                <span className="text-right num"><span className="text-xs text-faint block">EV</span><span className="font-medium">{ppt(i.ev, 0)}</span></span>
              </summary>
              <div className="pb-6 sm:pl-14 grid md:grid-cols-2 gap-x-10 gap-y-5">
                <div className="sm:hidden md:col-span-2"><ScenarioBar s={i.scenarios} /></div>
                <Block k="Why it is interesting" v={i.why} />
                <Block k="What could go right" v={i.go_right} c="text-pos" />
                <Block k="What could go wrong" v={i.go_wrong} c="text-neg" />
                <Block k="What would invalidate the thesis" v={i.invalidation} c="text-clay-dark" />
                <div className="md:col-span-2 text-sm text-muted flex flex-wrap gap-x-6 gap-y-1">
                  <span>Bear {ppt(i.scenarios.bear)} · Base {ppt(i.scenarios.base)} · Bull {ppt(i.scenarios.bull)} · Extreme {ppt(i.scenarios.xbull)}</span>
                  <span>{i.metrics}</span><span>Confidence: {i.confidence}</span>
                </div>
              </div>
            </details>
          </li>
        ))}
      </ol>
      <div className="mt-3 flex gap-5 text-xs text-faint"><span><i className="inline-block h-2 w-2 rounded-full bg-muted mr-1" />bear / bull</span><span><i className="inline-block h-2.5 w-2.5 rounded-full bg-ink mr-1" />base</span><span><i className="inline-block h-2 w-2 rounded-full bg-clay mr-1" />extreme bull</span><span>axis −100% → +200%</span></div>
      <p className="mt-4 text-xs text-faint">Ranking method: {inv.method}</p>

      {/* Scenario engine */}
      <div className="mt-20 grid lg:grid-cols-[1fr_1.2fr] gap-12">
        <div>
          <div className="flex items-center gap-2"><H3>Scenario engine</H3><Badge t="SIMULATION" /></div>
          <p className="text-muted mt-2">Pick a company and set your own scenario weights. Weights are judgments, not probabilities.</p>
          <label className="block mt-6 text-sm text-muted" htmlFor="sc-sel">Company</label>
          <select id="sc-sel" value={sel} onChange={(e) => setSel(e.target.value)} className="mt-1 w-full rounded-lg border border-sand bg-paper px-3 py-2.5 text-ink">
            {ITEMS.map((i) => <option key={i.ticker} value={i.ticker}>{i.ticker} — {i.company}</option>)}
          </select>
          <div className="mt-6 space-y-3">
            {SC.map((k) => (
              <div key={k} className="grid grid-cols-[96px_1fr_44px] items-center gap-3">
                <label htmlFor={`w-${k}`} className="text-sm">{SCL[k]}</label>
                <input id={`w-${k}`} type="range" min={0} max={80} value={w[k]} onChange={(e) => setW({ ...w, [k]: +e.target.value })} />
                <span className="num text-sm text-right text-muted">{Math.round((w[k] / tw) * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-line rounded-xl overflow-hidden border border-line">
            {SC.map((k) => (
              <div key={k} className="bg-paper p-4">
                <div className="text-xs uppercase tracking-wider text-faint">{SCL[k]}</div>
                <div className={`num font-serif text-3xl mt-1 ${it.scenarios[k] < 0 ? "text-neg" : "text-ink"}`}>{ppt(it.scenarios[k])}</div>
                <div className="text-xs text-muted mt-1">3 yrs · {((1 + it.scenarios[k] / 100) ** (1 / 3) * 100 - 100).toFixed(0)}%/yr</div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex items-baseline gap-4 flex-wrap">
            <div><div className="text-xs uppercase tracking-wider text-faint">Scenario-weighted</div><div className="num font-serif text-5xl text-clay">{ppt(ev, 1)}</div></div>
            <div className="text-sm text-muted">Reward / risk: <span className="num text-ink">{(ev / Math.abs(it.scenarios.bear)).toFixed(2)}</span> · Volatility score {it.scores.s}/10</div>
          </div>
          <dl className="mt-6 grid sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
            <div><dt className="text-faint text-xs uppercase tracking-wider">Bear requires</dt><dd className="mt-1">{it.go_wrong}</dd></div>
            <div><dt className="text-faint text-xs uppercase tracking-wider">Bull requires</dt><dd className="mt-1">{it.go_right}</dd></div>
            <div><dt className="text-faint text-xs uppercase tracking-wider">Catalysts</dt><dd className="mt-1">{it.catalysts.join(" · ")}</dd></div>
            <div><dt className="text-faint text-xs uppercase tracking-wider">Failure / invalidation</dt><dd className="mt-1">{it.invalidation}</dd></div>
          </dl>
        </div>
      </div>

      {/* Extreme upside */}
      <div className="mt-20">
        <div className="flex items-center gap-2"><H3>What it takes to 2×, 3×, 5×, 10×</H3><Badge t="EDUCATION" /></div>
        <p className="text-muted mt-2 max-w-3xl">{edu.upside_math}</p>
        <div className="mt-8 grid lg:grid-cols-[1.3fr_1fr] gap-12">
          <div className="divide-y divide-line border-y border-line">
            {edu.extreme_upside.map((u) => (
              <div key={u.multiple} className="py-4 grid grid-cols-[64px_1fr] gap-4">
                <div className="font-serif text-4xl text-clay">{u.multiple}</div>
                <div><div className="text-sm num text-muted">{u.annual}</div><p className="mt-1">{u.needs}</p><span className="text-xs uppercase tracking-wider text-faint">{u.category}</span></div>
              </div>
            ))}
          </div>
          <div className="rounded-2xl bg-paper border border-line p-6">
            <div className="font-medium">Return decomposition calculator</div>
            {([["Revenue multiple", rev, setRev, 0.5, 10, 0.1], ["Margin change (×)", mar, setMar, 0.3, 3, 0.05], ["Valuation multiple change (×)", mult, setMult, 0.3, 3, 0.05], ["Share count change (×)", sh, setSh, 0.7, 2, 0.05]] as [string, number, (v: number) => void, number, number, number][]).map(([l, v, f, a, b, s]) => (
              <div key={l} className="mt-4">
                <div className="flex justify-between text-sm"><label htmlFor={l}>{l}</label><span className="num text-muted">{v.toFixed(2)}×</span></div>
                <input id={l} type="range" min={a} max={b} step={s} value={v} onChange={(e) => f(+e.target.value)} />
              </div>
            ))}
            <div className="mt-5 border-t border-line pt-4 flex items-baseline justify-between">
              <span className="text-sm text-muted">Price multiple</span>
              <span className={`num font-serif text-5xl ${mOut >= 5 ? "text-clay" : mOut < 1 ? "text-neg" : ""}`}>{mOut.toFixed(2)}×</span>
            </div>
            <p className="text-xs text-faint mt-2">{mOut >= 10 ? "Lottery-like: needs everything to go right at once." : mOut >= 5 ? "Speculative: requires an inflection + re-rating." : mOut >= 2 ? "Plausible for quality growth over 3–5 years." : mOut < 1 ? "Permanent-loss zone: multiple compression or dilution outweighs growth." : "Modest outcome."}</p>
          </div>
        </div>
      </div>

      {/* Universe */}
      <div className="mt-20">
        <div className="flex items-center gap-2"><H3>The full universe</H3><span className="text-sm text-muted">· {ITEMS.length} candidates · tap a header to sort</span></div>
        <div className="mt-6 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[760px] text-sm num">
            <thead><tr className="text-left text-faint text-xs uppercase tracking-wider border-b border-line">
              {th("ticker", "Ticker")}{th("sector", "Sector")}{th("flow_rank_score", "Rank")}{th("ev", "EV")}{th("bear", "Bear")}{th("bull", "Bull")}{th("xbull", "Ext.")}{th("flow_extreme", "EXTREME")}{th("flow_core", "CORE")}<th className="font-medium">Horizon</th>
            </tr></thead>
            <tbody className="divide-y divide-line">
              {rows.map((i) => (
                <tr key={i.ticker} className={`hover:bg-paper ${inv.top10.includes(i.ticker) ? "" : "text-muted"}`}>
                  <td className="py-2.5 pr-3"><button className="font-semibold text-ink hover:text-clay" onClick={() => { setSel(i.ticker); document.getElementById("sc-sel")?.scrollIntoView({ behavior: "smooth", block: "center" }); }}>{i.ticker}</button></td>
                  <td className="pr-3 max-w-[180px] truncate">{i.sector}</td>
                  <td className="pr-3">{i.flow_rank_score.toFixed(1)}</td>
                  <td className="pr-3">{ppt(i.ev, 0)}</td>
                  <td className="pr-3 text-neg">{ppt(i.scenarios.bear)}</td>
                  <td className="pr-3">{ppt(i.scenarios.bull)}</td>
                  <td className="pr-3">{ppt(i.scenarios.xbull)}</td>
                  <td className="pr-3">{i.flow_extreme?.toFixed(1) ?? <span title="Fails balance-sheet gate">gated</span>}</td>
                  <td className="pr-3">{i.flow_core.toFixed(1)}</td>
                  <td>{i.horizon}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fidelity */}
      <div className="mt-20 grid md:grid-cols-2 gap-10">
        <div>
          <H3>Fidelity compatibility</H3>
          <p className="text-muted mt-2">General availability only — every account differs. FLOW never bypasses restrictions.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-8 text-sm">
          <div>
            <div className="text-xs uppercase tracking-wider text-pos mb-2">Potentially accessible</div>
            <ul className="space-y-1.5"><li>All {ITEMS.length} researched names (US-listed stocks and ADRs incl. TSM, ASML, NVO, MELI)</li><li>Broad ETFs used in portfolios (VTI, SGOV)</li><li>Fractional shares on US stocks/ETFs (account-dependent)</li></ul>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-clay-dark mb-2">Requires additional permissions / account type</div>
            <ul className="space-y-1.5"><li>Options (approval levels)</li><li>Margin and short selling — needed for pairs trading</li><li>Futures (WTI is simulation only here)</li><li>Leveraged/inverse ETFs (extra acknowledgments)</li><li>Minors&apos; youth/custodial accounts typically exclude all of the above — verify with Fidelity</li></ul>
          </div>
        </div>
      </div>
      <Note>None of this is a recommendation. Scenario figures are FLOW judgments about ranges, not forecasts.</Note>
    </Section>
  );
}

function Block({ k, v, c = "text-ink" }: { k: string; v: string; c?: string }) {
  return <div><div className={`text-xs uppercase tracking-wider ${c}`}>{k}</div><p className="mt-1.5 leading-relaxed">{v}</p></div>;
}
