import inv from "@/data/investments.json";
import q from "@/data/quant_experiments.json";
import sw from "@/data/swing_backtests.json";
import f from "@/data/flow_formulas.json";
import pm from "@/data/portfolio_models.json";
import market from "@/data/market_data.json";
import fw from "@/data/flow_framework.json";
import biz from "@/data/flow_business.json";

export const runtime = "nodejs";

const MODELS = { haiku: "claude-haiku-4-5-20251001", sonnet: "claude-sonnet-5-5" } as const;

// Compact, cached-once context so Claude can answer about everything on the page.
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

const SYSTEM = `You are Claude, embedded in FLOW — an educational investing, trading and business research lab built as a single-page website. Today is 2026-10-06.
Be a sharp, warm, concise tutor and research partner. Prefer short paragraphs and tight bullet lists. Use concrete numbers from the FLOW data below when relevant and say which section of the site to look at (Market, Investing, Opportunities, Portfolio Lab, Swing Trading, Quant Trading, Strategy Lab, Learn, Catalysts, Business Lab, Final Business, Red Team, FLOW Formulas, FLOW Investing Lab).
Rules: FLOW is education and simulation only. Never claim to place trades or give personalized financial advice; do not help bypass brokerage, age, margin, options or other account restrictions. Label uncertainty honestly; FLOW company metrics are approximate mid-2026 knowledge and backtests are historical (past performance does not guarantee future results). Explain the math when asked. If a user's idea is weak, say why kindly and suggest a better test.
FLOW DATA (JSON): ${CONTEXT}`;

type Msg = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return new Response("Claude isn't connected yet. Add ANTHROPIC_API_KEY to .env.local and restart the dev server (see README).", { status: 501 });
  let body: { messages?: Msg[]; model?: keyof typeof MODELS; section?: string };
  try { body = await req.json(); } catch { return new Response("Bad request", { status: 400 }); }
  const model = MODELS[body.model ?? "haiku"] ?? MODELS.haiku;
  const messages = (body.messages ?? []).filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim()).slice(-20)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 8000) }));
  if (!messages.length || messages[messages.length - 1].role !== "user") return new Response("Bad request", { status: 400 });

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model, max_tokens: body.model === "sonnet" ? 2048 : 1024, stream: true,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }, { type: "text", text: `The user is currently viewing the "${(body.section ?? "home").slice(0, 40)}" section.` }],
      messages,
    }),
    signal: req.signal,
  });
  if (!upstream.ok || !upstream.body) {
    const t = await upstream.text().catch(() => "");
    return new Response(`Claude returned an error (${upstream.status}). ${t.slice(0, 300)}`, { status: 502 });
  }
  const reader = upstream.body.getReader();
  const dec = new TextDecoder(), enc = new TextEncoder();
  let buf = "";
  const stream = new ReadableStream({
    async pull(ctrl) {
      const { done, value } = await reader.read();
      if (done) { ctrl.close(); return; }
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n"); buf = lines.pop() ?? "";
      for (const l of lines) {
        if (!l.startsWith("data:")) continue;
        try {
          const ev = JSON.parse(l.slice(5));
          if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") ctrl.enqueue(enc.encode(ev.delta.text));
          if (ev.type === "error") ctrl.enqueue(enc.encode(`\n\n[${ev.error?.message ?? "stream error"}]`));
        } catch {}
      }
    },
    cancel() { reader.cancel(); },
  });
  return new Response(stream, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}
