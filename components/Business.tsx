"use client";
import { useMemo, useState } from "react";
import biz from "@/data/business_ideas.json";
import { Badge, H3, Section } from "./ui";

const LBL: Record<string, string> = { demand: "Demand", originality: "Original", profit: "Profit", startup_cost: "Low cost", margin: "Margin", recurring: "Recurring", scalability: "Scale", defensibility: "Defend", teen_feasibility: "Teen-able", speed: "Speed", long_term: "Long-term" };
type Idea = (typeof biz.ideas)[number];

export default function Business() {
  const [k, setK] = useState("total");
  const ideas = useMemo(() => [...biz.ideas].sort((a, b) => (k === "total" ? b.total - a.total : (b.scores as Record<string, number>)[k] - (a.scores as Record<string, number>)[k])), [k]);
  const top = new Set(biz.top3);
  return (
    <Section id="business" n="11 — Business Lab" title="Something real to start." lede="Twenty unconventional businesses a teenager could actually begin — with a parent where needed. Generic ideas were rejected before scoring." tone="paper">
      <div className="flex flex-wrap items-center gap-2 mb-6"><Badge t="RESEARCH HYPOTHESIS" /><span className="text-sm text-muted">Rejected outright: {biz.rejected_generic.join(", ")}.</span></div>
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[920px] text-sm num">
          <thead><tr className="text-left text-faint text-[11px] uppercase tracking-wider border-b border-line">
            <th className="py-2 font-medium w-[34%]">Idea</th>
            {["total", ...biz.criteria].map((c) => <th key={c} className="font-medium px-1 text-center"><button aria-pressed={k === c} onClick={() => setK(c)} className={`hover:text-ink ${k === c ? "text-clay" : ""}`}>{c === "total" ? "Score" : LBL[c]}</button></th>)}
          </tr></thead>
          <tbody className="divide-y divide-line">
            {ideas.map((i: Idea) => (
              <tr key={i.name} className={top.has(i.name) ? "bg-blush/40" : ""}>
                <td className="py-2.5 pr-3"><span className="font-semibold">{i.name}</span>{top.has(i.name) && <span className="ml-2 text-[10px] uppercase tracking-wider text-clay font-semibold">Top 3</span>}<span className="block text-xs text-muted leading-snug mt-0.5 font-sans">{i.pitch}</span></td>
                <td className="text-center font-semibold">{i.total.toFixed(1)}</td>
                {biz.criteria.map((c) => { const v = (i.scores as Record<string, number>)[c]; return <td key={c} className="text-center"><span className="inline-block w-7 rounded py-0.5" style={{ background: `rgba(198,97,63,${(v - 1) / 14})` }}>{v}</span></td>; })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-20">
        <H3>Red team: the top three</H3>
        <div className="mt-6 grid lg:grid-cols-3 gap-8">
          {biz.red_team.map((r, n) => (
            <article key={r.name} className={`rounded-2xl border p-6 ${n === 0 ? "border-clay bg-cream" : "border-line bg-cream/60"}`}>
              <div className="flex items-center justify-between"><h4 className="font-serif text-2xl">{r.name}</h4>{n === 0 && <span className="text-[10px] uppercase tracking-wider text-paper bg-clay rounded-full px-2 py-0.5 font-semibold">Chosen</span>}</div>
              <dl className="mt-4 space-y-3 text-sm">{(r.attacks as string[][]).map(([q, a]) => <div key={q}><dt className="font-medium">{q}</dt><dd className="text-muted">{a}</dd></div>)}</dl>
              <div className="mt-5 pt-4 border-t border-line text-sm"><span className="text-xs uppercase tracking-wider text-clay">Improved</span><p className="mt-1">{r.fix}</p></div>
            </article>
          ))}
        </div>
      </div>
    </Section>
  );
}
