# Trading Strategy (Backtests)
**Index (S&P monthly; train 1900–79, test 1980–2026; 10 bps per switch):** only trend following (OOS Sharpe 0.89) and 12-month TS momentum (0.79) held up robustly. Mean reversion (0.14), vol-targeting (0.60) and CAPE timing (0.51) failed against buy-and-hold at 0.63. In the overfitting demo, the 10 best of 300 random seasonal rules scored Sharpe 0.46 in training and 0.40 out-of-sample.

**Swing (WTI daily, 1986–2026; no equity daily data was available):** the 50/200 trend rule held up, with profit factor 2.3 in training and 2.6 in testing, but over only 29 trades. Pullback and multi-factor dip-buying decayed below PF 1 after 2005. Volume and catalyst strategies were not tested because there was no data.
