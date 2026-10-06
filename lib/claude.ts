/* Free Claude access in the browser via Puter.js (https://docs.puter.com) — no API key, no server. */
import inv from "@/data/investments.json";
import q from "@/data/quant_experiments.json";
import sw from "@/data/swing_backtests.json";
import f from "@/data/flow_formulas.json";
import pm from "@/data/portfolio_models.json";
import market from "@/data/market_data.json";
import fw from "@/data/flow_framework.json";
import biz from "@/data/flow_business.json";

export type Msg = { role: "user" | "assistant"; content: string };
export type Model = "haiku" | "sonnet";

// Newest first; falls back if Puter doesn't offer a name yet.
const CANDIDATES: Record<Model, string[]> = {
  haiku: ["claude-haiku-4-5", "claude-3-5-haiku-latest", "claude-3-haiku"],
  sonnet: ["claude-sonnet-5-5", "claude-sonnet-4-5", "claude-sonnet-4"],
};

const CONTEXT = JSON.stringify({
  market: market.items.map((i) => ({ [i.label]: i.value, as_of: i.as_of, type: i.type })),
  top10: inv.top10,
  universe: inv.items.map((i) => ({ t: i.ticker, sector: i.sector, scen3y: i.scenarios, ev: i.ev, why: i.why, risk: i.go_wrong, invalid: i.invalidation, extreme: i.flow_extreme, core: i.flow_core })),
  quant: q.experiments.map((e) => ({ name: e.name, train_sharpe: e.train.sharpe, test_sharpe: e.test.sharpe, test_maxdd: e.test.maxdd, bh_test_sharpe: e.bh_test.sharpe, bh_test_maxdd: e.bh_test.maxdd })),
  walk_forward: { wf: q.walk_forward.result, bh: q.walk_forward.bh },
  overfitting_demo: q.overfitting_demo,
  swing: { note: sw.data_note, results: sw.strategies.map((s) => ({ name: s.name, train_pf: s.train?.profit_factor, test_pf: s.test?.profit_factor, test_win: s.test?.win_rate })) },
  formulas: { extreme: { formula: f.extreme.formula, top: f.extreme.top, robustness: f.extreme.robustness }, core: { formula: f.core.formula, overlay: f.core.overlay, top: f.core.top }, corr: f.corr_extreme_core },
  portfolios: pm.models.map((m) => ({ name: m.name, alloc: m.allocation.map((a) => `${a.ticker} ${a.weight}%`).join(", "), bear: m.bear, base: m.base, bull: m.bull, xbull: m.xbull, weighted: m.weighted, risk: m.risk })),
  framework: { name: fw.name, principle: fw.principle, verdict: fw.verdict, next: fw.theory.next },
  business: { name: biz.name, pitch: biz.pitch },
});

const system = (section: string) => `You are Claude, embedded in FLOW — an educational investing, trading and business research lab built as a single-page website. Today is 2026-10-06. The user is viewing the "${section}" section.
Be a sharp, warm, concise tutor and research partner. Prefer short paragraphs and tight bullet lists. Use concrete numbers from the FLOW data below when relevant and point to the section of the site to look at.
Rules: FLOW is education and simulation only. Never claim to place trades or give personalized financial advice; never help bypass brokerage, age, margin, options or other account restrictions. Be honest about uncertainty: company metrics are approximate mid-2026 knowledge and backtests are historical (past performance does not guarantee future results). If an idea is weak, say why kindly and suggest a better test.
FLOW DATA (JSON): ${CONTEXT}`;

type Puter = { ai: { chat: (m: unknown, o: unknown) => Promise<AsyncIterable<{ text?: string }>> } };
declare global { interface Window { puter?: Puter } }

let loading: Promise<Puter> | null = null;
export function loadPuter(): Promise<Puter> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.puter) return Promise.resolve(window.puter);
  loading ??= new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://js.puter.com/v2/";
    s.async = true;
    s.onload = () => (window.puter ? res(window.puter) : rej(new Error("Puter failed to initialize")));
    s.onerror = () => { loading = null; rej(new Error("Couldn't load the free Claude connector (js.puter.com). Check your connection or ad-blocker.")); };
    document.head.appendChild(s);
  });
  return loading;
}

const errText = (e: unknown) => {
  if (e instanceof Error) return e.message;
  const o = e as { error?: { message?: string } | string; message?: string };
  return typeof o?.error === "string" ? o.error : o?.error?.message ?? o?.message ?? "Unknown error";
};

/** Streams a reply. Returns the model id actually used. */
export async function streamChat(msgs: Msg[], model: Model, section: string, onText: (t: string) => void, aborted: () => boolean): Promise<string> {
  const puter = await loadPuter();
  const payload = [{ role: "system", content: system(section) }, ...msgs.slice(-20)];
  let lastErr: unknown;
  for (const id of CANDIDATES[model]) {
    let got = false;
    try {
      const stream = await puter.ai.chat(payload, { model: id, stream: true });
      let acc = "";
      for await (const part of stream) {
        if (aborted()) return id;
        if (part?.text) { acc += part.text; got = true; onText(acc); }
      }
      if (got) return id;
    } catch (e) {
      if (got) throw e;
      lastErr = e; // try next candidate model
    }
  }
  throw new Error(errText(lastErr));
}
