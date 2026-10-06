"""Builds investments, formulas, portfolios and catalysts JSON from investments_src.py. Pure local math."""
import json, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from investments_src import U

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data")
TODAY = "2026-10-06"
SW = dict(bear=0.25, base=0.45, bull=0.22, xbull=0.08)  # scenario weights (assumption, shown in UI)
K = ["g", "q", "v", "m", "c", "o", "b", "x", "s"]

inv = []
for t, n, sec, cap, what, sc, scen, why, right, wrong, inval, cats, metrics in U:
    bear, base, bull, xb = scen
    ev = SW["bear"] * bear + SW["base"] * base + SW["bull"] * bull + SW["xbull"] * xb
    inv.append(dict(ticker=t, company=n, sector=sec, market_cap=cap, business=what, scores=sc, metrics=metrics,
                    scenarios=dict(bear=bear, base=base, bull=bull, xbull=xb), ev=round(ev, 1), rr=round(ev / abs(bear), 2),
                    why=why, go_right=right, go_wrong=wrong, invalidation=inval, catalysts=cats, horizon="3 years",
                    confidence="Medium" if sc["s"] < 8 else "Low", fidelity="Potentially accessible (US-listed stock/ADR)",
                    type="RESEARCH HYPOTHESIS", last_updated="2026-06 (knowledge base) — prices/metrics approximate; verify before use",
                    sources=["company_filings", "flow_analyst_judgment"]))
S = {k: np.array([i["scores"][k] for i in inv], float) for k in K}
EV = np.array([i["ev"] for i in inv]); RR = np.array([i["rr"] for i in inv])
z = lambda a: (a - a.min()) / (a.max() - a.min()) * 10
rank_score = 0.30 * z(EV) + 0.20 * z(RR) + 0.15 * S["q"] + 0.15 * S["x"] + 0.10 * S["c"] + 0.10 * S["b"]
for i, r in zip(inv, rank_score):
    i["flow_rank_score"] = round(float(r), 2)

# ---------------- formulas
EXT = dict(g=0.25, o=0.25, m=0.20, x=0.15, c=0.15)
CORE = dict(q=0.30, b=0.20, v=0.15, lowvol=0.15, g=0.10, m=0.10)
def score(w, S):
    tot = 0
    for k, a in w.items():
        tot = tot + a * (10 - S["s"] if k == "lowvol" else S[k])
    return tot
ext, core = score(EXT, S), score(CORE, S)
gate = S["b"] >= 5  # EXTREME balance-sheet gate: avoid dilution/bankruptcy permanent loss
ext_g = np.where(gate, ext, np.nan)
def spearman(a, b):
    m = np.isfinite(a) & np.isfinite(b)
    ra, rb = np.argsort(np.argsort(a[m])), np.argsort(np.argsort(b[m]))
    return round(float(np.corrcoef(ra, rb)[0, 1]), 2)
rng = np.random.default_rng(11)
def stability(w, gated=False, n=2000):
    base = score(w, S); base = np.where(gate, base, -1) if gated else base
    top = set(np.argsort(-base)[:10]); ov = []
    for _ in range(n):
        ww = {k: v * rng.uniform(0.5, 1.5) for k, v in w.items()}
        s = score(ww, S); s = np.where(gate, s, -1) if gated else s
        ov.append(len(top & set(np.argsort(-s)[:10])) / 10)
    return round(float(np.mean(ov)), 2)
versions_ext = [
    dict(name="v1 — equal weight, all 9 inputs", weights={k: 1 / 9 for k in K if k != "s"}, verdict="Rejected: dilutes asymmetry; ranks quality megacaps on top — it became a CORE clone."),
    dict(name="v2 — growth + momentum only", weights=dict(g=0.5, m=0.5), verdict="Rejected: ~pure momentum; no protection against priced-for-perfection names."),
    dict(name="v3 — final", weights=EXT, verdict="Kept: highest stability under weight noise among non-trivial versions; distinct from momentum alone."),
]
for v in versions_ext:
    s = score(v["weights"], S)
    v["top5"] = [inv[i]["ticker"] for i in np.argsort(-np.where(gate, s, -1))[:5]]
    v["stability"] = stability(v["weights"], True, 600)
    v["corr_momentum"] = spearman(s, S["m"])
versions_core = [
    dict(name="v1 — valuation-heavy (value 50%)", weights=dict(v=0.5, q=0.25, b=0.25), verdict="Rejected: our index backtest shows valuation timing underperformed out of sample (Sharpe 0.51 vs 0.63 buy-and-hold); it loads on troubled names."),
    dict(name="v2 — quality only", weights=dict(q=1.0), verdict="Rejected: too many ties, no valuation discipline."),
    dict(name="v3 — final", weights=CORE, verdict="Kept: balanced, stable ranking, plus a tested market-trend overlay."),
]
for v in versions_core:
    s = score(v["weights"], S)
    v["top5"] = [inv[i]["ticker"] for i in np.argsort(-s)[:5]]
    v["stability"] = stability(v["weights"], False, 600)
    v["corr_momentum"] = spearman(s, S["m"])
for i, a, b in zip(inv, ext_g, core):
    i["flow_extreme"] = None if not np.isfinite(a) else round(float(a), 2)
    i["flow_core"] = round(float(b), 2)

def topk(arr, k=10):
    return [inv[i]["ticker"] for i in np.argsort(-np.nan_to_num(arr, nan=-1))[:k]]
def avg_of(tks, key):
    return round(float(np.mean([next(i for i in inv if i["ticker"] == t)["scenarios"][key] for t in tks])), 1)
ext_top, core_top = topk(ext_g), topk(core)
formulas = dict(
    last_updated=TODAY, type="RESEARCH HYPOTHESIS", scenario_weights=SW,
    extreme=dict(name="FLOW EXTREME", formula="E = 0.25·Growth + 0.25·Optionality + 0.20·Momentum + 0.15·ExpectationGap + 0.15·Catalyst   (gate: BalanceSheet ≥ 5)",
                 weights=EXT, gate="Balance sheet score ≥ 5 (exclude dilution/bankruptcy risk — the main source of permanent loss in speculative names).",
                 sizing="Top 8 by score, weight ∝ score, cap 20% per name, kill rule: exit at −35% from entry or on thesis invalidation.",
                 why_weights=["Momentum has the longest documented record of any return anomaly (≈ 1927–present, many countries) — kept at 20%, not more, because momentum crashes after bear markets.",
                              "Growth and optionality drive the right tail (5–10×) that this formula exists to capture.",
                              "Expectation gap and catalysts make the upside time-bound instead of hope-based.",
                              "Valuation is deliberately excluded — it is the main thing EXTREME is willing to pay for; it reappears as a risk, not a score."],
                 top=ext_top, avg_bear=avg_of(ext_top, "bear"), avg_base=avg_of(ext_top, "base"), avg_bull=avg_of(ext_top, "bull"), avg_xbull=avg_of(ext_top, "xbull"),
                 avg_vol_score=round(float(np.mean([S["s"][[i["ticker"] for i in inv].index(t)] for t in ext_top])), 1),
                 est_maxdd="−55% to −80% (high-growth tech drawdowns: Nasdaq −78% 2000–02, −35% 2022; single names often −70%+)",
                 horizon="3–5 years", best_env="Falling rates, risk-on, a new technology cycle with expanding multiples.",
                 worst_env="Rising real rates + earnings disappointments (2000–02, 2022). Multiple compression hits high-optionality names first.",
                 failure=["Narrative outruns fundamentals; expectation gap closes the wrong way.", "Correlated holdings fall together — diversification is illusory.", "Momentum reverses sharply after a bear-market bottom (momentum crash)."],
                 robustness=stability(EXT, True), corr_momentum=spearman(ext_g, S["m"]), versions=versions_ext,
                 oos="No point-in-time stock fundamentals are available, so EXTREME has NO true out-of-sample test. Treat it as a ranking hypothesis."),
    core=dict(name="FLOW CORE", formula="C = 0.30·Quality + 0.20·BalanceSheet + 0.15·Valuation + 0.15·(10 − Volatility) + 0.10·Growth + 0.10·Momentum   × Market-trend overlay",
              weights=CORE, overlay="When the S&P 500 closes a month below its 10-month average, cut equity to 50% and hold T-bills (tested 1900–2026, walk-forward validated).",
              sizing="Top 12, equal weight, max 12% per name, max 30% per sector, rebalance quarterly.",
              why_weights=["Profitability/quality and low volatility are documented, persistent factors (Novy-Marx 2013; Frazzini–Pedersen 2014).",
                           "Balance sheet strength reduces permanent loss in recessions.",
                           "Valuation kept small (15%): our own test showed valuation timing failed out of sample at the index level; it still prevents overpaying.",
                           "The trend overlay is the one component with a real out-of-sample result in FLOW's own backtests."],
              top=core_top, avg_bear=avg_of(core_top, "bear"), avg_base=avg_of(core_top, "base"), avg_bull=avg_of(core_top, "bull"), avg_xbull=avg_of(core_top, "xbull"),
              avg_vol_score=round(float(np.mean([S["s"][[i["ticker"] for i in inv].index(t)] for t in core_top])), 1),
              est_maxdd="−20% to −35% with overlay (index-level overlay test: −19% max drawdown 1980–2026 vs −49% buy-and-hold)",
              horizon="5–10+ years", best_env="Slow grinding markets, recessions (overlay + quality), sideways valuations.",
              worst_env="Sharp V-shaped rebounds (overlay is late re-entering), speculative melt-ups where quality lags.",
              failure=["Whipsaw: overlay sells near bottoms in fast corrections (1987, 2020).", "Quality becomes crowded and expensive.", "Lags badly in junk rallies — behavioral risk of abandoning it."],
              robustness=stability(CORE), corr_momentum=spearman(core, S["m"]), versions=versions_core,
              oos="Overlay: out-of-sample 1980–2026 Sharpe 0.89 vs 0.63 buy-and-hold. Stock-ranking part: no point-in-time data, not tested."),
    corr_extreme_core=spearman(ext_g, core),
    overlap_top10=len(set(ext_top) & set(core_top)),
)

# ---------------- portfolios
EXTRA = {"VTI": dict(company="Total US market ETF", scen=(-35, 25, 50, 70), s=4), "SGOV": dict(company="0–3 month T-bill ETF (defensive)", scen=(11, 12, 12, 12), s=0)}
def scen_of(t):
    if t in EXTRA:
        return EXTRA[t]["scen"], EXTRA[t]["s"]
    i = next(i for i in inv if i["ticker"] == t)
    return tuple(i["scenarios"].values()), i["scores"]["s"]
P = [
    ("growth", "FLOW GROWTH", "Quality compounders at the center of AI, with an index core and a cash buffer.", "5+ years",
     [("GOOGL", 14, "Cheapest megacap with the most optionality (Cloud, TPU, Waymo)."), ("NVDA", 12, "Platform leader; capped because it is the consensus bet."),
      ("MSFT", 10, "Enterprise AI distribution, fortress balance sheet."), ("TSM", 10, "Picks-and-shovels for every AI chip; geopolitics limits the weight."),
      ("AMZN", 10, "Retail margin + AWS re-acceleration."), ("META", 8, "AI already monetizing through ads."), ("LLY", 8, "Non-tech growth: obesity franchise."),
      ("V", 6, "Low-volatility compounder; diversifies away from AI."), ("VTI", 12, "Index core: humility about stock picking."), ("SGOV", 10, "Dry powder and drawdown cushion.")]),
    ("asymmetric", "FLOW ASYMMETRIC", "Where the market's expectations look too low — contrarian and second-order bets.", "3–5 years",
     [("GOOGL", 14, "Largest expectation gap among megacaps."), ("TSM", 12, "Geopolitical discount on a monopoly."), ("UBER", 10, "Priced as AV loser; may be the AV aggregator."),
      ("NVO", 9, "Sentiment trough on a cash machine."), ("AMD", 9, "Second-source GPU optionality."), ("UNH", 7, "Earnings reset special situation."),
      ("VRT", 8, "Second-order AI power/cooling."), ("MELI", 8, "Long runway, underfollowed region."), ("RKLB", 5, "Small lottery-like right tail."), ("SGOV", 18, "Large cash buffer to add on drawdowns — asymmetry needs ammunition.")]),
    ("aggressive", "FLOW AGGRESSIVE", "Concentrated, high-volatility, high-optionality. Expect −50% drawdowns.", "3–5 years",
     [("NVDA", 18, "Core of the AI cycle."), ("AMD", 15, "Highest beta to AI GPU spend."), ("MU", 12, "HBM upcycle — cyclical leverage."), ("VRT", 12, "Power/cooling bottleneck."),
      ("RKLB", 10, "Space optionality."), ("MELI", 10, "Growth outside the AI trade."), ("UBER", 10, "AV optionality, cheaper valuation."), ("PLTR", 5, "Momentum leader; small because valuation is extreme."),
      ("IONQ", 3, "Pure lottery ticket — sized to lose."), ("SGOV", 5, "Minimal buffer.")]),
]
def port_metrics(alloc):
    w = np.array([a[1] for a in alloc], float) / 100
    sc = np.array([scen_of(a[0])[0] for a in alloc], float)
    vol = np.array([scen_of(a[0])[1] for a in alloc], float)
    out = dict(zip(["bear", "base", "bull", "xbull"], [round(float(x), 1) for x in w @ sc]))
    out["weighted"] = round(SW["bear"] * out["bear"] + SW["base"] * out["base"] + SW["bull"] * out["bull"] + SW["xbull"] * out["xbull"], 1)
    out["hhi"] = round(float((w ** 2).sum()), 3)
    out["risk"] = round(float(min(10, (w @ vol) * 0.8 + out["hhi"] * 10)), 1)
    return out
portfolios = dict(last_updated=TODAY, type="SIMULATION", scenario_weights=SW, horizon_note="Scenario returns are 3-year total-return midpoints.",
                  instruments=[dict(ticker=i["ticker"], company=i["company"], scen=list(i["scenarios"].values()), s=i["scores"]["s"]) for i in inv] +
                              [dict(ticker=k, company=v["company"], scen=list(v["scen"]), s=v["s"]) for k, v in EXTRA.items()],
                  models=[dict(id=pid, name=nm, thesis=th, horizon=hz, allocation=[dict(ticker=a, weight=w, why=y) for a, w, y in al], **port_metrics(al)) for pid, nm, th, hz, al in P])
for m in portfolios["models"]:
    assert sum(a["weight"] for a in m["allocation"]) == 100, m["id"]

top10 = [i["ticker"] for i in sorted(inv, key=lambda i: -i["flow_rank_score"])[:10]]
investments = dict(last_updated=TODAY, scenario_weights=SW, universe_size=len(inv), top10=top10, items=inv,
                   method="Rank = 0.30·scenario EV + 0.20·EV/|bear| + 0.15·quality + 0.15·expectation gap + 0.10·catalyst + 0.10·balance sheet (all scaled 0–10). Not ranked by recent performance.")
for name, obj in [("investments.json", investments), ("flow_formulas.json", formulas), ("portfolio_models.json", portfolios)]:
    json.dump(obj, open(os.path.join(OUT, name), "w"), indent=1)
print("top10", top10)
print("ext", ext_top, formulas["extreme"]["robustness"], formulas["extreme"]["corr_momentum"])
print("core", core_top, formulas["core"]["robustness"], formulas["core"]["corr_momentum"], "corrEC", formulas["corr_extreme_core"], formulas["overlap_top10"])
for v in versions_ext + versions_core: print(v["name"], v["top5"], v["stability"], v["corr_momentum"])
for m in portfolios["models"]: print(m["id"], {k: m[k] for k in ["bear", "base", "bull", "xbull", "weighted", "hhi", "risk"]})
