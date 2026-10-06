# FLOW

**Research the edge.** An interactive single-page lab for investing, swing trading, quant strategies, portfolio scenarios and a teen-startable business. It is for education and simulation only. It never executes trades.

## Open it (no install)
**Live site:** https://gabtobflores-lab.github.io/Ducky-Run/

One-time setup: in the repo, go to **Settings → Pages → Source** and pick **GitHub Actions**. Then merge to `main`. Every later push to `main` redeploys automatically through `.github/workflows/pages.yml`.

## Run it locally
```bash
npm install
npm run dev            # http://localhost:3000
```
Static build: `npm run build` writes the site to `out/`. `npm start` serves it.

### Ask Claude: free, no API key
The bar at the bottom (or ⌘K / Ctrl+K) opens a chat with **Claude Haiku** or **Claude Sonnet**, served free through [Puter.js](https://docs.puter.com). There's no API key, server or bill for you. The first message may open a one-time Puter sign-in window (free). Claude sees all of FLOW's research and which section you're on. If Puter doesn't offer the newest model name yet, it automatically falls back to the newest one it has. The footer shows which model answered.

### Refresh research (optional)
Requires Python 3 + numpy (`pip install numpy`).
```bash
npm run research   # re-runs all backtests and scoring → /data/*.json
```
Raw datasets are cached in `research/raw/`. To refresh market data, re-download the CSVs listed in `data/research_sources.json` first.

## Layout
- `app/`: the page and the `/api/chat` streaming route
- `components/`: one file per section, plus the AskClaude overlay
- `lib/quant.ts`: the in-browser backtest engine and strategy-discovery pipeline
- `data/`: structured JSON for everything shown on the page
- `research/`: `engine.py` (backtests), `score.py` (rankings/formulas/portfolios), `investments_src.py` (analyst inputs), `raw/` (cached data)
- `final/`: written summaries

## Labels
EDUCATION · SIMULATION · BACKTEST · CURRENT DATA · STALE DATA · RESEARCH HYPOTHESIS. Company metrics are approximate, mid-2026 knowledge. Historical performance does not guarantee future results.
