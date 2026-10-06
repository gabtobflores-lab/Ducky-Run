# FLOW

**Research the edge.** An interactive single-page lab for investing, swing trading, quant strategies, portfolio scenarios and a teen-startable business. It is for education and simulation only. It never executes trades.

## Open it (no install)
**Get FLOW its own link (free, about 1 minute), either way:**
- **Netlify Drop:** open https://app.netlify.com/drop and drag in the `out/` folder (or unzip `flow-site.zip` first). You get a link like `flow-xyz.netlify.app`. Sign up free to keep it, then rename it under Site settings → Change site name, e.g. `flow-lab.netlify.app`.
- **Vercel:** [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/gabtobflores-lab/Ducky-Run&project-name=flow&repository-name=flow). This gives a link like `flow.vercel.app` that redeploys on every push.

**Hosted link (claude.ai):** https://claude.ai/artifact/Kf6rwoY3TRB5hiNHXQCKzU. Ask Claude here uses your own Claude account. To rebuild it: `npm run build && python3 scripts/artifact.py`.

**GitHub Pages:** https://gabtobflores-lab.github.io/Ducky-Run/

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
