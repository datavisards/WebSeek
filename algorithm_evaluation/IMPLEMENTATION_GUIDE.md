# Implementation Guide for WebSeek Technical Evaluation

This guide provides step-by-step instructions for implementing and running the technical evaluation.

## Overview

The evaluation system has been scaffolded with the following components:

```
algorithm_evaluation/
├── TECHNICAL_EVALUATION_PLAN.md    # Complete methodology
├── README.md                        # Quick start guide
├── data/                           # Benchmark tasks (to be generated)
├── src/                            # Evaluation infrastructure
│   ├── types.ts                   # TypeScript type definitions
│   ├── task-generator.ts          # GPT-4 task generation
│   ├── prompts-baseline.ts        # Baseline agent prompt
│   └── sequence-comparator.ts     # Metrics calculation
├── results/                        # Evaluation outputs (created during run)
└── scripts/
    └── evaluation_runner.py       # Main orchestrator (needs implementation)
```

## Phase 1: Complete Implementation (Required Steps)

### Step 1: Implement WebSeek Integration

The evaluation runner needs to call WebSeek's proactive service. You have 3 options:

#### **Option A: Node.js Subprocess (Recommended)**

Create `src/webseek-caller.ts`:

```typescript
import { EnhancedProactiveService } from '../../entrypoints/sidepanel/proactive-service-enhanced';
import { BenchmarkTask } from './types';

export async function callWebSeekService(task: BenchmarkTask): Promise<{
  generated_sequence: any[];
  execution_time_ms: number;
  error?: string;
}> {
  const startTime = Date.now();
  
  try {
    // Initialize proactive service
    const proactiveService = new EnhancedProactiveService();
    
    // Set up context from task
    proactiveService.updateContext({
      instances: task.initial_canvas_state.instances,
      messages: task.conversation_history,
      htmlContexts: {
        [task.starting_url]: task.html_context
      },
      logs: task.recent_logs,
      currentPageInfo: {
        pageId: 'eval_page',
        url: task.starting_url
      }
    });
    
    // Generate suggestions
    // Note: You may need to adapt this based on actual API
    const suggestions = await proactiveService.generateAIDrivenSuggestions();
    
    // Extract tool sequences
    const tool_sequence = suggestions
      .filter(s => s.toolCall || s.toolSequence)
      .flatMap(s => {
        if (s.toolCall) return [s.toolCall];
        if (s.toolSequence) return s.toolSequence.steps.map(step => step.toolCall);
        return [];
      });
    
    return {
      generated_sequence: tool_sequence,
      execution_time_ms: Date.now() - startTime
    };
    
  } catch (error: any) {
    return {
      generated_sequence: [],
      execution_time_ms: Date.now() - startTime,
      error: error.message
    };
  }
}

// CLI interface for Python subprocess
if (require.main === module) {
  const taskJson = process.argv[2];
  const task = JSON.parse(taskJson);
  
  callWebSeekService(task).then(result => {
    console.log(JSON.stringify(result));
    process.exit(0);
  }).catch(error => {
    console.error(JSON.stringify({ error: error.message }));
    process.exit(1);
  });
}
```

Then update `evaluation_runner.py`:

```python
def _call_webseek(self, task: Dict[str, Any]) -> Dict[str, Any]:
    """Call WebSeek via Node.js subprocess"""
    import subprocess
    import json
    
    # Compile TypeScript if needed
    # subprocess.run(['npx', 'tsc', 'src/webseek-caller.ts'])
    
    # Run Node.js script
    result = subprocess.run(
        ['npx', 'ts-node', str(SRC_DIR / 'webseek-caller.ts'), json.dumps(task)],
        capture_output=True,
        text=True,
        cwd=str(EVAL_DIR.parent)  # Run from project root
    )
    
    if result.returncode != 0:
        raise Exception(f"WebSeek call failed: {result.stderr}")
    
    return json.loads(result.stdout)
```

#### **Option B: REST API Wrapper**

Create a simple Express server that wraps WebSeek:

```typescript
// src/webseek-api-server.ts
import express from 'express';
import { callWebSeekService } from './webseek-caller';

const app = express();
app.use(express.json());

app.post('/evaluate', async (req, res) => {
  try {
    const result = await callWebSeekService(req.body);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`WebSeek evaluation API running on port ${PORT}`);
});
```

Start server: `npx ts-node src/webseek-api-server.ts`

Then in Python:
```python
def _call_webseek(self, task: Dict[str, Any]) -> Dict[str, Any]:
    import requests
    response = requests.post('http://localhost:3001/evaluate', json=task)
    response.raise_for_status()
    return response.json()
```

#### **Option C: Direct TypeScript Execution**

Use a TypeScript runtime in Python:
- Install: `pip install nodejs-wheel` or use `pynode`
- Execute TypeScript directly from Python

### Step 2: Implement Baseline Agent Call

Update `evaluation_runner.py`:

```python
import openai

def _call_baseline(self, task: Dict[str, Any]) -> Dict[str, Any]:
    """Call baseline GPT-4 agent"""
    from prompts_baseline import create_baseline_prompt  # You'll need to port this
    
    start_time = time.time()
    
    try:
        # Create prompt
        prompt = create_baseline_prompt(
            task['html_context'],
            json.dumps(task['initial_canvas_state']['instances'], indent=2),
            task['goal_description'],
            task['conversation_history'],
            task['recent_logs'],
            {'pageId': 'eval_page', 'url': task['starting_url']}
        )
        
        # Call OpenAI API
        client = openai.OpenAI(api_key=self.api_key)
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are a helpful AI assistant."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=4096
        )
        
        execution_time_ms = int((time.time() - start_time) * 1000)
        
        # Parse response
        content = response.choices[0].message.content
        # Extract JSON from markdown code blocks if present
        import re
        json_match = re.search(r'\{[\s\S]*\}', content)
        if json_match:
            parsed = json.loads(json_match.group(0))
            tool_sequence = parsed.get('tool_sequence', [])
        else:
            tool_sequence = []
        
        return {
            'task_id': task['task_id'],
            'system': 'baseline',
            'generated_sequence': tool_sequence,
            'execution_time_ms': execution_time_ms
        }
        
    except Exception as e:
        return {
            'task_id': task['task_id'],
            'system': 'baseline',
            'error': str(e),
            'generated_sequence': [],
            'execution_time_ms': int((time.time() - start_time) * 1000)
        }
```

### Step 3: Implement Sequence Comparison

The `sequence-comparator.ts` file is already implemented. You need to call it from Python:

```python
def _compare_sequences(self, generated: List[Dict], golden: List[Dict]) -> Dict[str, Any]:
    """Compare generated vs golden sequences using TypeScript comparator"""
    import subprocess
    
    comparison_input = json.dumps({
        'generated': generated,
        'golden': golden
    })
    
    result = subprocess.run(
        ['npx', 'ts-node', '-e', 
         f"import {{compareSequences}} from './src/sequence-comparator'; "
         f"console.log(JSON.stringify(compareSequences({comparison_input})))"],
        capture_output=True,
        text=True,
        cwd=str(EVAL_DIR)
    )
    
    if result.returncode != 0:
        raise Exception(f"Comparison failed: {result.stderr}")
    
    return json.loads(result.stdout)
```

### Step 4: Implement Metrics Calculation

Update the `_calculate_system_metrics` method:

```python
def _calculate_system_metrics(self, results: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Calculate aggregate metrics for a system"""
    
    # Compare each result with golden sequence
    comparisons = []
    for result in results:
        task = next(t for t in self.tasks if t['task_id'] == result['task_id'])
        comparison = self._compare_sequences(
            result['generated_sequence'],
            task['golden_tool_sequence']
        )
        comparisons.append(comparison)
    
    # Calculate aggregates
    n = len(comparisons)
    return {
        'total_tasks': n,
        'avg_f1': sum(c['tool_selection_f1'] for c in comparisons) / n,
        'avg_precision': sum(c['tool_selection_precision'] for c in comparisons) / n,
        'avg_recall': sum(c['tool_selection_recall'] for c in comparisons) / n,
        'avg_parameter_accuracy': sum(c['parameter_accuracy'] for c in comparisons) / n,
        'perfect_match_rate': sum(1 for c in comparisons if c['perfect_match']) / n,
        'avg_execution_time_ms': sum(r['execution_time_ms'] for r in results) / n,
        'avg_step_count': sum(len(r['generated_sequence']) for r in results) / n,
        'by_category': self._breakdown_by_category(results, comparisons),
        'by_difficulty': self._breakdown_by_difficulty(results, comparisons)
    }
```

## Phase 2: Generate Benchmark Tasks

### Step 1: Run Task Generator

Create a script to generate tasks:

```bash
#!/bin/bash
# scripts/generate_tasks.sh

export OPENAI_API_KEY="your-api-key-here"

npx ts-node src/task-generator.ts
```

Or create a Python wrapper:

```python
# scripts/generate_tasks.py

from task_generator import generate_benchmark_tasks
import json
import os

api_key = os.getenv('OPENAI_API_KEY')
if not api_key:
    print("Error: OPENAI_API_KEY not set")
    exit(1)

# Generate 100 tasks in 5 batches of 20
tasks = generate_benchmark_tasks(api_key, batch_size=20, batches=5)

# Save to file
with open('data/benchmark_tasks.json', 'w') as f:
    json.dump(tasks, f, indent=2)

print(f"Generated {len(tasks)} tasks")
```

### Step 2: Expert Review & Refinement

1. Two experts independently review all generated tasks
2. Validate golden tool sequences
3. Ensure HTML contexts are realistic
4. Add alternative valid sequences where applicable
5. Calculate inter-annotator agreement (Cohen's κ)

Create a review interface or spreadsheet with columns:
- Task ID
- Goal Description
- Golden Sequence Valid? (Y/N)
- Alternative Sequences
- HTML Context Realistic? (Y/N)
- Difficulty Appropriate? (Y/N)
- Expert Notes

### Step 3: Finalize Benchmark

After expert review:
1. Incorporate feedback
2. Fix any issues in golden sequences
3. Ensure 100 high-quality tasks
4. Save final version to `data/benchmark_tasks.json`

## Phase 3: Run Evaluation

```bash
# Set API key
export OPENAI_API_KEY="your-key-here"

# Run full evaluation
python scripts/evaluation_runner.py

# Or run in stages:
# 1. WebSeek only
python scripts/evaluation_runner.py --system webseek

# 2. Baseline only  
python scripts/evaluation_runner.py --system baseline

# 3. Calculate metrics
python scripts/evaluation_runner.py --metrics-only
```

## Phase 4: Analysis & Visualization

Create analysis scripts:

```python
# scripts/analyze_results.py

import json
import matplotlib.pyplot as plt
import seaborn as sns
import pandas as pd
from pathlib import Path

def load_results():
    results_dir = Path('results')
    with open(results_dir / 'metrics.json') as f:
        return json.load(f)

def plot_comparison(metrics):
    """Plot WebSeek vs Baseline comparison"""
    fig, axes = plt.subplots(2, 2, figsize=(12, 10))
    
    # F1 Score comparison
    axes[0, 0].bar(['WebSeek', 'Baseline'], 
                   [metrics['webseek']['avg_f1'], metrics['baseline']['avg_f1']])
    axes[0, 0].set_title('Tool Selection F1 Score')
    axes[0, 0].set_ylim(0, 1)
    
    # Parameter Accuracy
    axes[0, 1].bar(['WebSeek', 'Baseline'],
                   [metrics['webseek']['avg_parameter_accuracy'], 
                    metrics['baseline']['avg_parameter_accuracy']])
    axes[0, 1].set_title('Parameter Accuracy')
    axes[0, 1].set_ylim(0, 1)
    
    # Perfect Match Rate
    axes[1, 0].bar(['WebSeek', 'Baseline'],
                   [metrics['webseek']['perfect_match_rate'],
                    metrics['baseline']['perfect_match_rate']])
    axes[1, 0].set_title('Perfect Match Rate')
    axes[1, 0].set_ylim(0, 1)
    
    # Execution Time
    axes[1, 1].bar(['WebSeek', 'Baseline'],
                   [metrics['webseek']['avg_execution_time_ms'],
                    metrics['baseline']['avg_execution_time_ms']])
    axes[1, 1].set_title('Avg Execution Time (ms)')
    
    plt.tight_layout()
    plt.savefig('results/comparison_plot.png', dpi=300)
    print("Saved comparison plot to results/comparison_plot.png")

def plot_by_category(metrics):
    """Plot performance breakdown by category"""
    categories = list(metrics['webseek']['by_category'].keys())
    webseek_f1 = [metrics['webseek']['by_category'][c]['avg_f1'] for c in categories]
    baseline_f1 = [metrics['baseline']['by_category'][c]['avg_f1'] for c in categories]
    
    x = range(len(categories))
    width = 0.35
    
    fig, ax = plt.subplots(figsize=(12, 6))
    ax.bar([i - width/2 for i in x], webseek_f1, width, label='WebSeek')
    ax.bar([i + width/2 for i in x], baseline_f1, width, label='Baseline')
    
    ax.set_ylabel('F1 Score')
    ax.set_title('Performance by Task Category')
    ax.set_xticks(x)
    ax.set_xticklabels(categories, rotation=45, ha='right')
    ax.legend()
    ax.set_ylim(0, 1)
    
    plt.tight_layout()
    plt.savefig('results/by_category_plot.png', dpi=300)
    print("Saved category plot to results/by_category_plot.png")

if __name__ == "__main__":
    metrics = load_results()
    plot_comparison(metrics)
    plot_by_category(metrics)
    print("Analysis complete!")
```

## Phase 5: Paper Integration

### Write Results Section

Template for paper section:

```latex
\section{Technical Evaluation}

\subsection{Methodology}

We conducted a batch simulation evaluation to assess WebSeek's proactive guidance capabilities, inspired by the approach in ProactiveVA~\cite{proactiveva2025}. Our evaluation measures the system's ability to generate correct, efficient tool sequences for data-driven decision-making tasks on the web.

\subsubsection{Benchmark Design}

We created a benchmark of 100 real-world data tasks across 5 categories: ...

[Include Table 1: Task Distribution]

\subsubsection{Evaluation Metrics}

We measured:
- \textbf{Tool Selection F1 Score}: ...
- \textbf{Parameter Accuracy}: ...
- \textbf{Task Success Rate}: ...

\subsubsection{Baseline Comparison}

We compared WebSeek against a generic GPT-4 agent...

\subsection{Results}

[Include Table 2: Overall Performance]

WebSeek achieved an average F1 score of X.XX, significantly outperforming the baseline (p < 0.05, Cohen's d = X.XX)...

[Include Figure: Comparison Plot]

\subsection{Analysis}

\subsubsection{Performance by Category}

[Include Table 3: Per-Category Results]

\subsubsection{Failure Mode Analysis}

We categorized the errors made by both systems...

\subsection{Discussion}

Our technical evaluation demonstrates that...
```

## Troubleshooting

### Common Issues

**Issue**: TypeScript compilation errors
- **Solution**: Run `npm install` in project root, ensure all dependencies are installed

**Issue**: Python subprocess not finding ts-node
- **Solution**: Install globally: `npm install -g ts-node`

**Issue**: OpenAI API rate limits
- **Solution**: Add longer delays between calls, use batch processing

**Issue**: WebSeek context not properly set
- **Solution**: Verify the context structure matches what proactive-service expects

## Timeline

- **Week 1**: Implement integration code + generate initial tasks
- **Week 2**: Expert review + run evaluation + calculate metrics
- **Week 3**: Analysis + write paper section
- **Week 4**: Revisions + prepare supplementary materials

## Next Steps

1. **Immediate**: Implement WebSeek integration (choose Option A, B, or C)
2. **This week**: Generate and review benchmark tasks
3. **Next week**: Run full evaluation
4. **Following week**: Write paper section

## Questions?

Review `TECHNICAL_EVALUATION_PLAN.md` for detailed methodology.

Contact the research team if you need clarification on any step.
