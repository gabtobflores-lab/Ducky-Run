"use client";
import { useMemo, useState } from "react";
import biz from "@/data/business_ideas.json";
import { Badge, H3, Section } from "./ui";
import { Segmented } from "./Motion";

type Idea = (typeof biz.ideas)[number];
const LBL: Record<string, string> = { demand: "Demand", originality: "Originality", profit: "Profit", startup_cost: "Low cost", margin: "Margin", recurring: "Recurring", scalability: "Scale", defensibility: "Defensible", teen_feasibility: "Teen-able", speed: "Speed", long_term: "Long-term" };
const SORTS = { score: "FLOW score", profit: "Profit", startup_cost: "Lowest cost", speed: "Fastest start" } as const;
type SortK = keyof typeof SORTS;

function Ring({ v, size = 56 }: { v: number; size?: number }) {
  const r = 22, c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" role="img" aria-label={`FLOW score ${v.toFixed(1)} of 10`} className="shrink-0">
      <circle cx="28" cy="28" r={r} fill="none" stroke="#ebe3d5" strokeWidth="5" />
      <circle cx="28" cy="28" r={r} fill="none" stroke="#c6613f" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v / 10)} transform="rotate(-90 28 28)" style={{ transition: "stroke-dashoffset .9s cubic-bezier(.22,1,.36,1)" }} />
      <text x="28" y="32" textAnchor="middle" className="num" fontSize="13" fontWeight="600" fill="#29231f">{v.toFixed(1)}</text>
    </svg>
  );
}

function Detail({ i }: { i: Idea }) {
  const rows: [string, string][] = [["Problem", i.problem], ["Customer", i.customer], ["How it works", i.how], ["Why now", i.why_now], ["Pricing", i.pricing], ["Unit economics", i.unit_economics], ["Moat", i.moat], ["Teen fit", i.teen_note]];
  return (
    <div className="grid lg:grid-cols-[1.4fr_1fr] gap-8 pt-6">
      <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-5">
        {rows.map(([k, v]) => <div key={k}><dt className="text-xs uppercase tracking-wider text-clay">{k}</dt><dd className="mt-1.5 leading-relaxed text-brown">{v}</dd></div>)}
      </dl>
      <div className="space-y-6">
        <div>
          <div className="text-xs uppercase tracking-wider text-faint mb-2">Score breakdown</div>
          <div className="space-y-1.5">
            {biz.criteria.map((k) => { const v = (i.scores as Record<string, number>)[k]; return (
              <div key={k} className="grid grid-cols-[88px_1fr_20px] items-center gap-2 text-xs"><span className="text-muted">{LBL[k]}</span><span className="h-1.5 rounded-full bg-beige overflow-hidden"><span className="block h-full rounded-full bg-clay anim-w" style={{ width: `${v * 10}%` }} /></span><span className="num text-right">{v}</span></div>); })}
          </div>
        </div>
        <div><div className="text-xs uppercase tracking-wider text-faint mb-2">First three moves</div><ol className="space-y-1.5 text-sm list-decimal pl-5 marker:text-clay">{i.first_steps.map((x) => <li key={x}>{x}</li>)}</ol></div>
        <div><div className="text-xs uppercase tracking-wider text-neg mb-2">Risks</div><ul className="space-y-1.5 text-sm text-muted">{i.risks.map((x) => <li key={x} className="flex gap-2"><span className="text-neg">·</span>{x}</li>)}</ul></div>
      </div>
    </div>
  );
}

export default function Business() {
  const [cat, setCat] = useState<"All" | "Original" | "Proven money-maker">("All");
  const [sort, setSort] = useState<SortK>("score");
  const [open, setOpen] = useState<string | null>(biz.ideas[0].id);
  const rank = Object.fromEntries(biz.ideas.map((i, n) => [i.id, n + 1]));
  const ideas = useMemo(() => biz.ideas.filter((i) => cat === "All" || i.category === cat)
    .sort((a, b) => sort === "score" ? b.weighted - a.weighted : (b.scores as Record<string, number>)[sort] - (a.scores as Record<string, number>)[sort]), [cat, sort]);
  const top = new Set(biz.top3);
  return (
    <Section id="business" n="11 — Business Lab" title="Fifteen ways to build something." lede="Either genuinely original, or proven businesses with unusually good economics. All startable by a teenager with a parent's help, scored on 11 criteria." tone="paper">
      <div className="flex flex-wrap items-center gap-2 mb-8"><Badge t="RESEARCH HYPOTHESIS" /><span className="text-sm text-muted">Earnings are estimates for part-time work; verify local prices.</span></div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between mb-8">
        <Segmented label="Category" value={cat} onChange={setCat} options={[{ v: "All", l: "All 15" }, { v: "Original", l: "Original" }, { v: "Proven money-maker", l: "Proven money-makers" }]} />
        <Segmented label="Sort" value={sort} onChange={setSort} options={(Object.keys(SORTS) as SortK[]).map((k) => ({ v: k, l: SORTS[k] }))} />
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {ideas.map((i) => {
          const isOpen = open === i.id;
          return (
            <article key={i.id} className={`lift rounded-3xl border bg-cream p-6 flex flex-col ${isOpen ? "md:col-span-2 lg:col-span-3 border-clay/60" : "border-line"} ${top.has(i.name) ? "ring-1 ring-clay/30" : ""}`}>
              <div className="flex items-start gap-4">
                <Ring v={i.weighted} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="num text-xs text-faint">#{rank[i.id]}</span>
                    <span className={`text-[10px] font-semibold uppercase tracking-wider rounded-full px-2 py-0.5 ${i.category === "Original" ? "bg-[#ece4f0] text-[#5d4670]" : "bg-[#e3e9dc] text-pos"}`}>{i.category}</span>
                    {top.has(i.name) && <span className="text-[10px] font-semibold uppercase tracking-wider rounded-full px-2 py-0.5 bg-clay text-paper">Top 3</span>}
                  </div>
                  <h3 className="font-serif text-2xl mt-1.5 leading-tight">{i.name}</h3>
                </div>
              </div>
              <p className="mt-4 text-brown leading-relaxed">{i.pitch}</p>
              <dl className="mt-5 grid grid-cols-3 gap-3 text-sm border-t border-line pt-4">
                <div><dt className="text-[11px] uppercase tracking-wider text-faint">Start-up</dt><dd className="mt-0.5 font-medium">{i.startup_cost.match(/\$[\d.,]+K?(?:–\$[\d.,]+K?)?/)?.[0] ?? i.startup_cost}</dd></div>
                <div><dt className="text-[11px] uppercase tracking-wider text-faint">Year 1</dt><dd className="mt-0.5 font-medium">{i.year1.match(/\$[\d.,]+K?(?:–\$[\d.,]+K?)?/)?.[0] ?? i.year1}</dd></div>
                <div><dt className="text-[11px] uppercase tracking-wider text-faint">First $</dt><dd className="mt-0.5 font-medium">{i.time_to_first_dollar.split(" (")[0].replace(" into the season", "").replace(" (cash comes at move-in)", "")}</dd></div>
              </dl>
              <div className={`disc-body ${isOpen ? "open" : ""}`}><div>{isOpen && <Detail i={i} />}</div></div>
              <button onClick={() => setOpen(isOpen ? null : i.id)} aria-expanded={isOpen} className="mt-5 self-start text-sm font-medium text-clay-dark hover:text-clay inline-flex items-center gap-1.5">
                {isOpen ? "Close plan" : "Open full plan"}<svg className={`h-3 w-3 transition-transform duration-300 ${isOpen ? "-rotate-90" : "rotate-90"}`} viewBox="0 0 12 12" aria-hidden><path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
              </button>
            </article>
          );
        })}
      </div>
      <p className="mt-6 text-xs text-faint max-w-3xl">{biz.method}</p>

      <div className="mt-24">
        <H3>Red team: the top three</H3>
        <p className="text-muted mt-2">Each one attacked as hard as possible, then improved.</p>
        <div className="mt-8 grid lg:grid-cols-3 gap-4">
          {biz.red_team.map((r, n) => (
            <article key={r.name} className={`rounded-3xl border p-6 ${n === 0 ? "border-clay bg-cream" : "border-line bg-cream/60"}`}>
              <div className="flex items-center justify-between gap-2"><h4 className="font-serif text-2xl">{r.name}</h4>{n === 0 && <span className="text-[10px] uppercase tracking-wider text-paper bg-clay rounded-full px-2 py-0.5 font-semibold">Chosen</span>}</div>
              <dl className="mt-4 space-y-3 text-sm">{(r.attacks as string[][]).map(([q, a]) => <div key={q}><dt className="font-medium">{q}</dt><dd className="text-muted">{a}</dd></div>)}</dl>
              <div className="mt-5 pt-4 border-t border-line text-sm"><span className="text-xs uppercase tracking-wider text-clay">Improved</span><p className="mt-1">{r.fix}</p></div>
            </article>
          ))}
        </div>
      </div>
    </Section>
  );
}
