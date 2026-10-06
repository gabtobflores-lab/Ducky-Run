import market from "@/data/market_data.json";
import edu from "@/data/education.json";
import quant from "@/data/quant_experiments.json";
import swing from "@/data/swing_backtests.json";
import formulas from "@/data/flow_formulas.json";
import fw from "@/data/flow_framework.json";
import biz from "@/data/business_ideas.json";
import bizFinal from "@/data/flow_business.json";
import inv from "@/data/investments.json";
import sources from "@/data/research_sources.json";
import strat from "@/data/trading_strategies.json";
import { Badge, Expand, H3, Note, Section, Stat } from "./ui";
import { Disclosure } from "./Motion";
import Hero from "./Hero";
import { Spark as SparkChart } from "./Charts";
import { pct, num } from "@/lib/fmt";

type MI = { id: string; label: string; value: number; as_of: string; change_12m?: number; change_3m?: number; from_high?: number; percentile?: number; median?: number; type: string; note?: string; above_10m_sma?: boolean };
const M = Object.fromEntries((market.items as MI[]).map((i) => [i.id, i])) as Record<string, MI>;

/* ---------------------------------- HOME ---------------------------------- */
export function Home() {
  const quantN = quant.experiments.length, swingN = swing.strategies.length;
  const sensRuns = quant.experiments.reduce((a, e) => a + ((e as { sensitivity?: unknown[] }).sensitivity?.length ?? 0), 0);
  const formulaV = formulas.extreme.versions.length + formulas.core.versions.length;
  const experiments = quantN + swingN + sensRuns + 1 + quant.overfitting_demo.n_random + formulaV + 2;
  return <Hero stats={[
    { label: "Opportunities analyzed", value: inv.universe_size },
    { label: "Strategies tested", value: quantN + swingN + 2, sub: "index, swing & framework" },
    { label: "Business ideas", value: biz.ideas.length, sub: "scored on 11 criteria" },
    { label: "Experiments run", value: experiments, sub: "incl. 300 overfitting trials" },
    { label: "Last research update", value: market.last_updated },
  ]} />;
}

/* --------------------------------- MARKET --------------------------------- */
export function Market() {
  const s = M.spx, v = M.vix, y = M.us10y, c = M.cpi, o = M.wti, g = M.gold, cape = M.cape;
  const regime = [
    { k: "Trend", v: s.above_10m_sma ? "Up" : "Down", d: `S&P 500 ${s.above_10m_sma ? "above" : "below"} its 10-month average; ${pct(s.from_high)} from its high.` },
    { k: "Volatility", v: v.value < v.median! ? "Calm" : "Elevated", d: `VIX ${v.value} — ${(v.percentile! * 100).toFixed(0)}th percentile since 1990 (median ${v.median}).` },
    { k: "Rates", v: y.change_12m! > 0 ? "Rising" : "Falling", d: `10-year at ${y.value}% (${y.change_12m! > 0 ? "+" : ""}${y.change_12m} pts in 12 months).` },
    { k: "Inflation", v: c.value > 0.03 ? "Above target" : "Near target", d: `CPI ${pct(c.value)} year over year (${c.as_of}).` },
  ];
  return (
    <Section id="market" n="02 — Market" title="Where we are." lede="Only what changes decisions: trend, fear, rates, inflation, and the commodity shock.">
      <div className="flex items-center gap-2 mb-6"><Badge t="CURRENT DATA" /><span className="text-sm text-muted">As of each series&apos; latest print (Aug–Sep 2026). Refresh with <code className="text-brown">npm run research</code>.</span></div>
      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-10 lg:gap-16">
        <div>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <Stat label="S&P 500 · monthly average" value={s.value.toLocaleString()} sub={<span><span className="text-pos">{pct(s.change_12m, 1, true)}</span> 12m · {pct(s.change_3m, 1, true)} 3m</span>} />
            <span className="text-xs text-faint">last 5 years</span>
          </div>
          <div className="mt-4"><SparkChart data={market.sp_recent} k="p" h={140} /></div>
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-6">
            <Stat label="10-year yield" value={`${y.value}%`} sub={y.as_of} />
            <Stat label="CPI YoY" value={pct(c.value)} sub={c.as_of} />
            <Stat label="WTI crude" value={`$${o.value.toFixed(0)}`} sub={<span className="text-neg">{pct(o.change_12m, 0, true)} 12m</span>} />
            <Stat label="Gold" value={`$${g.value.toLocaleString()}`} sub={<span>{pct(g.change_12m, 0, true)} 12m</span>} />
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider text-faint mb-3">Regime read</div>
          <dl className="divide-y divide-line border-y border-line">
            {regime.map((r) => (
              <div key={r.k} className="py-3.5 grid grid-cols-[96px_1fr] gap-3">
                <dt className="text-sm text-muted">{r.k}</dt>
                <dd><span className="font-medium">{r.v}</span><span className="block text-sm text-muted mt-0.5">{r.d}</span></dd>
              </div>
            ))}
            <div className="py-3.5 grid grid-cols-[96px_1fr] gap-3">
              <dt className="text-sm text-muted">Valuation</dt>
              <dd><span className="font-medium">CAPE {cape.value}+</span> <Badge t="STALE DATA" /><span className="block text-sm text-muted mt-0.5">{cape.note}</span></dd>
            </div>
          </dl>
          <div className="mt-6"><div className="text-xs uppercase tracking-wider text-faint mb-1">VIX · last 12 months</div><SparkChart data={market.vix_recent} k="v" color="#93877c" h={60} /></div>
        </div>
      </div>
      <div className="mt-14 grid md:grid-cols-3 gap-8 border-t border-line pt-8">
        <Theme t="Calm stocks, hot commodities" d="Equities near highs with a low VIX while oil is up ~47% and inflation is 3.7%. Historically, energy-led inflation with rising yields pressures high-multiple stocks first." />
        <Theme t="Expensive starting point" d="Even on stale 2023 data, CAPE sat in the top ~5% of history. High valuations predict lower 10-year returns — not next year’s." />
        <Theme t="Trend says stay invested" d="FLOW’s most robust tested rule (10-month trend) is currently invested. It would flip to T-bills on a monthly close below ~the 10-month average." />
      </div>
      <Note>Sector-level data is not available in FLOW&apos;s free datasets, so sector performance is omitted rather than guessed.</Note>
    </Section>
  );
}
function Theme({ t, d }: { t: string; d: string }) {
  return <div><div className="font-serif text-xl">{t}</div><p className="text-muted mt-2 leading-relaxed">{d}</p><span className="mt-2 inline-block"><Badge t="RESEARCH HYPOTHESIS" /></span></div>;
}

/* -------------------------------- INVESTING ------------------------------- */
export function Investing() {
  return (
    <Section id="investing" n="03 — Investing" title="From first principles." lede="Simple first. Open any line for the deeper version." tone="paper">
      <div className="grid lg:grid-cols-[1fr_1.3fr] gap-12 lg:gap-16">
        <div>
          <div className="flex items-center gap-3 mb-2"><H3>The foundations</H3><Badge t="EDUCATION" /></div>
          <div className="border-t border-line">
            {edu.basics.map((b) => <Expand key={b.term} title={<span><span className="text-ink">{b.term}</span> <span className="text-muted font-normal">— {b.simple}</span></span>}>{b.deep}</Expand>)}
          </div>
        </div>
        <div>
          <H3 className="mb-2">Ways to invest</H3>
          <div className="border-t border-line">
            {edu.styles.map((s) => (
              <Expand key={s.name} title={s.name} meta={s.horizon}>
                <p className="text-ink">{s.what}</p>
                <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 mt-4 text-sm">
                  <div><dt className="text-faint uppercase text-xs tracking-wider">Why it can work</dt><dd>{s.why}</dd></div>
                  <div><dt className="text-faint uppercase text-xs tracking-wider">When it works</dt><dd>{s.when}</dd></div>
                  <div><dt className="text-faint uppercase text-xs tracking-wider">When it fails</dt><dd>{s.fails}</dd></div>
                  <div><dt className="text-faint uppercase text-xs tracking-wider">Main risk</dt><dd>{s.risk}</dd></div>
                </dl>
              </Expand>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}

/* ---------------------------------- LEARN --------------------------------- */
export function Learn() {
  return (
    <Section id="learn" n="09 — Learn" title="Every style, honestly." lede="Time horizon, the core idea, what data it needs — and why it usually fails." tone="paper">
      <div className="flex items-center gap-2 mb-4"><Badge t="EDUCATION" /></div>
      <div className="hidden md:block overflow-hidden border-y border-line">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-faint text-xs uppercase tracking-wider"><th className="py-3 pr-4 font-medium">Style</th><th className="pr-4 font-medium">Horizon</th><th className="pr-4 font-medium">Core idea</th><th className="pr-4 font-medium">Data needed</th><th className="pr-4 font-medium">Main risks</th><th className="pr-4 font-medium">Common mistake</th><th className="font-medium">Why it fails</th></tr></thead>
          <tbody className="divide-y divide-line">
            {edu.trading_styles.map((s) => (
              <tr key={s.name} className="align-top"><td className="py-3 pr-4 font-medium text-ink">{s.name}</td><td className="pr-4 py-3 whitespace-nowrap">{s.horizon}</td><td className="pr-4 py-3 text-muted">{s.idea}</td><td className="pr-4 py-3 text-muted">{s.data}</td><td className="pr-4 py-3 text-muted">{s.risks}</td><td className="pr-4 py-3 text-muted">{s.mistakes}</td><td className="py-3 text-muted">{s.fails}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="md:hidden border-t border-line">
        {edu.trading_styles.map((s) => (
          <Expand key={s.name} title={s.name} meta={s.horizon}>
            <p className="text-ink">{s.idea}</p>
            <dl className="mt-3 space-y-2 text-sm"><div><dt className="text-faint text-xs uppercase">Data</dt><dd>{s.data}</dd></div><div><dt className="text-faint text-xs uppercase">Risks</dt><dd>{s.risks}</dd></div><div><dt className="text-faint text-xs uppercase">Mistake</dt><dd>{s.mistakes}</dd></div><div><dt className="text-faint text-xs uppercase">Why it fails</dt><dd>{s.fails}</dd></div></dl>
          </Expand>
        ))}
      </div>
    </Section>
  );
}

/* -------------------------------- RED TEAM -------------------------------- */
export function RedTeam() {
  const t = quant.experiments.find((e) => e.id === "trend_sma")!;
  const rows = [
    { target: "Investment theses", obj: "Scores are one analyst's judgment from mid-2026 knowledge; prices have moved since. The ranking is not point-in-time and cannot be backtested.", fail: "Top-ranked names underperform the equal-weight universe over 12–24 months.", evidence: "A blind re-score by a second source disagreeing on >40% of the top 10.", change: "Refresh metrics from filings each quarter; log every score change with a reason." },
    { target: "Swing strategies", obj: `High-win-rate dip-buying (pullback, multi-factor) decayed: profit factor fell below 1 after 2005. Only trend-following held, on just ${(swing.strategies[0].train?.trades ?? 0) + (swing.strategies[0].test?.trades ?? 0)} trades.`, fail: "Trend whipsaw years in range-bound oil.", evidence: "Running the same rules on 20+ liquid stocks and finding no edge.", change: "Re-test on equity daily data with volume when available. Treat WTI results as illustrative." },
    { target: "Quant strategies", obj: `Trend following's edge is mostly drawdown avoidance from a few events (1929–32, 1973–74, 2000–02, 2008). Few independent episodes = weak statistics.`, fail: "A fast crash and rebound (1987, 2020) — the rule sells low and buys back higher.", evidence: `Out-of-sample Sharpe falling below buy-and-hold over a full cycle (currently ${t.test.sharpe} vs ${t.bh_test.sharpe}).`, change: "Prefer partial de-risking (50%) over all-or-nothing switching to reduce whipsaw cost." },
    { target: "Portfolio models", obj: "Scenario returns are judgment, scenario weights are assumptions, and holdings are correlated (AI capex). Bear cases will arrive together.", fail: "AI capex cycle turns: GROWTH/AGGRESSIVE bear cases realized simultaneously.", evidence: "Correlation of holdings > 0.7 in a drawdown.", change: "Cap total AI-capex exposure; keep the T-bill sleeve; size AGGRESSIVE as a small satellite only." },
    { target: "Business concept", obj: "Recruit Reel sells hope. Families may expect scholarships, and national recruiting platforms already market heavily to them.", fail: "Fewer than 5 paid packages after one full season of filming.", evidence: "Parents watch the free teaser but don't buy, or coaches never open the reel links.", change: "Sell exposure, not outcomes. Track coach opens and replies to prove value, and lead with team bundles." },
    { target: "FLOW formulas", obj: `EXTREME's score correlates ${formulas.extreme.corr_momentum} with momentum alone — partly a momentum screen. Neither formula has a stock-level out-of-sample test.`, fail: "EXTREME top names fall >50% in a rate shock.", evidence: "A point-in-time backtest showing no excess return vs. equal weight.", change: "Collect point-in-time scores quarterly starting now — build the out-of-sample record forward." },
    { target: "New investing framework", obj: "FLOW DIVERGENCE was mostly the trend rule in disguise.", fail: "Already failed: no out-of-sample improvement.", evidence: "Shown in the FLOW Investing Lab below.", change: "Rejected at index level. Next experiment: stock-level estimate revisions vs. price stress." },
  ];
  return (
    <Section id="red-team" n="13 — Red Team" title="Attack everything." lede="The strongest objection to each conclusion on this page — and what would prove it wrong." tone="ink">
      <div className="divide-y divide-white/10 border-y border-white/10">
        {rows.map((r) => (
          <Disclosure key={r.target} dark className="py-1" title={<span className="font-serif text-xl sm:text-2xl">{r.target}</span>}>
            <dl className="grid sm:grid-cols-2 gap-x-10 gap-y-5 pb-2 text-sand">
              <div><dt className="text-xs uppercase tracking-wider text-coral">Strongest objection</dt><dd className="mt-1 text-cream">{r.obj}</dd></div>
              <div><dt className="text-xs uppercase tracking-wider text-coral">Failure condition</dt><dd className="mt-1">{r.fail}</dd></div>
              <div><dt className="text-xs uppercase tracking-wider text-coral">Evidence that would invalidate it</dt><dd className="mt-1">{r.evidence}</dd></div>
              <div><dt className="text-xs uppercase tracking-wider text-coral">What should change</dt><dd className="mt-1">{r.change}</dd></div>
            </dl>
          </Disclosure>
        ))}
      </div>
    </Section>
  );
}

/* ------------------------------ FINAL BUSINESS ----------------------------- */
export function FinalBusiness() {
  const sec = bizFinal.sections as [string, string][];
  const lead = sec.slice(0, 6), money = sec.slice(6, 14), ops = sec.slice(14, 24), plan = sec.slice(24);
  return (
    <Section id="final-business" n="12 — Final Business" title={bizFinal.name} lede={bizFinal.pitch}>
      <div className="flex gap-2 mb-8"><Badge t="RESEARCH HYPOTHESIS" /></div>
      <div className="grid md:grid-cols-2 gap-x-14 gap-y-8">
        {lead.map(([k, v]) => <div key={k}><div className="text-xs uppercase tracking-wider text-clay">{k}</div><p className="mt-2 leading-relaxed">{v}</p></div>)}
      </div>
      <div className="mt-14">
        <H3>The money path</H3>
        <ol className="mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-line border border-line rounded-xl overflow-hidden">
          {money.map(([k, v]) => <li key={k} className="bg-paper p-5"><div className="text-xs uppercase tracking-wider text-clay">{k}</div><p className="mt-2 text-sm leading-relaxed text-brown">{v}</p></li>)}
        </ol>
      </div>
      <div className="mt-14 grid lg:grid-cols-2 gap-12">
        <div><H3 className="mb-2">Operating it</H3><div className="border-t border-line">{ops.map(([k, v]) => <Expand key={k} title={k}>{v}</Expand>)}</div></div>
        <div>
          <H3 className="mb-6">Plan</H3>
          <ol className="relative border-l-2 border-clay/40 ml-2 space-y-7">
            {plan.map(([k, v]) => <li key={k} className="pl-6 relative"><span className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full bg-clay ring-4 ring-cream" /><div className="font-medium">{k}</div><p className="text-muted mt-1 leading-relaxed">{v}</p></li>)}
          </ol>
        </div>
      </div>
    </Section>
  );
}

/* ------------------------------- FLOW LAB -------------------------------- */
type Cond = { state: string; period: string; months: number; avg_fwd12: number; hit: number };
export function FlowLab() {
  const t = fw.tests;
  const cond = t.conditional_forward_returns as Cond[];
  const states = Array.from(new Set(cond.map((c) => c.state)));
  const approaches = [
    ["Value", "Buys pessimism cheaply", "Value traps; decade-long droughts", "Ignores why it's cheap"],
    ["Growth", "Captures compounding", "Rate shocks; priced for perfection", "Starting valuation"],
    ["Quality", "Durable, lower drawdowns", "Crowding; lags junk rallies", "Price paid for safety"],
    ["Momentum", "Most persistent anomaly", "Crashes after bear markets", "Why the trend exists"],
    ["Factor investing", "Diversified premia", "Long underperformance", "Data-mined factors"],
    ["Trend following", "Cuts deep drawdowns", "Whipsaw; V-shaped crashes", "Fundamentals entirely"],
    ["Macro", "Cross-asset regime shifts", "Forecasting is hard", "Company-level edge"],
    ["Event-driven", "Defined catalysts", "Binary outcomes", "Base rates"],
    ["Special situations", "Forced sellers", "Complexity hides risk", "Scale"],
    ["Quant / statistical", "Disciplined, testable", "Overfitting; decay", "Regime change"],
    ["Behavioral", "Explains mispricing", "Hard to time", "When psychology flips"],
    ["Long-term compounding", "Tax/cost efficient", "Behavioral exits", "Starting valuation"],
    ["Optionality", "Convex payoffs", "Most options expire", "Position sizing"],
  ];
  return (
    <section id="flow-lab" aria-labelledby="flow-lab-h" className="bg-ink text-cream">
      <div className="mx-auto max-w-6xl px-4 sm:px-8 py-20 sm:py-28">
        <p className="text-xs tracking-[0.18em] uppercase text-coral">15 — FLOW Investing Lab</p>
        <h2 id="flow-lab-h" className="font-serif text-5xl sm:text-7xl tracking-tight mt-3">FLOW Investing Lab</h2>
        <p className="font-serif italic text-2xl sm:text-3xl text-coral mt-3">An experiment in better investing.</p>

        <div className="mt-14">
          <div className="text-xs uppercase tracking-wider text-sand mb-3">Established approaches — strengths, weaknesses, blind spots</div>
          <div className="scroll-x -mx-4 px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[620px] text-sm">
              <thead><tr className="text-left text-sand/70 text-xs uppercase tracking-wider"><th className="py-2 font-medium">Approach</th><th className="font-medium">Strength</th><th className="font-medium">Weakness</th><th className="font-medium">Blind spot</th></tr></thead>
              <tbody className="divide-y divide-white/10">{approaches.map(([a, b, c, d]) => <tr key={a}><td className="py-2.5 pr-4 text-cream">{a}</td><td className="pr-4 text-sand">{b}</td><td className="pr-4 text-sand">{c}</td><td className="text-coral/90">{d}</td></tr>)}</tbody>
            </table>
          </div>
        </div>

        <div className="mt-20 grid lg:grid-cols-[1fr_1.1fr] gap-12">
          <div>
            <div className="flex items-center gap-2"><span className="text-xs uppercase tracking-wider text-sand">New framework</span><Badge t="RESEARCH HYPOTHESIS" /></div>
            <h3 className="font-serif text-4xl mt-3">{fw.name}</h3>
            <p className="text-sand mt-1">{fw.subtitle}</p>
            <p className="mt-6 text-lg leading-relaxed">{fw.principle}</p>
            <p className="mt-4 text-sand leading-relaxed">{fw.intuition}</p>
            <div className="mt-6 rounded-xl bg-white/5 border border-white/10 p-5 font-mono text-[13px] leading-7 text-cream/90 scroll-x">{fw.math.map((m) => <div key={m}>{m}</div>)}</div>
          </div>
          <div className="space-y-0 divide-y divide-white/10 border-y border-white/10 text-sand">
            {([["Inputs", fw.inputs], ["Decision rules", fw.rules], ["Risk controls", fw.risk], ["Exit conditions", fw.exits], ["Failure conditions", fw.failure], ["Potential advantages", fw.advantages], ["Potential disadvantages", fw.disadvantages]] as [string, string[]][]).map(([k, v]) => (
              <div key={k} className="py-3.5 grid grid-cols-[140px_1fr] gap-4"><div className="text-xs uppercase tracking-wider text-coral pt-0.5">{k}</div><ul className="space-y-1">{v.map((x) => <li key={x}>{x}</li>)}</ul></div>
            ))}
            <div className="py-3.5 grid grid-cols-[140px_1fr] gap-4"><div className="text-xs uppercase tracking-wider text-coral pt-0.5">Portfolio</div><p>{fw.portfolio} Rebalancing: {fw.rebalancing}</p></div>
          </div>
        </div>

        <div className="mt-20">
          <div className="flex items-center gap-2"><h3 className="font-serif text-3xl">Try to break it</h3><Badge t="BACKTEST" /></div>
          <div className="mt-6 grid sm:grid-cols-3 gap-6">
            {[["FLOW DIVERGENCE v1", t.test.sharpe, t.test.maxdd], ["10-month trend (simpler)", t.trend_test.sharpe, t.trend_test.maxdd], ["Buy & hold", t.bh_test.sharpe, t.bh_test.maxdd]].map(([n, s, d]) => (
              <div key={n as string} className="border-t border-white/15 pt-4"><div className="text-sm text-sand">{n}</div><div className="num font-serif text-4xl mt-1">{num(s as number)}</div><div className="text-sm text-sand">Sharpe 1980–2023 · max DD {pct(d as number, 0)}</div></div>
            ))}
          </div>
          <div className="mt-10 scroll-x -mx-4 px-4 sm:mx-0 sm:px-0">
            <div className="text-xs uppercase tracking-wider text-sand mb-2">Average next-12-month S&P return by state — does the core claim hold in both periods?</div>
            <table className="w-full min-w-[560px] text-sm num">
              <thead><tr className="text-left text-sand/70 text-xs uppercase"><th className="py-2 font-medium">State</th><th className="font-medium">1900–1979</th><th className="font-medium">1980–2023</th></tr></thead>
              <tbody className="divide-y divide-white/10">
                {states.map((s) => { const a = cond.find((c) => c.state === s && c.period === "train")!, b = cond.find((c) => c.state === s && c.period === "test")!; return (
                  <tr key={s}><td className="py-2.5 pr-4 text-cream">{s}</td><td className="pr-4">{pct(a.avg_fwd12)} <span className="text-sand/60">· {a.months} mo</span></td><td>{pct(b.avg_fwd12)} <span className="text-sand/60">· {b.months} mo</span></td></tr>); })}
              </tbody>
            </table>
          </div>
          <dl className="mt-10 grid md:grid-cols-2 gap-x-12 divide-y divide-white/10 border-y border-white/10 md:divide-y-0">
            {(fw.break_it as [string, string][]).map(([q, a]) => <div key={q} className="py-3 md:border-b md:border-white/10"><dt className="text-cream">{q}</dt><dd className="text-sand text-sm mt-1">{a}</dd></div>)}
          </dl>
          <p className="mt-8 text-lg leading-relaxed border-l-2 border-coral pl-4 max-w-4xl"><span className="text-coral font-semibold">Verdict — </span>{fw.verdict}</p>
        </div>

        <div className="mt-28 sm:mt-36 text-center">
          <div className="font-serif font-semibold tracking-[0.08em] text-7xl sm:text-9xl">FLOW</div>
          <p className="font-serif italic text-2xl sm:text-3xl text-coral mt-4">An Experiment in Better Investing</p>
        </div>
        <div className="mt-16 max-w-3xl mx-auto divide-y divide-white/10 border-y border-white/10">
          {([["The idea", fw.theory.idea], ["The method", fw.theory.method], ["The evidence", fw.theory.evidence], ["The weaknesses", fw.theory.weaknesses], ["The next experiment", fw.theory.next]] as [string, string][]).map(([k, v]) => (
            <div key={k} className="py-7 grid sm:grid-cols-[200px_1fr] gap-3"><div className="text-xs uppercase tracking-[0.18em] text-coral pt-1.5">{k}</div><p className="font-serif text-xl sm:text-2xl leading-snug">{v}</p></div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------- RESEARCH QUALITY ---------------------------- */
export function Quality() {
  return (
    <section id="quality" aria-labelledby="quality-h" className="bg-cream border-t border-line">
      <div className="mx-auto max-w-6xl px-4 sm:px-8 py-16 pb-36">
        <h2 id="quality-h" className="font-serif text-3xl sm:text-4xl">Research quality</h2>
        <p className="text-muted mt-2 max-w-2xl">{sources.policy}</p>
        <div className="mt-8 scroll-x -mx-4 px-4 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="text-left text-faint text-xs uppercase tracking-wider"><th className="py-2 font-medium">Source</th><th className="font-medium">Coverage</th><th className="font-medium">Cached</th><th className="font-medium">Type</th></tr></thead>
            <tbody className="divide-y divide-line">{sources.sources.map((s) => <tr key={s.id} className="align-top"><td className="py-2.5 pr-4">{s.url ? <a className="underline decoration-sand underline-offset-2 hover:text-clay" href={s.url} target="_blank" rel="noreferrer">{s.name}</a> : s.name}</td><td className="pr-4 text-muted">{s.coverage}</td><td className="pr-4 text-muted font-mono text-xs">{s.cached ?? "—"}</td><td><Badge t={s.type} /></td></tr>)}</tbody>
          </table>
        </div>
        <div className="mt-10 grid md:grid-cols-3 gap-8 text-sm text-muted">
          <div><div className="font-medium text-ink mb-1">Known limitations</div>Monthly index data (not daily); dividends frozen after mid-2023; no point-in-time stock fundamentals; swing tests use WTI crude; scenario returns are judgments.</div>
          <div><div className="font-medium text-ink mb-1">Bias controls</div>Signals lagged one period; train/test split at 1980; walk-forward; parameter grids reported in full; costs included; failed experiments kept ({strat.lab.filter((l) => l.breakit.includes("Rejected") || l.breakit.includes("Broken")).length} index strategies rejected).</div>
          <div><div className="font-medium text-ink mb-1">Not advice</div>FLOW is an educational research tool. It executes no trades and does not bypass any brokerage restriction. Past performance does not guarantee future results.</div>
        </div>
      </div>
    </section>
  );
}
