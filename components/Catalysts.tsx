"use client";
import { useState } from "react";
import cat from "@/data/catalysts.json";
import { Badge, Section } from "./ui";

const ST = ["ALL", "UPCOMING", "ACTIVE", "PASSED", "INVALIDATED"] as const;
const SC: Record<string, string> = { UPCOMING: "text-clay-dark bg-blush", ACTIVE: "text-pos bg-[#e3e9dc]", PASSED: "text-muted bg-beige", INVALIDATED: "text-neg bg-[#f2d9d5]" };

export default function Catalysts() {
  const [f, setF] = useState<(typeof ST)[number]>("ALL");
  const items = cat.items.filter((i) => f === "ALL" || i.status === f);
  return (
    <Section id="catalysts" n="10 — Catalysts" title="What could change minds." lede="Events that put a clock on a thesis.">
      <div className="flex flex-wrap items-center gap-2 mb-6"><Badge t="RESEARCH HYPOTHESIS" /><span className="text-sm text-muted">{cat.note}</span></div>
      <div className="flex gap-1.5 scroll-x scrollbar-none" role="group" aria-label="Filter by status">
        {ST.map((s) => <button key={s} aria-pressed={f === s} onClick={() => setF(s)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold tracking-wider ${f === s ? "bg-ink text-cream" : "bg-beige text-brown hover:bg-sand"}`}>{s} <span className="opacity-60">{s === "ALL" ? cat.items.length : cat.items.filter((i) => i.status === s).length}</span></button>)}
      </div>
      <div className="mt-6 scroll-x -mx-4 px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[720px] text-sm">
          <thead><tr className="text-left text-faint text-xs uppercase tracking-wider border-b border-line"><th className="py-2 font-medium">Company</th><th className="font-medium">Catalyst</th><th className="font-medium">Date</th><th className="font-medium">Type</th><th className="font-medium">Impact</th><th className="font-medium">Confidence</th><th className="font-medium">Status</th><th className="font-medium">Source</th></tr></thead>
          <tbody className="divide-y divide-line">
            {items.length === 0 && <tr><td colSpan={8} className="py-6 text-muted">No catalysts with this status. Invalidated theses are moved here when their trigger fires.</td></tr>}
            {items.map((i, k) => (
              <tr key={k} className="align-top hover:bg-paper">
                <td className="py-2.5 pr-3"><span className="font-semibold">{i.ticker}</span><span className="block text-xs text-muted">{i.company}</span></td>
                <td className="py-2.5 pr-3">{i.catalyst}</td><td className="py-2.5 pr-3 num whitespace-nowrap">{i.date}</td><td className="py-2.5 pr-3 text-muted">{i.type}</td>
                <td className="py-2.5 pr-3">{i.impact}</td><td className="py-2.5 pr-3 text-muted">{i.confidence}</td>
                <td className="py-2.5 pr-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${SC[i.status]}`}>{i.status}</span></td>
                <td className="py-2.5 text-xs text-muted">{i.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
