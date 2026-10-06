"""FLOW research engine.

Reads cached raw data in research/raw (real public datasets, see research_sources.json),
runs every backtest locally, and writes structured JSON to /data.
Run: python3 research/engine.py   (requires numpy)
"""
import csv, json, math, os, datetime as dt
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "research", "raw")
OUT = os.path.join(ROOT, "data")
TODAY = "2026-10-06"
COST = 0.001  # 10 bps per switch (monthly index tests)


def rd(name):
    with open(os.path.join(RAW, name)) as f:
        return list(csv.DictReader(f))


def r(x, n=4):
    return None if x is None or (isinstance(x, float) and not math.isfinite(x)) else round(float(x), n)


# ---------------------------------------------------------------- monthly S&P
sp = rd("sp500_monthly.csv")
y10 = {row["Date"][:7]: float(row["Rate"] if "Rate" in row else list(row.values())[1]) for row in rd("us10y_monthly.csv")}
dates, px, div, eps, rate, cape = [], [], [], [], [], []
seen = set()
for row in sp:
    d = row["Date"][:7]
    if d in seen:
        continue
    seen.add(d)
    dates.append(d)
    px.append(float(row["SP500"]))
    div.append(float(row["Dividend"]) or np.nan)
    eps.append(float(row["Earnings"]) or np.nan)
    lr = float(row["Long Interest Rate"]) or y10.get(d, np.nan)
    rate.append(lr)
    cape.append(float(row["PE10"]) or np.nan)
px, div, eps, rate, cape = map(np.array, (px, div, eps, rate, cape))
# forward-fill rate; dividend yield after data ends uses last known yield (assumption, flagged)
for a in (rate,):
    for i in range(1, len(a)):
        if not np.isfinite(a[i]):
            a[i] = a[i - 1]
dy = div / px
last_dy = dy[np.isfinite(dy)][-1]
dy = np.where(np.isfinite(dy), dy, last_dy)
N = len(px)
pr = np.r_[np.nan, px[1:] / px[:-1] - 1]
tr = pr + dy / 12  # total return approx
cash = np.r_[np.nan, np.maximum(rate[:-1] - 1.0, 0.0) / 100 / 12]  # T-bill proxy: 10Y minus 1pt, floored at 0 (assumption)
years = np.array([int(d[:4]) for d in dates])


def stats(ret, expo=None, start=None, end=None):
    m = np.isfinite(ret)
    if start is not None:
        m &= years >= start
    if end is not None:
        m &= years <= end
    x = ret[m]
    if len(x) < 12:
        return None
    eq = np.cumprod(1 + x)
    yrs = len(x) / 12
    cagr = eq[-1] ** (1 / yrs) - 1
    vol = x.std() * math.sqrt(12)
    dd = (eq / np.maximum.accumulate(eq) - 1).min()
    c = cash[m]
    ex = x - np.nan_to_num(c)
    sharpe = ex.mean() / ex.std() * math.sqrt(12) if ex.std() > 0 else 0
    dn = ex[ex < 0]
    sortino = ex.mean() / math.sqrt((dn ** 2).mean()) * math.sqrt(12) if len(dn) else 0
    o = dict(cagr=r(cagr), vol=r(vol), maxdd=r(dd), sharpe=r(sharpe, 2), sortino=r(sortino, 2), months=int(len(x)))
    if expo is not None:
        o["exposure"] = r(np.nanmean(expo[m]), 3)
    return o


def run_signal(sig):
    """sig[t] = weight held during month t+1 (decided at close of t). No look-ahead."""
    w = np.r_[np.nan, sig[:-1]]
    w = np.nan_to_num(w)
    turn = np.abs(np.r_[0, np.diff(w)])
    ret = w * tr + (1 - w) * np.nan_to_num(cash) - turn * COST
    ret[: 1] = np.nan
    return ret, w


def sma(a, n):
    o = np.full(len(a), np.nan)
    c = np.cumsum(np.r_[0, a])
    o[n - 1:] = (c[n:] - c[:-n]) / n
    return o


def mom(a, n):
    o = np.full(len(a), np.nan)
    o[n:] = a[n:] / a[:-n] - 1
    return o


def rvol(ret, n):
    o = np.full(len(ret), np.nan)
    for i in range(n, len(ret)):
        o[i] = np.nanstd(ret[i - n + 1: i + 1]) * math.sqrt(12)
    return o


START, SPLIT, END = 1900, 1980, 2026
bh_ret = tr.copy()
vol12 = rvol(tr, 12)

experiments = []


def experiment(eid, name, family, hypothesis, rules, sig_fn, params_grid=None, chosen=None):
    sig = sig_fn(chosen) if chosen is not None else sig_fn(None)
    ret, w = run_signal(np.nan_to_num(sig))
    e = dict(id=eid, name=name, family=family, hypothesis=hypothesis, rules=rules,
             type="BACKTEST", asset="S&P 500 (monthly, total return approx.)",
             full=stats(ret, w, START, END), train=stats(ret, w, START, SPLIT - 1), test=stats(ret, w, SPLIT, END),
             bh_full=stats(bh_ret, None, START, END), bh_train=stats(bh_ret, None, START, SPLIT - 1), bh_test=stats(bh_ret, None, SPLIT, END))
    if params_grid:
        sens = []
        for p in params_grid:
            rr, ww = run_signal(np.nan_to_num(sig_fn(p)))
            s_tr, s_te = stats(rr, ww, START, SPLIT - 1), stats(rr, ww, SPLIT, END)
            sens.append(dict(p=p, train_sharpe=s_tr["sharpe"], test_sharpe=s_te["sharpe"], test_maxdd=s_te["maxdd"], test_cagr=s_te["cagr"]))
        e["sensitivity"] = sens
        ts = [s["test_sharpe"] for s in sens]
        e["robust_share"] = r(np.mean(np.array(ts) >= e["bh_test"]["sharpe"]), 2)
    return e, ret


# 1 Trend: price above N-month SMA
sma_fn = lambda n: (px > sma(px, n or 10)).astype(float)
e1, ret_trend = experiment("trend_sma", "Trend following (10-month SMA)", "Trend following",
                           "Bear markets tend to start below a slow moving average; stepping aside cuts the deepest drawdowns.",
                           ["Hold S&P 500 when month-end price > 10-month SMA", "Otherwise hold cash (T-bill proxy)", "10 bps cost per switch"],
                           sma_fn, [3, 5, 6, 8, 10, 12, 15, 18, 24], 10)
# 2 Time-series momentum 12-month
tsm_fn = lambda n: (mom(px, n or 12) + dy * (n or 12) / 12 > np.nan_to_num(cash) * (n or 12)).astype(float)
e2, ret_tsm = experiment("tsmom", "Time-series momentum (12-month)", "Momentum",
                         "Trailing 12-month excess return persists for months (under-reaction, slow capital flows).",
                         ["Hold equities when trailing 12m total return > cash return", "Otherwise cash"], tsm_fn, [3, 6, 9, 12, 15, 18, 24], 12)
# 3 Mean reversion: buy after large monthly drop
def mr_fn(th):
    th = th or -0.05
    s = np.zeros(N)
    for i in range(N):
        if pr[i] <= th:
            s[i:i + 3] = 1
    return s
e3, ret_mr = experiment("mean_rev", "Mean reversion (buy after -5% month, hold 3)", "Mean reversion",
                        "Sharp monthly declines overshoot and partially reverse.",
                        ["After a month with price return <= -5%, hold equities 3 months", "Otherwise cash"], mr_fn, [-0.03, -0.04, -0.05, -0.07, -0.10], -0.05)
# 4 Volatility-filtered trend
def vf_fn(v):
    v = v or 0.20
    return ((px > sma(px, 10)) | (np.nan_to_num(vol12, nan=1) < v)).astype(float)
e4, ret_vf = experiment("trend_vol", "Trend + calm-volatility override", "Volatility-adjusted",
                        "Whipsaws happen when vol is low; stay invested in calm markets even below trend.",
                        ["Invested if price > 10m SMA OR 12m realized vol < 20%", "Otherwise cash"], vf_fn, [0.10, 0.12, 0.15, 0.18, 0.20, 0.25], 0.15)
# 5 Vol-targeting (continuous weight)
def vt_fn(t):
    t = t or 0.15
    return np.clip(t / np.nan_to_num(vol12, nan=0.15), 0, 1)
e5, ret_vt = experiment("vol_target", "Volatility targeting (15%)", "Volatility-adjusted",
                        "Risk clusters; scaling exposure down when realized vol is high improves risk-adjusted return.",
                        ["Weight = min(1, 15% / trailing 12m realized vol)", "Remainder in cash", "Monthly rebalance"], vt_fn, [0.08, 0.10, 0.12, 0.15, 0.18, 0.22], 0.15)
# 6 Value timing: CAPE below its 20y median
cape_ff = cape.copy()
for i in range(1, N):
    if not np.isfinite(cape_ff[i]):
        cape_ff[i] = cape_ff[i - 1]
med_cache = {}
def cape_med(k):
    if k not in med_cache:
        med_cache[k] = np.array([np.nanmedian(cape_ff[max(0, i - k): i + 1]) if i > 24 and np.isfinite(cape_ff[max(0, i - k): i + 1]).any() else np.inf for i in range(N)])
    return med_cache[k]
def val_fn(k):
    k = k or 240
    return (cape_ff <= cape_med(k) * 1.2).astype(float)
e6, ret_val = experiment("value_timing", "Valuation timing (CAPE vs. 20y median)", "Value",
                         "Expensive markets deliver lower forward returns, so step out when CAPE is far above its own history.",
                         ["Invested when CAPE <= 1.2x its trailing 20-year median", "Otherwise cash", "CAPE frozen after 2023-09 (data gap)"], val_fn, [120, 180, 240, 360], 240)
# 7 Value + momentum
e7, ret_vm = experiment("value_mom", "Value + trend (either signal)", "Multi-factor",
                        "Combine a slow valuation signal with trend so neither alone forces you out.",
                        ["Invested if price > 10m SMA OR CAPE <= its 20y median", "Otherwise cash"],
                        lambda _: ((px > sma(px, 10)) | (cape_ff <= cape_med(240))).astype(float))
# 8 Relative strength: equities vs gold
gold = {row["Date"][:7]: float(row["Price"]) for row in rd("gold_monthly.csv")}
g = np.array([gold.get(d, np.nan) for d in dates])
for i in range(1, N):
    if not np.isfinite(g[i]):
        g[i] = g[i - 1]
gr = np.r_[np.nan, g[1:] / g[:-1] - 1]
def rs_ret(n=6):
    ms, mg = mom(px, n), mom(g, n)
    pick = np.r_[np.nan, (ms > mg).astype(float)[:-1]]
    ret = np.where(pick == 1, tr, gr)
    sw = np.abs(np.r_[0, np.diff(np.nan_to_num(pick))])
    ret = ret - sw * COST
    ret[:n + 1] = np.nan
    return ret
rs = rs_ret(6)
e8 = dict(id="rel_strength", name="Relative strength: stocks vs. gold (6-month)", family="Relative strength", type="BACKTEST",
          asset="S&P 500 vs. gold (monthly)", hypothesis="Capital rotates toward the asset with stronger recent performance.",
          rules=["Each month hold whichever of S&P 500 / gold had the higher 6-month return"],
          full=stats(rs, None, 1971, END), train=stats(rs, None, 1971, 1999), test=stats(rs, None, 2000, END),
          bh_full=stats(bh_ret, None, 1971, END), bh_train=stats(bh_ret, None, 1971, 1999), bh_test=stats(bh_ret, None, 2000, END),
          note="Gold was fixed before 1971; tested 1971+ only (train 1971-1999, test 2000-2026).")
sens = []
for n in [1, 3, 6, 9, 12]:
    x = rs_ret(n)
    sens.append(dict(p=n, train_sharpe=stats(x, None, 1971, 1999)["sharpe"], test_sharpe=stats(x, None, 2000, END)["sharpe"],
                     test_maxdd=stats(x, None, 2000, END)["maxdd"], test_cagr=stats(x, None, 2000, END)["cagr"]))
e8["sensitivity"] = sens
e8["robust_share"] = r(np.mean(np.array([s["test_sharpe"] for s in sens]) >= e8["bh_test"]["sharpe"]), 2)

# Walk-forward SMA: each decade pick best SMA length on all prior data, apply next decade
wf = np.full(N, np.nan)
wf_log = []
grid = [3, 5, 6, 8, 10, 12, 15, 18, 24]
rets_grid = {n: run_signal(sma_fn(n))[0] for n in grid}
for dec in range(1920, 2030, 10):
    best = max(grid, key=lambda n: stats(rets_grid[n], None, 1880, dec - 1)["sharpe"])
    m = (years >= dec) & (years < dec + 10)
    wf[m] = rets_grid[best][m]
    wf_log.append(dict(decade=dec, chosen_sma=best))
walk_forward = dict(method="Each decade, choose the SMA length with best Sharpe on ALL prior data, then trade it untouched for the next 10 years.",
                    log=wf_log, result=stats(wf, None, 1920, END), bh=stats(bh_ret, None, 1920, END), fixed10=stats(ret_trend, None, 1920, END))

# Regime table: performance by decade
regimes = []
for dec in range(1900, 2030, 10):
    a, b = stats(bh_ret, None, dec, dec + 9), stats(ret_trend, None, dec, dec + 9)
    if a and b:
        regimes.append(dict(decade=f"{dec}s", bh_cagr=a["cagr"], bh_maxdd=a["maxdd"], trend_cagr=b["cagr"], trend_maxdd=b["maxdd"]))

# Overfitting demo: best-of-many random strategies in-sample, then out-of-sample
rng = np.random.default_rng(7)
ins, oos = [], []
cal = np.array([int(d[5:7]) for d in dates])
for k in range(300):
    months = rng.choice(np.arange(1, 13), size=6, replace=False)  # random "seasonal" rule: hold in 6 random calendar months
    sig = np.isin((cal % 12) + 1, months).astype(float)
    rr, _ = run_signal(sig)
    ins.append(stats(rr, None, START, SPLIT - 1)["sharpe"])
    oos.append(stats(rr, None, SPLIT, END)["sharpe"])
ins, oos = np.array(ins), np.array(oos)
top = np.argsort(ins)[-10:]
overfit = dict(n_random=300, best10_train_sharpe=r(ins[top].mean(), 2), best10_test_sharpe=r(oos[top].mean(), 2),
               all_test_sharpe=r(oos.mean(), 2), corr_train_test=r(np.corrcoef(ins, oos)[0, 1], 2),
               lesson="300 random seasonal rules (hold in 6 random calendar months). The 10 best in training look skilled; out-of-sample they fall back toward the average. Selection, not skill.")

# ---------------------------------------------------------------- FLOW DIVERGENCE framework test
eg = mom(np.where(np.isfinite(eps), eps, np.nan), 12)
ddp = px / np.maximum.accumulate(px) - 1
trend_up = px > sma(px, 10)
def div_sig(th=-0.10):
    s = np.where(trend_up, 1.0, 0.0)
    s = np.where((ddp <= th) & (eg > 0), 1.0, s)  # stressed price, healthy fundamentals: stay/buy
    s = np.where((~trend_up) & (eg < 0), 0.0, s)  # broken price AND deteriorating fundamentals: out
    return s
ey = np.where(np.isfinite(eps), eps, np.nan) / px * 100
for i in range(1, N):
    if not np.isfinite(ey[i]):
        ey[i] = ey[i - 1]
erp = ey - rate
erp_med = np.array([np.nanmedian(erp[max(0, i - 240): i + 1]) for i in range(N)])
def div2_sig(th=-0.10):
    s = np.where(trend_up, 1.0, 0.0)
    s = np.where((ddp <= th) & (erp > erp_med), 1.0, s)  # stress while compensation for risk is above its norm: hold
    return s
ret_div, w_div = run_signal(div_sig())
EPS_END = 2023
fw_tests = dict(
    full=stats(ret_div, w_div, START, EPS_END), train=stats(ret_div, w_div, START, SPLIT - 1), test=stats(ret_div, w_div, SPLIT, EPS_END),
    trend_full=stats(ret_trend, None, START, EPS_END), trend_train=stats(ret_trend, None, START, SPLIT - 1), trend_test=stats(ret_trend, None, SPLIT, EPS_END),
    bh_full=stats(bh_ret, None, START, EPS_END), bh_train=stats(bh_ret, None, START, SPLIT - 1), bh_test=stats(bh_ret, None, SPLIT, EPS_END),
    sensitivity=[dict(p=t, test_sharpe=stats(run_signal(div_sig(t))[0], None, SPLIT, EPS_END)["sharpe"],
                      train_sharpe=stats(run_signal(div_sig(t))[0], None, START, SPLIT - 1)["sharpe"]) for t in [-0.05, -0.10, -0.15, -0.20, -0.30]],
    v2=dict(train=stats(run_signal(div2_sig())[0], None, START, SPLIT - 1), test=stats(run_signal(div2_sig())[0], None, SPLIT, EPS_END),
            sensitivity=[dict(p=t, train_sharpe=stats(run_signal(div2_sig(t))[0], None, START, SPLIT - 1)["sharpe"], test_sharpe=stats(run_signal(div2_sig(t))[0], None, SPLIT, EPS_END)["sharpe"]) for t in [-0.05, -0.10, -0.15, -0.20, -0.30]]),
    corr_with_trend=r(np.corrcoef(np.nan_to_num(ret_div[years >= START]), np.nan_to_num(ret_trend[years >= START]))[0, 1], 3),
    signal_overlap_with_trend=r(np.mean(div_sig()[years >= START] == trend_up[years >= START].astype(float)), 3),
)
# forward 12m return conditioned on divergence states (the core empirical claim)
fwd12 = np.full(N, np.nan)
fwd12[:-12] = px[12:] / px[:-12] - 1
states = {
    "Stress + healthy earnings (drawdown <= -10%, EPS growth > 0)": (ddp <= -0.10) & (eg > 0),
    "Stress + falling earnings (drawdown <= -10%, EPS growth < 0)": (ddp <= -0.10) & (eg < 0),
    "Calm + healthy earnings": (ddp > -0.10) & (eg > 0),
    "Calm + falling earnings": (ddp > -0.10) & (eg < 0),
}
cond = []
for k, m in states.items():
    for lbl, (a, b) in {"train": (START, SPLIT - 1), "test": (SPLIT, EPS_END - 1)}.items():
        mm = m & (years >= a) & (years <= b) & np.isfinite(fwd12)
        cond.append(dict(state=k, period=lbl, months=int(mm.sum()), avg_fwd12=r(np.mean(fwd12[mm]) if mm.sum() else np.nan),
                         hit=r(np.mean(fwd12[mm] > 0) if mm.sum() else np.nan, 3)))
fw_tests["conditional_forward_returns"] = cond

# ---------------------------------------------------------------- daily swing tests on WTI
wti = [(row["Date"], float(row["Price"])) for row in rd("wti_daily.csv") if row["Price"] not in ("", ".")]
wd = [a for a, _ in wti]
wp = np.array([b for _, b in wti])
wy = np.array([int(a[:4]) for a in wd])
vixd = {row["DATE"]: float(row["CLOSE"]) for row in rd("vix_daily.csv")}
wv = np.array([vixd.get(d, np.nan) for d in wd])
for i in range(1, len(wv)):
    if not np.isfinite(wv[i]):
        wv[i] = wv[i - 1]
# negative price day (2020-04-20) breaks % returns: clip to small positive for return math
wpc = np.maximum(wp, 1.0)
SW_COST = 0.0005


def dsma(a, n):
    return sma(a, n)


def rsi(a, n=2):
    d = np.diff(a, prepend=a[0])
    up, dn = np.maximum(d, 0), np.maximum(-d, 0)
    o = np.full(len(a), np.nan)
    au, ad = up[1:n + 1].mean(), dn[1:n + 1].mean()
    for i in range(n + 1, len(a)):
        au = (au * (n - 1) + up[i]) / n
        ad = (ad * (n - 1) + dn[i]) / n
        o[i] = 100 if ad == 0 else 100 - 100 / (1 + au / ad)
    return o


def trade_sim(entry, exit_fn, stop=None, max_hold=None):
    """Long-only, enter next close after signal. Returns trades list of (entry_i, exit_i, ret)."""
    trades, i, n = [], 0, len(wpc)
    while i < n - 1:
        if entry[i] and wp[i] > 10 and wp[i + 1] > 10 and not ("2020-04" <= wd[i] <= "2020-05-15"):  # skip the 2020 negative-price anomaly
            ei, ep = i + 1, wpc[i + 1]
            j = ei
            while j < n - 1:
                j += 1
                rr = wpc[j] / ep - 1
                if stop is not None and rr <= -stop:
                    break
                if max_hold and j - ei >= max_hold:
                    break
                if exit_fn(j, ei):
                    break
            trades.append((ei, j, wpc[j] / ep - 1 - 2 * SW_COST))
            i = j
        else:
            i += 1
    return trades


def trade_stats(trades, a=None, b=None):
    t = [x for x in trades if (a is None or wy[x[0]] >= a) and (b is None or wy[x[0]] <= b)]
    if not t:
        return None
    rr = np.array([x[2] for x in t])
    wins, losses = rr[rr > 0], rr[rr <= 0]
    eq = np.cumprod(1 + rr)
    days_in = sum(x[1] - x[0] for x in t)
    span = (t[-1][1] - t[0][0]) or 1
    pf = wins.sum() / -losses.sum() if len(losses) and losses.sum() < 0 else None
    return dict(trades=len(t), win_rate=r(len(wins) / len(rr), 3), avg_win=r(wins.mean() if len(wins) else 0),
                avg_loss=r(losses.mean() if len(losses) else 0), profit_factor=r(pf, 2), total=r(eq[-1] - 1, 3),
                maxdd=r((eq / np.maximum.accumulate(eq) - 1).min(), 3), avg_hold=r(days_in / len(t), 1),
                payoff=r((wins.mean() / -losses.mean()) if len(wins) and len(losses) else None, 2),
                expectancy=r(rr.mean()), exposure=r(days_in / span, 3))


s50, s200, s20 = dsma(wpc, 50), dsma(wpc, 200), dsma(wpc, 20)
r2 = rsi(wpc, 2)
hi20 = np.array([wpc[max(0, i - 20):i].max() if i > 20 else np.inf for i in range(len(wpc))])
lo10 = np.array([wpc[max(0, i - 10):i].min() if i > 10 else -np.inf for i in range(len(wpc))])
roc60 = np.r_[np.full(60, np.nan), wpc[60:] / wpc[:-60] - 1]
atr_pct = np.r_[np.nan, np.abs(np.diff(np.log(wpc)))]
vol20 = np.array([np.nanstd(atr_pct[max(1, i - 19): i + 1]) * math.sqrt(252) if i > 21 else np.nan for i in range(len(wpc))])
swing_defs = [
    ("trend", "Trend-following", "Ride sustained moves: own it while the fast average is above the slow one.",
     ["Enter when 50-day SMA crosses above 200-day SMA", "Exit when 50-day crosses back below", "No stop beyond the cross"],
     (s50 > s200) & (np.r_[False, (s50 <= s200)[:-1]]), lambda j, ei: s50[j] < s200[j], None, None),
    ("breakout", "Breakout (20-day high)", "New highs attract buyers and trigger stops of shorts.",
     ["Enter on close above prior 20-day high", "Exit on close below prior 10-day low", "8% hard stop"],
     wpc > hi20, lambda j, ei: wpc[j] < lo10[j], 0.08, None),
    ("pullback", "Pullback in uptrend (RSI-2)", "Short-term dips inside a long-term uptrend tend to bounce.",
     ["Uptrend: price > 200-day SMA", "Enter when 2-day RSI < 10", "Exit when close > 5-day SMA or after 10 days", "8% stop"],
     (wpc > s200) & (r2 < 10), lambda j, ei: wpc[j] > dsma(wpc, 5)[j], 0.08, 10),
    ("momentum", "Momentum (60-day rate of change)", "Strong 3-month performance tends to persist briefly.",
     ["Enter when 60-day return > 10% and price > 50-day SMA", "Exit when price < 50-day SMA", "10% stop"],
     (roc60 > 0.10) & (wpc > s50), lambda j, ei: wpc[j] < s50[j], 0.10, None),
    ("meanrev", "Pure mean reversion (no trend filter)", "Oversold bounces happen regardless of trend.",
     ["Enter when 2-day RSI < 5", "Exit when close > 5-day SMA or after 10 days", "8% stop"],
     r2 < 5, lambda j, ei: wpc[j] > dsma(wpc, 5)[j], 0.08, 10),
    ("multifactor", "Multi-factor swing (trend + pullback + calm VIX)", "Only buy dips when trend is up AND market-wide fear is not elevated.",
     ["Price > 200-day SMA", "2-day RSI < 15", "VIX < 25", "Exit > 5-day SMA or 10 days", "8% stop"],
     (wpc > s200) & (r2 < 15) & (wv < 25), lambda j, ei: wpc[j] > dsma(wpc, 5)[j], 0.08, 10),
]
swing = []
bh_w = dict(total=r(wpc[-1] / wpc[0] - 1, 3))
for sid, name, why, rules, entry, ex, stop, mh in swing_defs:
    t = trade_sim(np.nan_to_num(entry).astype(bool), ex, stop, mh)
    swing.append(dict(id=sid, name=name, why=why, rules=rules, type="BACKTEST", asset="WTI crude oil (daily close, 1986-2026)",
                      full=trade_stats(t), train=trade_stats(t, 1986, 2005), test=trade_stats(t, 2006, 2026)))

# ---------------------------------------------------------------- market snapshot (CURRENT where available)
vix_rows = rd("vix_daily.csv")
vix_last = float(vix_rows[-1]["CLOSE"])
vix_all = np.array([float(x["CLOSE"]) for x in vix_rows])
cpi = rd("cpi_monthly.csv")
cpi_last = cpi[-1]
cpi_yoy = float(cpi[-1]["Index"]) / float(cpi[-13]["Index"]) - 1
y10_rows = rd("us10y_monthly.csv")
k10 = list(y10_rows[0].keys())[1]
market = dict(
    last_updated=TODAY,
    items=[
        dict(id="spx", label="S&P 500 (monthly avg.)", value=r(px[-1], 2), as_of=dates[-1], change_12m=r(px[-1] / px[-13] - 1),
             change_3m=r(px[-1] / px[-4] - 1), from_high=r(ddp[-1]), above_10m_sma=bool(px[-1] > sma(px, 10)[-1]), type="CURRENT DATA", source="shiller_sp500"),
        dict(id="vix", label="VIX", value=vix_last, as_of=vix_rows[-1]["DATE"], percentile=r((vix_all < vix_last).mean(), 3), median=r(np.median(vix_all), 2), type="CURRENT DATA", source="cboe_vix"),
        dict(id="us10y", label="US 10-year yield", value=float(y10_rows[-1][k10]), as_of=y10_rows[-1]["Date"][:7],
             change_12m=r(float(y10_rows[-1][k10]) - float(y10_rows[-13][k10]), 2), type="CURRENT DATA", source="fred_10y"),
        dict(id="cpi", label="CPI inflation (YoY)", value=r(cpi_yoy), as_of=cpi_last["Date"][:7], type="CURRENT DATA", source="bls_cpi"),
        dict(id="wti", label="WTI crude ($/bbl)", value=float(wp[-1]), as_of=wd[-1], change_12m=r(wp[-1] / wp[-253] - 1), type="CURRENT DATA", source="eia_wti"),
        dict(id="gold", label="Gold ($/oz, monthly)", value=float(g[-1]), as_of=dates[-1], change_12m=r(g[-1] / g[-13] - 1), type="CURRENT DATA", source="gold_monthly"),
        dict(id="cape", label="Shiller CAPE", value=r(cape[np.isfinite(cape)][-1], 1), as_of="2023-09", percentile=r((cape[np.isfinite(cape)] < cape[np.isfinite(cape)][-1]).mean(), 3), type="STALE DATA", source="shiller_sp500",
             note="Dataset stopped updating CAPE in 2023; with the index ~70% higher since, CAPE is very likely higher now."),
    ],
    sp_recent=[dict(d=dates[i], p=r(px[i], 1)) for i in range(N - 60, N)],
    vix_recent=[dict(d=vix_rows[i]["DATE"], v=float(vix_rows[i]["CLOSE"])) for i in range(len(vix_rows) - 250, len(vix_rows), 5)],
)

# series for client-side quant playground
series = dict(dates=dates[years.tolist().index(1900):], px=[r(x, 2) for x in px[years >= 1900]],
              dy=[r(x, 5) for x in dy[years >= 1900]], cash=[r(x, 6) for x in np.nan_to_num(cash[years >= 1900])],
              note="Monthly S&P 500 (Shiller, averages of daily closes). Dividend yield frozen at last known value after 2023-06; cash = 10Y yield minus 1pt (floor 0) as a T-bill proxy.")


def eqcurve(ret, start=1900, step=3):
    m = years >= start
    eq = np.cumprod(1 + np.nan_to_num(ret[m]))
    d = np.array(dates)[m]
    return [dict(d=d[i], v=r(eq[i], 3)) for i in range(0, len(eq), step)]


curves = dict(bh=eqcurve(bh_ret), trend=eqcurve(ret_trend), tsmom=eqcurve(ret_tsm), vol_target=eqcurve(ret_vt), divergence=eqcurve(ret_div))

quant = dict(last_updated=TODAY, cost_assumption="10 bps per position change", split=f"Train {START}-{SPLIT-1} / Test {SPLIT}-{END}",
             experiments=[e1, e2, e3, e4, e5, e6, e7, e8], walk_forward=walk_forward, regimes=regimes, overfitting_demo=overfit, curves=curves)

swing_out = dict(last_updated=TODAY, cost_assumption="5 bps per side", split="Train 1986-2005 / Test 2006-2026", buy_and_hold=bh_w,
                 data_note="No free daily stock/volume data was reachable from this environment, so swing rules are tested on WTI crude daily closes (liquid, volatile, trend-prone). Volume and catalyst strategies are taught but NOT backtested.",
                 strategies=swing)

for name, obj in [("market_data.json", market), ("quant_experiments.json", quant), ("swing_backtests.json", swing_out),
                  ("sp500_series.json", series), ("framework_tests.json", fw_tests)]:
    with open(os.path.join(OUT, name), "w") as f:
        json.dump(obj, f, separators=(",", ":"))
print(json.dumps({e["id"]: [e["train"]["sharpe"], e["test"]["sharpe"], e["test"]["cagr"], e["test"]["maxdd"], e["bh_test"]["sharpe"], e["bh_test"]["maxdd"], e.get("robust_share")] for e in quant["experiments"]}))
print("OVERFIT", overfit)
print("V1", fw_tests["train"]["sharpe"], fw_tests["test"]["sharpe"], fw_tests["sensitivity"]); print("V2", fw_tests["v2"])
for x in swing: print(x["id"], [x[k]["profit_factor"] for k in ("train","test")], [x[k]["trades"] for k in ("train","test")], x["test"]["win_rate"], x["test"]["maxdd"])
