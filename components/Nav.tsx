"use client";
import { useEffect, useRef, useState } from "react";
import { FlowMark } from "./ui";

export const SECTIONS = [
  ["home", "Home"], ["market", "Market"], ["investing", "Investing"], ["opportunities", "Opportunities"], ["portfolio", "Portfolio Lab"],
  ["swing", "Swing"], ["quant", "Quant"], ["strategy", "Strategy Lab"], ["learn", "Learn"], ["catalysts", "Catalysts"],
  ["business", "Business Lab"], ["final-business", "Final Business"], ["red-team", "Red Team"], ["formulas", "Formulas"], ["flow-lab", "FLOW Lab"], ["quality", "Quality"],
] as const;

export default function Nav() {
  const [active, setActive] = useState("home");
  const [scrolled, setScrolled] = useState(false);
  const rail = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const obs = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && setActive(e.target.id)), { rootMargin: "-45% 0px -50% 0px" });
    SECTIONS.forEach(([id]) => { const el = document.getElementById(id); if (el) obs.observe(el); });
    const onS = () => setScrolled(window.scrollY > 40);
    onS(); window.addEventListener("scroll", onS, { passive: true });
    return () => { obs.disconnect(); window.removeEventListener("scroll", onS); };
  }, []);
  useEffect(() => {
    const el = rail.current?.querySelector<HTMLElement>(`[data-id="${active}"]`);
    if (el && rail.current) rail.current.scrollTo({ left: el.offsetLeft - rail.current.clientWidth / 2 + el.clientWidth / 2, behavior: "smooth" });
  }, [active]);
  return (
    <header className={`sticky top-0 z-40 transition-all duration-500 ${scrolled ? "bg-cream/75 backdrop-blur-xl backdrop-saturate-150 border-b border-line/70 shadow-[0_1px_0_rgb(255_255_255/.6)_inset]" : "bg-transparent border-b border-transparent"}`} style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <nav aria-label="Sections" className="mx-auto max-w-6xl flex items-center gap-4 px-4 sm:px-8 h-14">
        <a href="#home" aria-label="FLOW home" className="text-ink shrink-0"><FlowMark /></a>
        <div ref={rail} className="scrollbar-none flex-1 overflow-x-auto [mask-image:linear-gradient(90deg,transparent,#000_16px,#000_calc(100%-24px),transparent)]">
          <ul className="flex gap-1 w-max px-3">
            {SECTIONS.slice(1).map(([id, label]) => (
              <li key={id}>
                <a data-id={id} href={`#${id}`} aria-current={active === id ? "true" : undefined}
                  className={`block rounded-full px-3 py-1.5 text-[13px] whitespace-nowrap transition-all duration-300 ${active === id ? "bg-ink text-cream shadow-sm" : "text-muted hover:text-ink hover:bg-beige/80"}`}>{label}</a>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </header>
  );
}
