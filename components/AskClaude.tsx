"use client";
import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Spark } from "./ui";
import { SECTIONS } from "./Nav";

type Msg = { role: "user" | "assistant"; content: string };
type Model = "haiku" | "sonnet";
const SUGGEST = [
  "Explain why trend following survived out-of-sample",
  "What's the bear case for the #1 opportunity?",
  "How is FLOW CORE different from FLOW EXTREME?",
  "Teach me Sharpe vs Sortino with an example",
];

/* tiny, safe markdown: paragraphs, bullets, numbered lists, headings, **bold**, `code` */
function inline(s: string): ReactNode[] {
  return s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? <strong key={i} className="font-semibold text-ink">{p.slice(2, -2)}</strong>
      : p.startsWith("`") && p.endsWith("`") ? <code key={i} className="rounded bg-beige px-1 py-0.5 text-[0.9em]">{p.slice(1, -1)}</code>
      : <Fragment key={i}>{p}</Fragment>);
}
function Markdown({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <>
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*[-*•]\s/.test(l))) return <ul key={i} className="my-2 space-y-1 pl-4 list-disc marker:text-clay">{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*[-*•]\s/, ""))}</li>)}</ul>;
        if (lines.every((l) => /^\s*\d+[.)]\s/.test(l))) return <ol key={i} className="my-2 space-y-1 pl-5 list-decimal marker:text-clay">{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*\d+[.)]\s/, ""))}</li>)}</ol>;
        if (/^#{1,4}\s/.test(b)) return <p key={i} className="font-serif text-lg mt-3 mb-1 text-ink">{inline(b.replace(/^#{1,4}\s/, ""))}</p>;
        return <p key={i} className="my-2">{lines.map((l, j) => <Fragment key={j}>{j > 0 && <br />}{inline(l)}</Fragment>)}</p>;
      })}
    </>
  );
}

function currentSection() {
  const mid = window.innerHeight * 0.4;
  for (const [id, label] of [...SECTIONS].reverse()) { const el = document.getElementById(id); if (el && el.getBoundingClientRect().top < mid) return label; }
  return "Home";
}

export default function AskClaude() {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [origin, setOrigin] = useState({ x: 50, y: 95 });
  const [model, setModel] = useState<Model>("haiku");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [section, setSection] = useState("Home");
  const btn = useRef<HTMLButtonElement>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);

  const doOpen = () => {
    const r = btn.current?.getBoundingClientRect();
    if (r) setOrigin({ x: ((r.left + r.width / 2) / window.innerWidth) * 100, y: ((r.top + r.height / 2) / window.innerHeight) * 100 });
    setSection(currentSection());
    setClosing(false); setOpen(true);
  };
  const doClose = useCallback(() => { setClosing(true); setTimeout(() => { setOpen(false); setClosing(false); btn.current?.focus(); }, 220); }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    const t = setTimeout(() => ta.current?.focus(), 500);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") doClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; clearTimeout(t); window.removeEventListener("keydown", onKey); };
  }, [open, doClose]);
  useEffect(() => { const onK = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); open ? doClose() : doOpen(); } }; window.addEventListener("keydown", onK); return () => window.removeEventListener("keydown", onK); });
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight, behavior: busy ? "auto" : "smooth" }); }, [msgs, busy]);

  const send = async (text: string) => {
    const t = text.trim(); if (!t || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content: t }];
    setMsgs([...next, { role: "assistant", content: "" }]); setInput(""); setBusy(true);
    if (ta.current) ta.current.style.height = "auto";
    const ac = new AbortController(); abort.current = ac;
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: next, model, section }), signal: ac.signal });
      if (!res.ok || !res.body) { const m = await res.text(); setMsgs([...next, { role: "assistant", content: m || "Something went wrong." }]); return; }
      const rd = res.body.getReader(), dec = new TextDecoder(); let acc = "";
      for (;;) { const { done, value } = await rd.read(); if (done) break; acc += dec.decode(value, { stream: true }); setMsgs([...next, { role: "assistant", content: acc }]); }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setMsgs([...next, { role: "assistant", content: "Network error — check your connection and try again." }]);
    } finally { setBusy(false); abort.current = null; }
  };
  const stop = () => abort.current?.abort();
  const last = msgs[msgs.length - 1];
  const waiting = busy && last?.role === "assistant" && !last.content;

  return (
    <>
      {!open && (
        <div className="fixed left-1/2 z-50 bar-in w-[calc(100%-32px)] max-w-md" style={{ bottom: "max(16px, env(safe-area-inset-bottom))" }}>
          <button ref={btn} onClick={doOpen} aria-haspopup="dialog" className="group w-full flex items-center gap-3 rounded-full bg-ink/95 text-cream pl-2 pr-4 py-2 shadow-[0_10px_30px_-8px_rgb(41_35_31/.45)] ring-1 ring-white/10 backdrop-blur hover:bg-ink transition-colors">
            <span className="grid place-items-center h-9 w-9 rounded-full bg-clay text-paper transition-transform duration-300 group-hover:rotate-45"><Spark className="h-5 w-5" /></span>
            <span className="flex-1 text-left text-[15px] text-sand group-hover:text-cream transition-colors">Ask Claude about anything here…</span>
            <span className="hidden sm:inline text-[11px] text-sand/70 border border-white/15 rounded px-1.5 py-0.5">⌘K</span>
          </button>
        </div>
      )}

      {open && (
        <div className={`fixed inset-0 z-[60] ${closing ? "opacity-0 transition-opacity duration-200" : ""}`} role="dialog" aria-modal="true" aria-label="Chat with Claude">
          <div className="veil absolute inset-0 bg-ink/40 backdrop-blur-[6px]" onClick={doClose} />
          {/* intro choreography */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="bloom absolute rounded-full bg-clay/35" style={{ left: `${origin.x}%`, top: `${origin.y}%`, width: "260vmax", height: "260vmax" }} />
            <div className="absolute" style={{ left: `${origin.x}%`, top: `${origin.y}%` }}>
              {Array.from({ length: 14 }).map((_, i) => <span key={i} className="ray absolute left-0 top-0 h-[3px] w-24 origin-left rounded-full bg-gradient-to-r from-coral to-transparent" style={{ ["--a" as string]: `${i * (360 / 14)}deg`, animationDelay: `${(i % 3) * 40}ms` }} />)}
            </div>
            <div className="spark-fly absolute left-1/2 top-1/2 text-clay [animation-fill-mode:both]" style={{ animation: "spark-fly .85s cubic-bezier(.2,.8,.2,1) both, veil-in .3s ease .7s reverse both" }}><Spark className="h-40 w-40 sm:h-56 sm:w-56" /></div>
          </div>

          <div className="panel-up absolute inset-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[min(720px,92vw)] sm:h-[min(760px,88dvh)] flex flex-col bg-paper sm:rounded-3xl shadow-[0_30px_80px_-20px_rgb(41_35_31/.5)] ring-1 ring-line overflow-hidden" style={{ paddingTop: "env(safe-area-inset-top)" }}>
            <header className="flex items-center gap-3 px-4 sm:px-5 py-3 border-b border-line">
              <span className={`grid place-items-center h-9 w-9 rounded-full bg-clay text-paper ${waiting ? "thinking" : ""}`}><Spark className="h-5 w-5" /></span>
              <div className="flex-1 min-w-0"><div className="font-medium leading-tight">Claude</div><div className="text-xs text-muted truncate">Viewing: {section}</div></div>
              <div role="radiogroup" aria-label="Model" className="relative grid grid-cols-2 rounded-full bg-beige p-1 text-xs font-medium">
                <span aria-hidden className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full bg-paper shadow-sm transition-transform duration-300" style={{ transform: model === "sonnet" ? "translateX(100%)" : "none" }} />
                {(["haiku", "sonnet"] as Model[]).map((m) => <button key={m} role="radio" aria-checked={model === m} onClick={() => setModel(m)} className={`relative px-3 py-1.5 rounded-full transition-colors ${model === m ? "text-ink" : "text-muted"}`}>{m === "haiku" ? "Haiku 4.5" : "Sonnet 5.5"}</button>)}
              </div>
              <button onClick={doClose} aria-label="Close chat" className="h-9 w-9 grid place-items-center rounded-full hover:bg-beige text-muted text-xl">×</button>
            </header>

            <div ref={list} className="flex-1 overflow-y-auto px-4 sm:px-6 py-5" aria-live="polite">
              {msgs.length === 0 ? (
                <div className="h-full flex flex-col justify-center msg-in">
                  <Spark className="h-10 w-10 text-clay" />
                  <h2 className="font-serif text-3xl sm:text-4xl mt-4 leading-tight">What should we figure out?</h2>
                  <p className="text-muted mt-2">I can see all of FLOW&apos;s research — backtests, portfolios, formulas and the business plan. {model === "haiku" ? "Haiku is fast." : "Sonnet thinks deeper."}</p>
                  <div className="mt-6 grid sm:grid-cols-2 gap-2">
                    {SUGGEST.map((s, i) => <button key={s} onClick={() => send(s)} className="msg-in text-left text-sm rounded-xl border border-line bg-cream px-3.5 py-3 hover:border-clay hover:bg-blush/40 transition-colors" style={{ animationDelay: `${0.5 + i * 0.06}s` }}>{s}</button>)}
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  {msgs.map((m, i) => m.role === "user" ? (
                    <div key={i} className="msg-in flex justify-end"><div className="max-w-[85%] rounded-2xl rounded-br-md bg-ink text-cream px-4 py-2.5 whitespace-pre-wrap">{m.content}</div></div>
                  ) : (
                    <div key={i} className="msg-in flex gap-3">
                      <span className={`mt-1 shrink-0 text-clay ${busy && i === msgs.length - 1 && !m.content ? "thinking" : ""}`}><Spark className="h-5 w-5" /></span>
                      <div className={`min-w-0 text-[15px] leading-relaxed text-brown ${busy && i === msgs.length - 1 && m.content ? "caret" : ""}`}>{m.content ? <Markdown text={m.content} /> : <span className="text-muted italic">Thinking…</span>}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="border-t border-line p-3 sm:p-4" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
              <div className="flex items-end gap-2 rounded-2xl border border-sand bg-cream px-3 py-2 focus-within:border-clay transition-colors">
                <label htmlFor="ask" className="sr-only">Message Claude</label>
                <textarea id="ask" ref={ta} rows={1} value={input} placeholder="Ask about a strategy, a stock, a formula…"
                  onChange={(e) => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = `${Math.min(160, e.target.scrollHeight)}px`; }}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(input); } }}
                  className="flex-1 resize-none bg-transparent outline-none focus-visible:outline-none py-1.5 text-[16px] placeholder:text-faint max-h-40" />
                {busy ? (
                  <button type="button" onClick={stop} aria-label="Stop" className="h-9 w-9 grid place-items-center rounded-full bg-ink text-cream"><span className="h-3 w-3 rounded-sm bg-cream" /></button>
                ) : (
                  <button type="submit" disabled={!input.trim()} aria-label="Send" className="h-9 w-9 grid place-items-center rounded-full bg-clay text-paper disabled:opacity-35 hover:bg-clay-dark transition-colors">
                    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden><path d="M8 13V3M3.5 7.5L8 3l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </button>
                )}
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-faint px-1"><span>Education only · not financial advice</span>{msgs.length > 0 && <button type="button" onClick={() => setMsgs([])} className="hover:text-ink">New chat</button>}</div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
