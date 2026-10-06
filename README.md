# FLOW

**Research the edge.** An interactive single-page lab for investing, swing trading, quant strategies, portfolio scenarios and a teen-startable business. It is for education and simulation only. It never executes trades.

## Run it

```bash
npm install
npm run dev            # http://localhost:3000
```

Production: `npm run build && npm start`.

### Ask Claude (optional)
The bar at the bottom opens a chat with Claude, using **Haiku 4.5** or **Sonnet 5.5**. Claude can see all of FLOW's research data and which section you're viewing. To turn it on:

```bash
cp .env.example .env.local   # then paste your key: ANTHROPIC_API_KEY=sk-ant-...
npm run dev
```
Shortcut: ⌘K / Ctrl+K.

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
