import series from "@/data/sp500_series.json";

export type Params = {
  ma: number; mom: number; volLook: number; volCap: number; entry: number; exit: number;
  rebalance: 1 | 3 | 12; maxAlloc: number; weighting: "binary" | "vol" | "momentum"; from: number; to: number;
};
export const DEFAULTS: Params = { ma: 10, mom: 12, volLook: 12, volCap: 0, entry: -0.2, exit: -0.3, rebalance: 1, maxAlloc: 1, weighting: "binary", from: 1900, to: 2026 };

const D = series.dates as string[];
const P = series.px as number[];
const DY = series.dy as number[];
const C = series.cash as number[];
const N = P.length;
const TR = P.map((p, i) => (i === 0 ? 0 : p / P[i - 1] - 1 + DY[i] / 12));
const YEAR = D.map((d) => +d.slice(0, 4));
const COST = 0.001;

export type Result = {
  curve: { d: string; s: number; b: number; dd: number }[];
  total: number; cagr: number; vol: number; maxdd: number; sharpe: number; sortino: number;
  trades: number; win: number; avgWin: number; avgLoss: number; pf: number | null; exposure: number;
  bh: { cagr: number; vol: number; maxdd: number; sharpe: number; total: number };
};

function metrics(r: number[], cash: number[]) {
  const n = r.length;
  let eq = 1, peak = 1, maxdd = 0;
  for (const x of r) { eq *= 1 + x; peak = Math.max(peak, eq); maxdd = Math.min(maxdd, eq / peak - 1); }
  const mean = r.reduce((a, b) => a + b, 0) / n;
  const vol = Math.sqrt(r.reduce((a, b) => a + (b - mean) ** 2, 0) / n) * Math.sqrt(12);
  const ex = r.map((x, i) => x - cash[i]);
  const em = ex.reduce((a, b) => a + b, 0) / n;
  const es = Math.sqrt(ex.reduce((a, b) => a + (b - em) ** 2, 0) / n);
  const dn = ex.filter((x) => x < 0);
  const dd = Math.sqrt(dn.reduce((a, b) => a + b * b, 0) / Math.max(1, ex.length));
  return { total: eq - 1, cagr: eq ** (12 / n) - 1, vol, maxdd, sharpe: es > 0 ? (em / es) * Math.sqrt(12) : 0, sortino: dd > 0 ? (em / dd) * Math.sqrt(12) : 0 };
}

export function run(p: Params, withCurve = true): Result {
  // indicators, causal only
  const sma: number[] = new Array(N).fill(NaN);
  let s = 0;
  for (let i = 0; i < N; i++) { s += P[i]; if (i >= p.ma) s -= P[i - p.ma]; if (i >= p.ma - 1) sma[i] = s / p.ma; }
  const mom = P.map((x, i) => (i >= p.mom ? x / P[i - p.mom] - 1 : NaN));
  const rv = TR.map((_, i) => {
    if (i < p.volLook) return NaN;
    const w = TR.slice(i - p.volLook + 1, i + 1); const m = w.reduce((a, b) => a + b, 0) / w.length;
    return Math.sqrt(w.reduce((a, b) => a + (b - m) ** 2, 0) / w.length) * Math.sqrt(12);
  });
  // decide weight at close of month i -> applied in i+1
  const entry = p.entry <= -0.2 ? -Infinity : p.entry, exit = p.exit <= -0.3 ? -Infinity : p.exit;
  const target: number[] = new Array(N).fill(0);
  let inMkt = false, w = 0;
  for (let i = 0; i < N; i++) {
    const trendOk = p.ma <= 1 || P[i] > sma[i];
    const m = mom[i];
    if (!inMkt && trendOk && (entry === -Infinity || (!isNaN(m) && m > entry))) inMkt = true;
    else if (inMkt && (!trendOk || (!isNaN(m) && m < exit))) inMkt = false;
    const volBad = p.volCap > 0 && rv[i] > p.volCap;
    let tw = 0;
    if (inMkt && !volBad) {
      if (p.weighting === "binary") tw = p.maxAlloc;
      else if (p.weighting === "vol") tw = Math.min(p.maxAlloc, 0.15 / Math.max(0.03, rv[i] || 0.15));
      else tw = p.maxAlloc * Math.max(0.25, Math.min(1, (m || 0) / 0.15));
    }
    if (i % p.rebalance === 0 || tw === 0) w = tw; // exits are never delayed; entries/resizes wait for rebalance
    target[i] = w;
  }
  const idx: number[] = [];
  for (let i = 1; i < N; i++) if (YEAR[i] >= p.from && YEAR[i] <= p.to) idx.push(i);
  const r: number[] = [], b: number[] = [], cash: number[] = [];
  let trades = 0, tradeEq = 1, holding = false, expo = 0;
  const tradeRets: number[] = [];
  for (const i of idx) {
    const wt = target[i - 1], prev = target[i - 2] ?? 0;
    const ret = wt * TR[i] + (1 - wt) * C[i] - Math.abs(wt - prev) * COST;
    r.push(ret); b.push(TR[i]); cash.push(C[i]); expo += wt;
    if (wt > 0 && !holding) { holding = true; trades++; tradeEq = 1; }
    if (holding) tradeEq *= 1 + wt * TR[i] - Math.abs(wt - prev) * COST;
    if (holding && (target[i] === 0 || i === idx[idx.length - 1])) { tradeRets.push(tradeEq - 1); holding = false; }
  }
  const m = metrics(r, cash), mb = metrics(b, cash);
  const wins = tradeRets.filter((x) => x > 0), losses = tradeRets.filter((x) => x <= 0);
  const sw = wins.reduce((a, c) => a + c, 0), sl = -losses.reduce((a, c) => a + c, 0);
  const curve: Result["curve"] = [];
  if (withCurve) {
    let es = 1, eb = 1, pk = 1;
    const step = idx.length > 600 ? 3 : 1;
    idx.forEach((i, k) => {
      es *= 1 + r[k]; eb *= 1 + b[k]; pk = Math.max(pk, es);
      if (k % step === 0 || k === idx.length - 1) curve.push({ d: D[i], s: +es.toFixed(4), b: +eb.toFixed(4), dd: +((es / pk - 1) * 100).toFixed(1) });
    });
  }
  return {
    curve, ...m, trades, win: tradeRets.length ? wins.length / tradeRets.length : 0,
    avgWin: wins.length ? sw / wins.length : 0, avgLoss: losses.length ? -sl / losses.length : 0,
    pf: sl > 0 ? sw / sl : null, exposure: expo / idx.length, bh: mb,
  };
}

/* ---------- Strategy discovery: hypothesis → rules → backtest → OOS → stress → red team → verdict ---------- */
export type Discovery = { id: string; at: string; hypothesis: string; params: Partial<Params>; train: number; test: number; bhTest: number; neighbors: number; trades: number; checks: { name: string; pass: boolean; detail: string }[]; verdict: "ACCEPTED" | "REJECTED" };

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
export function discover(): Discovery {
  const kind = pick(["trend", "momentum", "trend+vol", "momentum+band", "vol-weighted trend"]);
  const p: Params = { ...DEFAULTS };
  let hyp = "";
  if (kind === "trend") { p.ma = pick([4, 6, 8, 12, 16, 20]); p.mom = 1; p.entry = -1; p.exit = -1; hyp = `Market above its ${p.ma}-month average signals a persistent uptrend.`; }
  if (kind === "momentum") { p.ma = 1; p.mom = pick([3, 6, 9, 12, 18]); p.entry = pick([0, 0.03, 0.05]); p.exit = p.entry; hyp = `A trailing ${p.mom}-month return above ${(p.entry * 100).toFixed(0)}% predicts the next month.`; }
  if (kind === "trend+vol") { p.ma = pick([6, 10, 14]); p.mom = 1; p.entry = -1; p.exit = -1; p.volCap = pick([0.15, 0.2, 0.25]); hyp = `Trend (${p.ma}m SMA) only pays when realized volatility is below ${(p.volCap * 100).toFixed(0)}%.`; }
  if (kind === "momentum+band") { p.ma = 1; p.mom = pick([6, 12]); p.entry = pick([0.02, 0.05, 0.08]); p.exit = -pick([0, 0.02, 0.05]); hyp = `Hysteresis: enter above +${(p.entry * 100).toFixed(0)}% ${p.mom}m momentum, exit below ${(p.exit * 100).toFixed(0)}% — fewer whipsaws.`; }
  if (kind === "vol-weighted trend") { p.ma = pick([8, 10, 12]); p.mom = 1; p.entry = -1; p.exit = -1; p.weighting = "vol"; hyp = `Trend with volatility-scaled exposure (${p.ma}m SMA, 15% vol target).`; }
  const tr = run({ ...p, from: 1900, to: 1979 }, false), te = run({ ...p, from: 1980, to: 2026 }, false);
  const nb = (k: "ma" | "mom", d: number) => run({ ...p, [k]: Math.max(1, p[k] + d), from: 1980, to: 2026 }, false).sharpe;
  const key = p.ma > 1 ? "ma" : "mom";
  const neigh = [nb(key, -2), nb(key, 2)];
  const spread = Math.max(...neigh.map((x) => Math.abs(x - te.sharpe)));
  const checks = [
    { name: "Beats buy-and-hold out-of-sample", pass: te.sharpe >= te.bh.sharpe, detail: `Test Sharpe ${te.sharpe.toFixed(2)} vs ${te.bh.sharpe.toFixed(2)}` },
    { name: "Holds up from train to test", pass: te.sharpe >= tr.sharpe * 0.7, detail: `Train ${tr.sharpe.toFixed(2)} → test ${te.sharpe.toFixed(2)}` },
    { name: "Insensitive to parameter ±2", pass: spread <= 0.15, detail: `Neighbors differ by up to ${spread.toFixed(2)} Sharpe` },
    { name: "Enough trades to judge", pass: tr.trades + te.trades >= 10, detail: `${tr.trades + te.trades} trades` },
    { name: "Drawdown better than buy-and-hold", pass: te.maxdd > te.bh.maxdd, detail: `${(te.maxdd * 100).toFixed(0)}% vs ${(te.bh.maxdd * 100).toFixed(0)}%` },
  ];
  return {
    id: Math.random().toString(36).slice(2, 8), at: new Date().toISOString().slice(0, 16).replace("T", " "), hypothesis: hyp,
    params: { ma: p.ma, mom: p.mom, entry: p.entry, exit: p.exit, volCap: p.volCap, weighting: p.weighting },
    train: tr.sharpe, test: te.sharpe, bhTest: te.bh.sharpe, neighbors: spread, trades: tr.trades + te.trades, checks,
    verdict: checks.every((c) => c.pass) ? "ACCEPTED" : "REJECTED",
  };
}
