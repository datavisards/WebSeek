# Task Generator - Final Implementation

## ✅ What Was Fixed

### 1. **Better Error Handling**
- Added API connection test at startup
- Detailed error messages with causes
- Graceful failure handling for individual tasks

### 2. **Controlled Generation**
- Generates ONE task at a time (not batch)
- Script controls: category, difficulty, page
- Explicit distribution plan for 50 tasks

### 3. **Webpage Knowledge**
- Full information about 6 controlled HTML snapshots
- Each task knows target page's data structure, issues, samples
- Context-aware prompts for realistic tasks

## 📊 Task Distribution (50 Total)

| Page | Tasks | % |
|------|-------|---|
| Amazon Cameras | 8 | 16% |
| Wikipedia Countries | 8 | 16% |
| IMDb Movies | 8 | 16% |
| eBay Cameras | 6 | 12% |
| Kaggle Datasets | 6 | 12% |
| GitHub Repos | 6 | 12% |
| Cross-Page | 6 | 12% |
| Discovery | 2 | 4% |

**By Difficulty:**
- Easy: 15 tasks (30%)
- Medium: 21 tasks (42%)
- Hard: 14 tasks (28%)

**By Category:**
- Extraction: 18 tasks (36%)
- Cleaning: 15 tasks (30%)
- Visualization: 7 tasks (14%)
- Discovery: 2 tasks (4%)
- Cross-page: 6 tasks (12%)
- Composite: 2 tasks (4%)

## 🚀 Usage

```bash
cd /Users/yanwei/work/chi2026/webseek/algorithm_evaluation

# Generate all 50 tasks (takes ~2-3 minutes)
node generate-tasks.mjs

# Output: data/benchmark_tasks.json
```

## 📝 Output Format

Each task includes:
- `task_id`: T001-T050
- `task_category`: extraction, cleaning, visualization, etc.
- `difficulty`: easy, medium, hard
- `page`: Which controlled webpage (or null for discovery)
- `goal_description`: Clear user goal
- `starting_url`: Webpage URL
- `html_context`: Relevant HTML snippet with data-aid-id
- `initial_canvas_state`: Starting instances
- `conversation_history`: Previous chat (usually empty)
- `recent_logs`: Recent user actions
- `golden_tool_sequence`: Correct tool sequence
- `expected_tools`: Number of tools needed

## 🔧 Key Features

1. **Neutral Language**: No mention of "WebSeek" to avoid bias
2. **Rich Tool Descriptions**: Includes parameters, examples, constraints
3. **Page-Specific Context**: Uses actual data from controlled webpages
4. **API Rate Limiting**: 2-second delay between requests
5. **Progress Tracking**: Shows task number and description
6. **Error Recovery**: Continues even if individual tasks fail

## 📂 File Structure

```
algorithm_evaluation/
├── generate-tasks.mjs          # Main generator script ✅
├── .env                         # API keys ✅
├── controlled_webpages/
│   └── html_snapshots/          # 6 HTML files ✅
└── data/
    └── benchmark_tasks.json     # Generated tasks (output)
```

## ⚡ Next Steps

After generation completes:

1. **Review Tasks**: Check `data/benchmark_tasks.json`
2. **Validate Golden Sequences**: Ensure tool sequences are correct
3. **Manual Edits**: Fix any issues with specific tasks
4. **Run Evaluation**: Use tasks with evaluation runner

## 🐛 Troubleshooting

**"fetch failed" error:**
- Check internet connection
- Verify OPENROUTER_API_KEY in .env
- Run: `node generate-tasks.mjs` (it will test connection first)

**Tasks fail to parse:**
- LLM might return markdown-wrapped JSON
- Script handles this automatically by extracting JSON

**Wrong number of tasks:**
- Check TASK_PLAN array in generate-tasks.mjs
- Counts should sum to 50

## 📊 Expected Quality

- ✅ Each task uses correct page context
- ✅ Tool sequences use only available tools
- ✅ Difficulty matches complexity (easy: 1-2 tools, hard: 5+ tools)
- ✅ HTML contexts have data-aid-id attributes
- ✅ Goals are specific and measurable

Generated: November 17, 2025
Status: ✅ Working and generating tasks
