"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

/** Page-level motion: reveal-on-scroll + scroll progress. Content stays visible if JS never runs. */
export function MotionRoot() {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("js-motion");
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -60px 0px", threshold: 0 });
    const scan = () => document.querySelectorAll("[data-reveal]:not(.is-in)").forEach((el) => io.observe(el));
    scan();
    const mo = new MutationObserver(scan); mo.observe(document.body, { childList: true, subtree: true });
    let raf = 0;
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { const h = root.scrollHeight - innerHeight; bar.current?.style.setProperty("--p", String(h > 0 ? scrollY / h : 0)); }); };
    onScroll(); addEventListener("scroll", onScroll, { passive: true });
    return () => { io.disconnect(); mo.disconnect(); removeEventListener("scroll", onScroll); };
  }, []);
  return <div ref={bar} className="progress" aria-hidden />;
}

/** Smooth height disclosure (replaces <details>). */
export function Disclosure({ title, meta, children, defaultOpen = false, dark = false, className = "" }: { title: ReactNode; meta?: ReactNode; children: ReactNode; defaultOpen?: boolean; dark?: boolean; className?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`${open ? "disc-open" : ""} ${className}`}>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className={`w-full flex items-center gap-3 py-4 text-left ${dark ? "hover:text-coral" : "hover:text-clay-dark"} active:!scale-100`}>
        <svg className={`disc-chev h-3.5 w-3.5 shrink-0 ${dark ? "text-coral" : "text-clay"}`} viewBox="0 0 12 12" aria-hidden><path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <span className="flex-1 min-w-0">{title}</span>
        {meta && <span className={`text-sm shrink-0 ${dark ? "text-sand" : "text-muted"}`}>{meta}</span>}
      </button>
      <div className={`disc-body ${open ? "open" : ""}`}><div><div className="pb-5 pl-6.5">{children}</div></div></div>
    </div>
  );
}

/** Apple-style segmented control with a sliding pill. */
export function Segmented<T extends string>({ value, options, onChange, label, dark = false }: { value: T; options: { v: T; l: ReactNode }[]; onChange: (v: T) => void; label: string; dark?: boolean }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState({ x: 0, w: 0 });
  useEffect(() => {
    const measure = () => { const el = wrap.current?.querySelector<HTMLElement>(`[data-v="${CSS.escape(value)}"]`); if (el) setPill({ x: el.offsetLeft, w: el.offsetWidth }); };
    measure(); addEventListener("resize", measure); return () => removeEventListener("resize", measure);
  }, [value]);
  return (
    <div className="scroll-x scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
      <div ref={wrap} role="tablist" aria-label={label} className={`relative inline-flex rounded-full p-1 ${dark ? "bg-white/10" : "bg-beige"}`}>
        <span aria-hidden className={`seg-pill absolute top-1 bottom-1 left-0 rounded-full shadow-sm ${dark ? "bg-cream" : "bg-ink"}`} style={{ transform: `translateX(${pill.x}px)`, width: pill.w }} />
        {options.map((o) => (
          <button key={o.v} data-v={o.v} role="tab" aria-selected={value === o.v} onClick={() => onChange(o.v)}
            className={`relative z-10 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors duration-300 ${value === o.v ? (dark ? "text-ink" : "text-cream") : dark ? "text-sand hover:text-cream" : "text-brown hover:text-ink"}`}>{o.l}</button>
        ))}
      </div>
    </div>
  );
}

/** Number that tweens to its new value. */
export function Tween({ value, format, className = "" }: { value: number; format: (v: number) => string; className?: string }) {
  const [v, setV] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const a = from.current, b = value, t0 = performance.now(), dur = 550;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { setV(b); from.current = b; return; }
    let raf = 0;
    const step = (t: number) => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 4); const x = a + (b - a) * e; setV(x); from.current = x; if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className={`num ${className}`}>{format(v)}</span>;
}

/** Counts up once when scrolled into view. */
export function CountUp({ to, className = "" }: { to: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [v, setV] = useState(to);
  useEffect(() => {
    const el = ref.current; if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setV(0);
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return; io.disconnect();
      const t0 = performance.now();
      const step = (t: number) => { const k = Math.min(1, (t - t0) / 1400); setV(Math.round(to * (1 - Math.pow(1 - k, 4)))); if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    });
    io.observe(el); return () => io.disconnect();
  }, [to]);
  return <span ref={ref} className={`num ${className}`}>{v}</span>;
}
