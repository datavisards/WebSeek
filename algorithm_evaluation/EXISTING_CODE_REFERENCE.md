# Quick Reference: Existing Code Structure

## ✅ What Already Exists (Legacy Code)

### TypeScript Infrastructure (`src/` directory)

**1. `src/task-generator.ts`**
- Original task generation prompt for GPT-4
- Function to generate benchmark tasks via OpenAI API
- **Note**: Uses old OpenAI API, needs update for OpenRouter

**2. `src/types.ts`**
- TypeScript type definitions for evaluation
- Task structure, tool definitions, evaluation results

**3. `src/sequence-comparator.ts`**
- Logic to compare generated tool sequences vs golden sequences
- Calculates F1 score, precision, recall, parameter accuracy

**4. `src/prompts-baseline.ts`**
- Baseline GPT-4 agent prompt
- Used for comparison against WebSeek

### Python Infrastructure (`scripts/` directory)

**1. `scripts/evaluation_runner.py`**
- Main evaluation orchestrator (skeleton)
- **Status**: Needs implementation
- **TODOs**:
  - Integrate with WebSeek (TypeScript)
  - Implement baseline GPT-4 calls
  - Use sequence-comparator for metrics

## 🆕 What Was Just Created

### Documentation
- `SETUP_GUIDE.md` - Complete setup instructions
- `50_TASK_PLAN.md` - Task specifications
- `START_HERE.md` - Quick start guide
- `.env.example` - Environment config template
- `requirements.txt` - Python dependencies

### Controlled Webpages
- `controlled_webpages/html_snapshots/` - 6 HTML files
- `controlled_webpages/webpage_placeholders.ts` - Hard-coded implementations

### New Scripts
- `generate-tasks.mjs` - Node.js script to generate tasks using OpenRouter

## 🚀 How to Use Existing Code

### Option 1: Use New Node.js Generator (Recommended)

```bash
cd /Users/yanwei/work/chi2026/webseek/algorithm_evaluation

# Make sure .env exists with OPENROUTER_API_KEY
cat .env

# Run the generator
node generate-tasks.mjs 20

# Output: data/benchmark_tasks.json
```

### Option 2: Update TypeScript Generator

The existing `src/task-generator.ts` can be updated to use OpenRouter:

```typescript
// Change this line in generateBenchmarkTasks():
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'HTTP-Referer': 'https://github.com/datavisards/WebSeek',
    'X-Title': 'WebSeek Technical Evaluation'
  },
  // ... rest of the code
});
```

### Option 3: Use Existing Python Runner (After Tasks Generated)

```bash
# Load environment
source venv/bin/activate

# Run evaluation (once tasks.json exists)
python scripts/evaluation_runner.py
```

## 📋 Current Status

### ✅ Complete
- Documentation (setup guides, task plans)
- Controlled webpages (6 HTML snapshots)
- Tool alignment (macro-tools.ts updated)
- Python environment setup (requirements.txt, .env.example)
- Node.js task generator (generate-tasks.mjs)

### ⏳ Needs Work
- **Generate tasks.json**: Run `node generate-tasks.mjs 50`
- **Update evaluation_runner.py**: Implement WebSeek + baseline integration
- **Test single task**: Verify everything works end-to-end
- **Run full evaluation**: Execute on all 50 tasks

### 🔧 Integration Points

**Python ↔ TypeScript:**
- Python calls Node.js subprocess for WebSeek evaluation
- Or: Create REST API wrapper around WebSeek
- Or: Use `tsx` to run TypeScript directly

**Evaluation Flow:**
1. Load tasks from `data/benchmark_tasks.json`
2. For each task:
   - Call WebSeek (TypeScript) → get tool sequence
   - Call Baseline (Python/OpenRouter) → get tool sequence
   - Compare both against golden sequence (TypeScript)
3. Aggregate metrics and generate report

## 🎯 Next Steps

1. **Generate tasks**: `node generate-tasks.mjs 50`
2. **Review tasks**: Check `data/benchmark_tasks.json`
3. **Update Python runner**: Implement WebSeek integration
4. **Test**: Run on 1-2 tasks first
5. **Full eval**: Run all 50 tasks
6. **Analyze**: Generate figures and write paper section

## 📂 File Organization

```
algorithm_evaluation/
├── src/                    # TypeScript infrastructure (legacy)
│   ├── task-generator.ts   # Original task generator
│   ├── types.ts            # Type definitions
│   ├── sequence-comparator.ts  # Metrics calculator
│   └── prompts-baseline.ts # Baseline agent prompt
│
├── scripts/                # Python scripts
│   └── evaluation_runner.py  # Main evaluation orchestrator
│
├── controlled_webpages/    # Ground truth webpages
│   ├── html_snapshots/     # 6 HTML files
│   └── webpage_placeholders.ts  # Placeholder implementations
│
├── data/                   # Generated data
│   └── benchmark_tasks.json  # TO BE GENERATED
│
├── results/                # Evaluation outputs
│
├── generate-tasks.mjs      # NEW: Node.js task generator
├── .env                    # API keys
├── requirements.txt        # Python deps
└── SETUP_GUIDE.md         # Detailed instructions
```

## 💡 Tips

- **Start small**: Generate 10 tasks first, test, then scale to 50
- **Use existing code**: The TypeScript infrastructure is solid, just needs integration
- **OpenRouter compatibility**: Use OpenAI client library, just change base URL
- **Incremental testing**: Test each component separately before full evaluation
