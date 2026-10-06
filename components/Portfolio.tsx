"use client";
import { useMemo, useState } from "react";
import pm from "@/data/portfolio_models.json";
import { Badge, H3, Section } from "./ui";
import { Bars } from "./Charts";
import { ppt } from "@/lib/fmt";

const INST = Object.fromEntries(pm.instruments.map((i) => [i.ticker, i]));
const SW = pm.scenario_weights;
const PALETTE = ["#c6613f", "#4b3a2e", "#dc8a6c", "#93877c", "#b88a3c", "#6d6157", "#e3b49a", "#a64d2f", "#ddd2bf", "#4f7a4a", "#29231f", "#f3dfd3"];
type Row = { ticker: string; weight: number };

export function compute(rows: Row[]) {
  const tot = rows.reduce((a, r) => a + r.weight, 0) || 1;
  const sc = [0, 0, 0, 0];
  let vol = 0, hhi = 0;
  rows.forEach((r) => { const w = r.weight / tot, i = INST[r.ticker]; i.scen.forEach((v, k) => (sc[k] += w * v)); vol += w * i.s; hhi += w * w; });
  const weighted = SW.bear * sc[0] + SW.base * sc[1] + SW.bull * sc[2] + SW.xbull * sc[3];
  return { bear: sc[0], base: sc[1], bull: sc[2], xbull: sc[3], weighted, hhi, effN: 1 / hhi, risk: Math.min(10, vol * 0.8 + hhi * 10), total: rows.reduce((a, r) => a + r.weight, 0) };
}

function AllocBar({ rows }: { rows: Row[] }) {
  const tot = rows.reduce((a, r) => a + r.weight, 0) || 1;
  return (
    <div className="flex h-9 w-full overflow-hidden rounded-lg bg-beige" role="img" aria-label={rows.map((r) => `${r.ticker} ${r.weight}%`).join(", ")}>
      {rows.map((r, i) => (
        <div key={r.ticker} className="anim-w h-full flex items-center justify-center text-[11px] font-semibold text-paper overflow-hidden" style={{ width: `${(r.weight / Math.max(100, tot)) * 100}%`, background: r.ticker === "SGOV" ? "#b9ab98" : PALETTE[i % PALETTE.length] }} title={`${r.ticker} ${r.weight}%`}>
          {r.weight >= 7 && r.ticker}
        </div>
      ))}
    </div>
  );
}

function Metrics({ m }: { m: ReturnType<typeof compute> }) {
  const cells: [string, string, string?][] = [
    ["Bear", ppt(m.bear, 1), m.bear < 0 ? "text-neg" : ""], ["Base", ppt(m.base, 1)], ["Bull", ppt(m.bull, 1)], ["Extreme bull", ppt(m.xbull, 1)],
    ["Scenario-weighted", ppt(m.weighted, 1), "text-clay"], ["Downside (bear)", ppt(m.bear, 0), "text-neg"], ["Concentration", `${m.effN.toFixed(1)} eff. holdings`], ["Risk score", `${m.risk.toFixed(1)} / 10`],
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-line border border-line rounded-xl overflow-hidden">
      {cells.map(([k, v, c]) => <div key={k} className="bg-paper p-4"><div className="text-xs uppercase tracking-wider text-faint">{k}</div><div className={`num font-serif text-2xl sm:text-3xl mt-1 ${c ?? ""}`}>{v}</div></div>)}
    </div>
  );
}

export default function Portfolio() {
  const [tab, setTab] = useState(pm.models[0].id);
  const model = pm.models.find((m) => m.id === tab)!;
  const [rows, setRows] = useState<Row[]>(pm.models[1].allocation.map((a) => ({ ticker: a.ticker, weight: a.weight })));
  const [add, setAdd] = useState("");
  const mm = useMemo(() => compute(model.allocation), [model]);
  const bm = useMemo(() => compute(rows), [rows]);
  const set = (t: string, w: number) => setRows((rs) => rs.map((r) => (r.ticker === t ? { ...r, weight: Math.max(0, Math.min(100, Math.round(w))) } : r)));
  const off = bm.total !== 100;
  const normalize = () => { const t = bm.total || 1; let acc = 0; setRows(rows.map((r, i) => { const w = i === rows.length - 1 ? 100 - acc : Math.round((r.weight / t) * 100); acc += w; return { ...r, weight: w }; })); };

  return (
    <Section id="portfolio" n="05 — Portfolio Lab" title="Three portfolios. Then yours." lede="Percentages, not dollars. Every weight has a reason — and every portfolio has a bear case." tone="paper">
      <div className="flex flex-wrap items-center gap-2 mb-8"><Badge t="SIMULATION" /><span className="text-sm text-muted">3-year scenario returns; weighting {SW.bear * 100}/{SW.base * 100}/{SW.bull * 100}/{SW.xbull * 100} (bear/base/bull/extreme) is an assumption.</span></div>
      <div role="tablist" aria-label="Model portfolios" className="flex gap-2 overflow-x-auto scrollbar-none">
        {pm.models.map((m) => (
          <button key={m.id} role="tab" aria-selected={tab === m.id} onClick={() => setTab(m.id)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${tab === m.id ? "bg-ink text-cream" : "bg-beige text-brown hover:bg-sand"}`}>{m.name}</button>
        ))}
      </div>
      <div className="mt-8 grid lg:grid-cols-[1.2fr_1fr] gap-10" role="tabpanel">
        <div>
          <p className="font-serif text-2xl leading-snug">{model.thesis}</p>
          <p className="text-sm text-muted mt-2">Time horizon: {model.horizon}</p>
          <div className="mt-6"><AllocBar rows={model.allocation} /></div>
          <table className="mt-6 w-full text-sm">
            <tbody className="divide-y divide-line">
              {model.allocation.map((a) => <tr key={a.ticker} className="align-top"><td className="py-2.5 pr-3 font-semibold w-16">{a.ticker}</td><td className="pr-3 num w-12 text-right">{a.weight}%</td><td className="text-muted">{a.why}</td></tr>)}
            </tbody>
          </table>
        </div>
        <div>
          <Metrics m={mm} />
          <div className="mt-6"><Bars data={[{ name: "Bear", v: +mm.bear.toFixed(1) }, { name: "Base", v: +mm.base.toFixed(1) }, { name: "Bull", v: +mm.bull.toFixed(1) }, { name: "Extreme", v: +mm.xbull.toFixed(1) }, { name: "Weighted", v: +mm.weighted.toFixed(1) }]} k="v" label="3-year return by scenario" highlight="Weighted" /></div>
          {tab === "aggressive" && <p className="text-sm mt-4 border-l-2 border-clay pl-3">Key finding: AGGRESSIVE’s scenario-weighted return ({ppt(mm.weighted, 1)}) is about the same as ASYMMETRIC’s — with a much worse bear case. More risk did not buy more expected return.</p>}
        </div>
      </div>

      {/* Builder */}
      <div className="mt-20 border-t border-line pt-12">
        <div className="flex items-center gap-2 flex-wrap"><H3>Build your own</H3><Badge t="SIMULATION" /></div>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <span className="text-muted mr-1 self-center">Start from:</span>
          {pm.models.map((m) => <button key={m.id} onClick={() => setRows(m.allocation.map((a) => ({ ticker: a.ticker, weight: a.weight })))} className="rounded-full border border-sand px-3 py-1 hover:bg-beige">{m.name.replace("FLOW ", "")}</button>)}
          <button onClick={() => setRows([])} className="rounded-full border border-sand px-3 py-1 hover:bg-beige">Empty</button>
        </div>
        <div className="mt-8 grid lg:grid-cols-[1.1fr_1fr] gap-10">
          <div>
            <div className="space-y-1">
              {rows.map((r) => (
                <div key={r.ticker} className="grid grid-cols-[56px_1fr_64px_32px] items-center gap-3 py-1">
                  <label htmlFor={`b-${r.ticker}`} className="font-semibold text-sm">{r.ticker}</label>
                  <input id={`b-${r.ticker}`} type="range" min={0} max={60} value={r.weight} onChange={(e) => set(r.ticker, +e.target.value)} />
                  <input aria-label={`${r.ticker} weight percent`} type="number" inputMode="numeric" min={0} max={100} value={r.weight} onChange={(e) => set(r.ticker, +e.target.value)} className="num w-full rounded-md border border-sand bg-paper px-2 py-1.5 text-right" />
                  <button aria-label={`Remove ${r.ticker}`} onClick={() => setRows(rows.filter((x) => x.ticker !== r.ticker))} className="h-8 w-8 rounded-full text-faint hover:bg-beige hover:text-neg">×</button>
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <select aria-label="Add holding" value={add} onChange={(e) => setAdd(e.target.value)} className="flex-1 rounded-lg border border-sand bg-paper px-3 py-2">
                <option value="">Add a holding…</option>
                {pm.instruments.filter((i) => !rows.some((r) => r.ticker === i.ticker)).map((i) => <option key={i.ticker} value={i.ticker}>{i.ticker} — {i.company}</option>)}
              </select>
              <button disabled={!add} onClick={() => { setRows([...rows, { ticker: add, weight: 5 }]); setAdd(""); }} className="rounded-lg bg-ink text-cream px-4 disabled:opacity-40">Add</button>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className={`num text-sm font-medium ${off ? "text-neg" : "text-pos"}`} role="status" aria-live="polite">Total {bm.total}% {off ? `— ${bm.total > 100 ? "over" : "under"} by ${Math.abs(100 - bm.total)}%` : "✓"}</div>
              {off && rows.length > 0 && <button onClick={normalize} className="text-sm rounded-full bg-clay text-paper px-3 py-1 hover:bg-clay-dark">Normalize to 100%</button>}
            </div>
            <AllocBar rows={rows} />
            <div className="mt-6">{rows.length ? <Metrics m={bm} /> : <p className="text-muted">Add holdings to see results.</p>}</div>
            {rows.length > 0 && <p className="text-xs text-faint mt-3">Results use weights scaled to 100% even when the total is off. Risk score = weighted volatility score × 0.8 + concentration (HHI) × 10.</p>}
          </div>
        </div>
      </div>
    </Section>
  );
}
