---
layout: default
title: WebSeek – User Tutorial
---

# WebSeek Tutorial

WebSeek is a Chrome extension that brings AI-powered data analysis directly into your browser. You can extract tables from any webpage, refine them, build charts, and get proactive AI suggestions — all without switching tabs.

---

## Installation

### Step 1: Install the extension

**Option A – Chrome Web Store** (recommended)
Visit the WebSeek page on the Chrome Web Store and click **Add to Chrome**.

**Option B – Load unpacked (developer mode)**
1. Download the latest release ZIP from the [Releases](https://github.com/datavisards/WebSeek/releases) page and unzip it.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select the unzipped folder.

### Step 2: Configure your API key

1. Click the WebSeek icon in the Chrome toolbar to open the sidepanel.
2. Complete the short onboarding wizard.
3. When prompted, enter your **OpenRouter API key** (get one free at [openrouter.ai](https://openrouter.ai/keys)).
4. Optionally enter the **Backend URL** if you are running your own WebSeek backend server.

---

## Core Concepts

| Concept | Description |
|---|---|
| **Instance** | A piece of data on your canvas — a table, a visualization, or a text note |
| **Canvas** | The sidepanel workspace where all instances live |
| **Suggestion** | An AI-generated action (create table, add column, build chart…) that you can apply in one click |
| **Snapshot** | A saved state of your entire canvas, stored on the backend |

---

## Extracting Data from a Webpage

1. Open any webpage with tabular data (e.g. a product listing, a Wikipedia table, a search results page).
2. Open the WebSeek sidepanel.
3. Type a request in the chat box, for example:
   *"Extract the laptop listings from this page into a table."*
4. The AI agent will analyze the page and create a **Table** instance on your canvas.

---

## Working with Tables

### Viewing and editing

Click a table instance to open the **Table Editor**:

- **Edit cells** – click any cell to type directly.
- **Resize columns** – drag the right edge of a column header.
- **Resize rows** – drag the bottom edge of a row number cell.
- **Add column** – click the **+** button in the header row.
- **Computed column** – add a column with a formula (e.g. `Price * Discount`).

### Dragging instances

Drag an instance card from the left rail into the table editor to merge it with the current table.

### Exporting

Right-click a table instance → **Export** → **XLSX**.
The file opens directly in Excel or Google Sheets.

---

## Building Visualizations

1. In the chat box, type: *"Visualize the price vs. rating from my table."*
2. The AI will create a **Visualization** instance backed by Vega-Lite.
3. Click the visualization to open the **Visualization Editor** and tweak the Vega-Lite spec directly.

### Exporting visualizations

Right-click a visualization → **Export** → choose **SVG**, **PNG**, or **JPG**.

---

## Proactive AI Suggestions

WebSeek continuously monitors your canvas and suggests relevant next steps:

- **Blue indicator** (bottom of sidepanel): "AI is analyzing…" — the engine is working.
- **Green indicator**: "Suggestions ready" — click to see suggestions.

Each suggestion shows the proposed action. Click **Apply** to execute it, or **Dismiss** to skip.

---

## Snapshots

Save your work at any point:

1. Click the **Save** icon (💾) in the sidepanel toolbar.
2. Give the snapshot a name.
3. To restore, click the **History** icon and select a snapshot.

---

## Tips

- You can ask follow-up questions in the chat: *"Add a column that shows whether the price is above average."*
- Use **Merge** to combine two tables: drag one table onto another in the editor.
- The **Settings** panel (⚙) lets you change the API key, backend URL, and model at any time.
- All data stays in your browser (localStorage) and on your backend — nothing is sent to third-party servers except LLM prompts.

---

## Frequently Asked Questions

**Do I need the backend to use WebSeek?**
Basic extraction and editing work with just the OpenRouter key. The backend is needed for snapshots and the server-side chart rendering fallback.

**Which LLM models are supported?**
Any model available on OpenRouter. The default is `google/gemini-2.5-flash`. You can change it in Settings.

**Is my data sent anywhere?**
Only the LLM prompt (which may include page content and table data) is sent to OpenRouter. No data is stored by Anthropic or OpenRouter beyond their standard API logging policies.

**The extension doesn't connect to my backend — what do I check?**
- Confirm the backend is running (`python main.py`).
- Confirm the Backend URL in Settings matches the server address (no trailing slash).
- If the page is HTTPS, your backend must also be HTTPS (or use `http://localhost` for local dev).

---

## Support

Open an issue on [GitHub](https://github.com/datavisards/WebSeek/issues).
