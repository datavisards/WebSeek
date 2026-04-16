# WebSeek

> **[CHI 2026 — Full Paper]** *Facilitating Proactive and Reactive Guidance for Decision Making on the Web: A Design Probe with WebSeek*
> Yanwei Huang, Arpit Narechania · [arXiv:2601.15100](https://arxiv.org/abs/2601.15100)

WebSeek is a Chrome extension that helps users discover, extract, and analyze information directly on webpages. It provides an interactive canvas where users can build tables, lists, and visualizations from live web content — with an AI layer that offers both **proactive** suggestions (the system notices patterns and proposes next steps) and **reactive** assistance (users ask questions and request transformations in natural language).

An exploratory study with 15 participants revealed diverse web-analysis strategies and highlighted user preferences for transparency and control in human–AI collaboration.

---

## Features

- **AI-assisted data extraction** — select a webpage element and let the agent extract structured rows
- **Spreadsheet-style table editor** — resize columns/rows, add computed columns, merge tables
- **Vega-Lite visualization editor** — generate and refine charts backed by table data
- **Proactive AI suggestions** — the extension watches your canvas and suggests next steps automatically
- **Export** — tables as XLSX, visualizations as SVG / PNG / JPG
- **Snapshots** — save and restore the full canvas state via the backend

## Architecture

```
Chrome Extension (WXT + React + TypeScript)
   └─ Sidepanel UI  ─── REST / WebSocket ───▶  FastAPI Backend (Python)
                                                  └─ Google ADK agents
                                                  └─ OpenRouter LLM
```

## Prerequisites

- Node.js ≥ 18
- Chrome ≥ 114 (for Side Panel API)
- The [WebSeek backend](https://github.com/datavisards/webseek-backend) running locally or on a server

## Setup

### 1. Clone and install

```bash
git clone https://github.com/datavisards/WebSeek.git
cd WebSeek
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

| Variable | Description |
|---|---|
| `WXT_OPENROUTER_KEY` | Your [OpenRouter](https://openrouter.ai/keys) API key |
| `VITE_BACKEND_URL` | URL of the WebSeek backend, e.g. `http://localhost:8000` |

> **Security**: `.env` is gitignored. Never commit it.

Users can also enter their API key and backend URL at runtime through the extension's **Settings** panel (⚙ icon), without rebuilding.

### 3. Run in development mode

```bash
npm run dev
```

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select `.output/chrome-mv3-dev`

### 4. Build for production / Chrome Web Store

```bash
npm run build
```

The production build is in `.output/chrome-mv3/`. Zip it for Web Store submission:

```bash
cd .output && zip -r webseek.zip chrome-mv3/
```

## Project Structure

```
webseek/
├── entrypoints/
│   ├── background/           # Service worker
│   ├── content/              # Content script (page interaction)
│   ├── popup/                # Toolbar popup
│   └── sidepanel/            # Main UI
│       ├── components/       # React components
│       ├── apis.ts           # Backend REST calls
│       ├── macro-tools.ts    # Tool definitions for proactive AI
│       ├── macro-tool-executor.ts       # Client-side tool executor
│       ├── proactive-service-enhanced.ts # Proactive AI orchestration
│       ├── trigger-engine.ts # Rules engine for AI suggestions
│       └── prompts.ts        # LLM prompt templates
├── docs/                     # GitHub Pages tutorial
├── public/                   # Static assets
├── manifest.json             # Extension manifest (MV3)
├── wxt.config.ts             # WXT build config
└── .env.example              # Environment variable template
```

## Security Notes

- The `WXT_OPENROUTER_KEY` is embedded in the extension bundle at build time. For a publicly distributed extension, route all LLM calls through your own backend so the key is never shipped to end users.
- For HTTPS pages, the backend must also be HTTPS (or use `http://localhost` for local development only).

## Citation

If you use WebSeek in your research, please cite:

```bibtex
@inproceedings{huang2026webseek,
  title     = {Facilitating Proactive and Reactive Guidance for Decision Making on the Web: A Design Probe with WebSeek},
  author    = {Huang, Yanwei and Narechania, Arpit},
  booktitle = {Proceedings of the 2026 CHI Conference on Human Factors in Computing Systems},
  year      = {2026},
  publisher = {ACM},
  url       = {https://arxiv.org/abs/2601.15100}
}
```

## License

MIT
