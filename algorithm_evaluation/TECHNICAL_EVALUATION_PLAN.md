# WebSeek Technical Evaluation Plan
## Algorithmic Evaluation of Proactive Guidance System

**Date**: November 17, 2025  
**Purpose**: Technical evaluation to address 2AC reviewer's concerns about system reliability and guidance utility

---

## Executive Summary

This technical evaluation assesses WebSeek's AI-driven proactive guidance capabilities through batch simulation testing. Inspired by *ProactiveVA* (TVCG 2025), we measure the system's ability to generate correct, efficient tool sequences for data-driven decision-making tasks on the web.

**Key Distinction**: This evaluation focuses on the **proactive AI reasoning engine**, NOT the low-level web automation primitives. We evaluate whether WebSeek can generate appropriate guidance (tool sequences) for data tasks, not whether web scraping always works perfectly.

---

## 1. Evaluation Objectives

### Primary Research Questions
1. **RQ1 (Correctness)**: Can WebSeek's proactive system generate valid tool sequences for data tasks?
2. **RQ2 (Efficiency)**: Are the generated tool sequences optimal (minimal steps, appropriate tools)?
3. **RQ3 (Contextual Awareness)**: Does WebSeek consider user context (instances, HTML, focus) effectively?
4. **RQ4 (Comparative Performance)**: How does WebSeek's specialized guidance compare to generic LLM agents?

### What We're Evaluating
- **System Component**: WebSeek's proactive AI service (`proactive-service-enhanced.ts`)
- **Input**: Static snapshots of user workflow states
- **Output**: Tool call sequences using WebSeek's 11 macro tools
- **Baseline**: GPT-4 with generic function-calling prompt

### What We're NOT Evaluating
- ❌ Web scraping reliability (element locators, DOM stability)
- ❌ Real-time interaction dynamics (that's covered by user study)
- ❌ LLM's general data manipulation capabilities
- ✅ **WebSeek's framework** for proactive guidance generation

---

## 2. WebSeek's Tool System (Ground Truth)

WebSeek provides **11 macro suggestion tools** defined in `macro-tools.ts`:

| Tool Name | Category | Description |
|-----------|----------|-------------|
| `openPage` | Discovery | Open external websites/resources |
| `tableSort` | Data Wrangling | Sort table by column |
| `tableFilter` | Data Wrangling | Filter table rows by conditions |
| `createVisualization` | Visualization | Generate charts from tables |
| `exportData` | Export | Export to CSV/JSON/XLSX/PNG/SVG |
| `duplicateInstance` | Workflow | Create instance copies |
| `searchAndReplace` | Data Cleaning | Find/replace with regex support |
| `mergeInstances` | Data Wrangling | Join/union tables |
| `renameColumn` | Data Cleaning | Rename table columns |
| `convertColumnType` | Data Cleaning | Convert column types (with cleaning patterns) |
| `fillMissingValues` | Data Cleaning | Impute missing values |

**Tool Sequences**: WebSeek can suggest composite operations (e.g., convert currency column → sort by price)

---

## 3. Benchmark Design

### 3.1 Task Structure

Each benchmark task consists of:

```typescript
interface BenchmarkTask {
  task_id: string;
  task_category: 'Discovery' | 'Extraction & Wrangling' | 'Profiling & Cleaning' | 
                 'Modeling & Visualization' | 'Composite';
  difficulty: 'Easy' | 'Medium' | 'Hard';
  goal_description: string; // High-level user goal
  
  // Static Context (replaces dynamic interaction)
  starting_url: string;
  html_context: string; // Annotated HTML with data-aid-id attributes
  initial_canvas_state: {
    instances: Instance[]; // Existing instances on canvas
    focus_instance_id?: string; // Currently selected/edited instance
  };
  conversation_history: Message[]; // Previous chat messages
  recent_logs: string[]; // Last 15 user actions (simulated)
  
  // Ground Truth
  golden_tool_sequence: ToolCall[]; // Ideal solution
  golden_final_state: Instance[]; // Expected outcome
  
  // Metadata
  expected_complexity: number; // Tool call count
  requires_html_analysis: boolean;
  requires_instance_analysis: boolean;
}
```

### 3.2 Task Categories & Difficulty Distribution

**Target: 100 tasks** (aligned with ProactiveVA scale)

| Category | Easy (1-2 tools) | Medium (3-4 tools) | Hard (5+ tools) | Total |
|----------|------------------|---------------------|-----------------|-------|
| Discovery | 5 | 5 | 0 | 10 |
| Extraction & Wrangling | 10 | 15 | 5 | 30 |
| Profiling & Cleaning | 10 | 10 | 5 | 25 |
| Modeling & Visualization | 5 | 5 | 5 | 15 |
| Composite (multi-step) | 0 | 10 | 10 | 20 |
| **Total** | **30** | **45** | **25** | **100** |

**Difficulty Criteria**:
- **Easy**: Single tool application (e.g., "Sort table by price")
- **Medium**: Tool sequence with dependencies (e.g., "Clean price column → sort → visualize")
- **Hard**: Multi-instance operations, complex joins, or error-prone transformations

### 3.3 Addressing the "Tricky Things"

#### **Tricky #1**: Simulating WebSeek's Context Dependencies

**Solution: Static Snapshot Approach**
- Each task provides a **frozen moment** in the user's workflow
- Context includes:
  - `html_context`: Annotated HTML from the current page
  - `initial_canvas_state`: Instances already created by user
  - `conversation_history`: Previous AI-user dialogue
  - `recent_logs`: Last 15 action events (e.g., "Opened table editor", "Edited cell A1")
  
**Sacrifice Made**: We don't evaluate real-time reactivity (user study covers this)  
**Gain**: Reproducible, scalable batch evaluation

#### **Tricky #2**: Defining Ground Truth

**Solution: Expert-Annotated Tool Sequences**
- Two data analysis experts create golden tool sequences
- Inter-annotator agreement required (Cohen's κ > 0.7)
- Disagreements resolved through discussion
- **Why this is sufficient**: We're evaluating guidance quality, not absolute task correctness

**Ground Truth Components**:
1. **Golden Tool Sequence**: Ordered list of tool calls with exact parameters
2. **Golden Final State**: Expected instances after execution (for validation)
3. **Alternative Valid Sequences**: Multiple valid approaches allowed

**Example Ground Truth**:
```json
{
  "golden_tool_sequence": [
    {
      "function": "convertColumnType",
      "parameters": {
        "instanceId": "products_table",
        "columnName": "B",
        "targetType": "numerical",
        "cleaningPattern": "[\\$,]",
        "replaceWith": ""
      }
    },
    {
      "function": "tableSort",
      "parameters": {
        "instanceId": "products_table",
        "columnName": "B",
        "order": "asc"
      }
    }
  ],
  "alternative_sequences": [
    // searchAndReplace + convertColumnType + tableSort (also valid)
  ]
}
```

#### **Tricky #3**: Task Categorization for Diversity

**Solution: Use WebSeek's Trigger Rule Categories**

From `trigger-engine.ts`, WebSeek has 15+ trigger rules:
- **Data Extraction**: batch-extract-items, table-cell-completion
- **Data Cleaning**: entity-normalization, remove-extraneous-chars, data-type-correction
- **Data Wrangling**: table-joining, table-sorting-filtering
- **Visualization**: auto-generate-viz, suggest-alternative-charts
- **Workflow**: workflow-automation, cross-instance-duplication

**Task Generation Strategy**:
1. Each trigger rule → 5-10 benchmark tasks
2. Ensure mix of:
   - Single-tool vs. composite suggestions
   - Micro (in-situ) vs. macro (peripheral) scope
   - HTML-dependent vs. instance-dependent tasks

#### **Tricky #4**: Baseline Comparison

**Approach: WebSeek vs. Generic GPT-4 Agent**

**Baseline Configuration**:
- Model: GPT-4 (same as WebSeek's backend)
- Prompt: Generic function-calling prompt with tool definitions
- Context: **Identical** to WebSeek (HTML, instances, logs)
- Tools: **Same 11 macro tools** from WebSeek

**Key Difference**: 
- **WebSeek**: Uses domain-specific prompts with embedded heuristic rules
- **Baseline**: Generic "You are a helpful assistant with these tools..."

**Comparison Metrics**:
- Tool selection accuracy (Precision, Recall, F1)
- Parameter correctness rate
- Sequence efficiency (step count)
- Task success rate

**Why This Is Fair**:
- Same underlying LLM capability
- Same available tools
- Isolates the value of WebSeek's specialized prompt engineering and rule embedding

#### **Tricky #5**: System Prompt Differences

**Solution: Create Two Prompt Variants**

**Technical Evaluation Prompt** (`prompts-eval.ts`):
```typescript
export const promptProactiveEvaluation = (...) => `
You are WebSeek's proactive AI assistant in technical evaluation mode.
Given a static user workflow snapshot, generate the optimal tool sequence 
to achieve the user's goal.

**Available Tools**: [11 macro tools]
**Context**: HTML, instances, logs, conversation history
**Output**: JSON with tool_sequence array

Focus on:
1. Correctness: Valid tool selection and parameters
2. Efficiency: Minimal steps to achieve goal
3. Context awareness: Use provided HTML/instances appropriately
...
`;
```

**User Study Prompt** (existing `promptSuggest`):
- More conversational tone
- Emphasizes user collaboration
- Includes real-time context updates

**Justification in Paper**: "For technical evaluation, we used a prompt optimized for deterministic plan generation. Our user study employed a more collaborative prompt to encourage dialogue, without changing the core tool-based functionality."

#### **Tricky #6**: Task Generation Prompt

**Two-Stage Generation Process**:

**Stage 1: Automated Task Generation** (GPT-4)
```
Generate 100 diverse data-driven decision-making tasks for WebSeek evaluation.
Requirements:
- Real-world scenarios (e-commerce, research, comparison shopping)
- Cover 5 categories with specified difficulty distribution
- Must be solvable with WebSeek's 11 macro tools
- Include URLs to actual public websites (Amazon, Wikipedia, etc.)

Output format: JSON array of tasks with goal, URL, context, golden_sequence
```

**Stage 2: Expert Refinement** (Human)
- Two experts review generated tasks
- Validate golden tool sequences
- Ensure HTML contexts are realistic
- Adjust difficulty labels if needed
- Add alternative valid sequences where applicable

---

## 4. Evaluation Metrics

### 4.1 Primary Metrics

**Plan Correctness** (Sequence-Level)
- **Tool Selection F1 Score**: $F1 = 2 \cdot \frac{Precision \cdot Recall}{Precision + Recall}$
  - Precision: % of WebSeek's tools that match golden sequence
  - Recall: % of golden sequence tools predicted by WebSeek
- **Perfect Match Rate**: % of tasks where WebSeek's sequence exactly matches golden sequence

**Parameter Accuracy** (Tool-Level)
- **Required Parameter Completeness**: % of required params provided
- **Parameter Correctness**: % of params with correct values
- **instanceId Accuracy**: % of correct instance references (critical for WebSeek)
- **Column Name Accuracy**: % of correct column references in table operations

**Task Success** (Outcome-Level)
- **Execution Success Rate**: % of sequences that execute without errors
- **Final State Match**: Structural similarity to golden final state
- **Goal Achievement Score**: LLM-as-judge rating (0-5 scale)

### 4.2 Secondary Metrics

**Efficiency Metrics**
- **Step Count Difference**: $|steps_{WebSeek} - steps_{golden}|$
- **Redundancy Rate**: % of unnecessary tool calls
- **Tool Diversity**: Variety of tools used across tasks

**Robustness Metrics**
- **Error Handling**: % of tasks with graceful failure handling
- **Alternative Path Coverage**: # of valid alternative sequences generated

**Comparative Metrics** (WebSeek vs. Baseline)
- **Accuracy Gain**: $\Delta F1 = F1_{WebSeek} - F1_{Baseline}$
- **Efficiency Gain**: $\Delta steps = steps_{Baseline} - steps_{WebSeek}$
- **Win/Tie/Loss Distribution**: Task-by-task comparison

### 4.3 LLM-as-Judge Scoring

Following ProactiveVA's approach:
- **Evaluator**: GPT-4 (DeepSeek R1 as alternative)
- **Criteria** (0-5 scale each):
  1. **Task Completion**: Covers all required steps for the goal
  2. **Data Accuracy**: Correct parameters, references, and operations
  3. **Path Efficiency**: No redundant or incorrect steps

**Human Validation**:
- Two experts score 20% of tasks independently
- Compare LLM ratings vs. human ratings (correlation analysis)
- Validate LLM as reliable automated evaluator

---

## 5. Experimental Setup

### 5.1 Sandbox Testing System

**Architecture**:
```
┌─────────────────────────────────────────────┐
│         Evaluation Orchestrator             │
│  (Python: evaluation_runner.py)            │
└─────────────────────────────────────────────┘
           ↓ Sequential Task Injection
┌─────────────────────────────────────────────┐
│       WebSeek Proactive Engine              │
│  (TypeScript: proactive-service-enhanced)   │
└─────────────────────────────────────────────┘
           ↓ Tool Sequence Output
┌─────────────────────────────────────────────┐
│         Tool Executor (Sandbox)             │
│  (Dry-run mode: validate, don't execute)   │
└─────────────────────────────────────────────┘
           ↓ Results Logging
┌─────────────────────────────────────────────┐
│       Metrics Calculator + LLM Judge        │
└─────────────────────────────────────────────┘
```

**Key Components**:
1. **Task Loader**: Reads benchmark JSON, creates context objects
2. **Suggestion Generator**: Calls WebSeek's `generateAIDrivenSuggestions`
3. **Tool Validator**: Checks tool calls against `macro-tools.ts` schema
4. **Sequence Comparator**: Compares generated vs. golden sequences
5. **LLM Judge**: Scores task completion, accuracy, efficiency

### 5.2 Baseline Implementation

**Baseline Prompt**:
```typescript
export const promptBaselineAgent = (...) => `
You are a helpful AI assistant with access to data manipulation tools.
The user has a data task on a webpage. Generate a sequence of tool calls 
to achieve their goal.

Available Tools:
[Same 11 macro tools as WebSeek]

Context:
- Current webpage HTML: {html_context}
- Existing data instances: {instances}
- User's goal: {goal_description}

Output a JSON array of tool calls: [{function: "toolName", parameters: {...}}]
`;
```

**Fair Comparison Ensured**:
- Same LLM model (GPT-4)
- Same tool definitions
- Same context inputs
- Different: No domain-specific rules embedded in prompt

### 5.3 Execution Protocol

**For Each Task (100 iterations)**:
1. Load task context (HTML, instances, goal)
2. **WebSeek Path**:
   - Call `generateAIDrivenSuggestions()` with context
   - Record: tool_sequence, execution_time, step_count
3. **Baseline Path**:
   - Call GPT-4 with baseline prompt
   - Record: tool_sequence, execution_time, step_count
4. **Validation**:
   - Validate tool calls against schema
   - Compare with golden sequence
   - Execute in sandbox (dry-run to check validity)
5. **LLM Judging**:
   - Submit task + generated sequences to GPT-4 judge
   - Collect 3 scores (completion, accuracy, efficiency)
6. **Logging**:
   - Save all inputs, outputs, timestamps to JSON

**Total Execution Time Estimate**: 
- 100 tasks × 2 systems × ~30s per call = ~100 minutes
- With parallel execution: ~30-40 minutes

---

## 6. Expected Results & Analysis

### 6.1 Hypotheses

**H1**: WebSeek achieves >80% tool selection F1 score (demonstrates reliability)  
**H2**: WebSeek outperforms baseline by >15% in F1 score (demonstrates specialization value)  
**H3**: WebSeek generates more efficient sequences (fewer steps) than baseline  
**H4**: Performance varies by task category (higher accuracy for extraction, lower for visualization)

### 6.2 Analysis Plan

**Quantitative Analysis**:
- **Overall Performance Table**: 
  | Metric | WebSeek | Baseline | Δ | p-value |
- **Per-Category Breakdown**: Performance by task category
- **Difficulty Analysis**: Accuracy vs. task difficulty (Easy/Medium/Hard)
- **Tool Usage Distribution**: Which tools are most accurately predicted

**Qualitative Analysis**:
- **Failure Mode Analysis**: Categorize common error types
  - Wrong tool selection
  - Incorrect parameters
  - Missing context utilization
  - Redundant steps
- **Success Case Studies**: Highlight 3-5 exemplary predictions
- **Baseline Comparison**: Where does WebSeek add value?

**Statistical Tests**:
- Paired t-test for WebSeek vs. Baseline F1 scores
- Cohen's d for effect size
- Bootstrap confidence intervals for metrics

### 6.3 Addressing Reviewer Concerns

**2AC's Concern**: "No technical evaluation, wondering what gaps remain"

**Our Response**:
1. **Quantified Reliability**: "WebSeek achieves X% tool selection accuracy, demonstrating reliable planning for data tasks"
2. **Identified Gaps**: "Analysis reveals challenges in [specific scenarios], suggesting future work on [improvements]"
3. **Baseline Comparison**: "WebSeek's specialized framework provides Y% improvement over generic agents"

**2AC's Concern**: "How often are proactive suggestions useful?"

**Our Response** (combined with user study):
1. **Technical Study**: "X% of generated suggestions meet correctness criteria"
2. **User Study**: "Participants accepted Y% of suggestions, with Z satisfaction rating"
3. **Combined Insight**: "High technical accuracy + user acceptance validates framework utility"

---

## 7. Implementation Roadmap

### Phase 1: Infrastructure Setup (Week 1)
- [ ] Create `algorithm_evaluation/` directory structure
- [ ] Implement task loader (`task_loader.ts`)
- [ ] Implement baseline prompt (`prompts-baseline.ts`)
- [ ] Create evaluation orchestrator (`evaluation_runner.py`)
- [ ] Set up logging and data collection

### Phase 2: Benchmark Creation (Week 1-2)
- [ ] Generate initial 150 tasks with GPT-4
- [ ] Expert review and refinement (2 experts)
- [ ] Create golden tool sequences
- [ ] Validate HTML contexts and instance states
- [ ] Finalize 100-task benchmark

### Phase 3: Evaluation Execution (Week 2)
- [ ] Run WebSeek on all 100 tasks
- [ ] Run baseline on all 100 tasks
- [ ] Validate tool calls and sequences
- [ ] Execute LLM-as-judge scoring
- [ ] Collect human scores for 20 tasks

### Phase 4: Analysis & Reporting (Week 3)
- [ ] Calculate all metrics (F1, accuracy, efficiency)
- [ ] Statistical analysis (t-tests, effect sizes)
- [ ] Failure mode categorization
- [ ] Generate visualizations (bar charts, heatmaps)
- [ ] Write results section for paper

### Phase 5: Paper Integration (Week 3-4)
- [ ] Write technical evaluation section (3-4 pages)
- [ ] Create results table and figures
- [ ] Update related work to cite ProactiveVA
- [ ] Revise abstract and contributions
- [ ] Prepare rebuttal addressing 2AC's concerns

---

## 8. Deliverables

### For Paper Submission
1. **Section 5: Technical Evaluation** (3-4 pages)
   - Methodology description
   - Results table with metrics
   - Per-category performance breakdown
   - Baseline comparison analysis
   - Failure mode discussion
   
2. **Supplementary Materials**
   - Full benchmark dataset (JSON)
   - Evaluation results (all 100 tasks)
   - Human expert annotations
   - Code repository for reproduction

### For Reviewers
- **Addresses 2AC**: Direct evidence of system reliability and gaps
- **Addresses Baseline Concern**: Quantitative comparison with generic agent
- **Strengthens Contributions**: Technical validation + user study = comprehensive evaluation

---

## 9. Limitations & Future Work

**Acknowledged Limitations**:
1. Static snapshots don't capture real-time interaction dynamics
2. Evaluation focused on tool sequence generation, not end-to-end execution
3. Benchmark tasks may not cover all edge cases in real-world usage
4. LLM-as-judge may have biases (partially validated with human scoring)

**Future Directions**:
1. **Live Execution Evaluation**: Run generated sequences in actual browser environments
2. **User Interaction Study**: Compare technical predictions with user acceptance in real tasks
3. **Longitudinal Analysis**: Track system performance improvements over time
4. **Cross-Domain Generalization**: Test on domains beyond e-commerce (academic research, etc.)

---

## 10. Success Criteria

This evaluation will be considered successful if:

✅ **Criterion 1**: WebSeek achieves ≥80% tool selection F1 score (demonstrates reliability)  
✅ **Criterion 2**: WebSeek significantly outperforms baseline (p < 0.05, Cohen's d > 0.5)  
✅ **Criterion 3**: Failure analysis identifies <5 major error categories (actionable insights)  
✅ **Criterion 4**: Results provide clear response to 2AC's concerns in rebuttal  
✅ **Criterion 5**: Human-LLM judge correlation ≥0.7 (validates automated evaluation)

**Impact on Paper**: This evaluation transforms the paper from "promising system with user validation" to "technically robust framework with empirical validation + user acceptance."

---

## Appendix A: File Structure

```
algorithm_evaluation/
├── README.md
├── TECHNICAL_EVALUATION_PLAN.md (this file)
├── data/
│   ├── benchmark_tasks.json (100 tasks)
│   ├── golden_sequences.json (expert annotations)
│   └── html_contexts/ (annotated HTML files)
├── src/
│   ├── task_loader.ts
│   ├── evaluation_runner.py
│   ├── prompts-baseline.ts
│   ├── prompts-eval.ts (technical evaluation variant)
│   ├── tool_validator.ts
│   ├── sequence_comparator.ts
│   └── llm_judge.ts
├── results/
│   ├── webseek_outputs.json
│   ├── baseline_outputs.json
│   ├── metrics.json
│   └── analysis_report.md
└── scripts/
    ├── generate_tasks.py
    ├── run_evaluation.sh
    └── analyze_results.py
```

---

## Appendix B: Example Benchmark Task

```json
{
  "task_id": "TASK_042",
  "task_category": "Extraction & Wrangling",
  "difficulty": "Medium",
  "goal_description": "Extract all camera products from this Amazon page, clean the price column to remove dollar signs, and sort by price (lowest to highest).",
  
  "starting_url": "https://www.amazon.com/s?k=digital+camera&crid=3HNXQJZQZ5Z5J",
  "html_context": "<div class='s-result-item' data-aid-id='aid-001'><h2 data-aid-id='aid-002'>Canon EOS R50</h2><span class='a-price' data-aid-id='aid-003'>$679.00</span></div>...",
  
  "initial_canvas_state": {
    "instances": [
      {
        "id": "first_camera",
        "type": "text",
        "content": "Canon EOS R50",
        "source": {"type": "web", "pageId": "page_001", "locator": "aid-002"}
      }
    ],
    "focus_instance_id": null
  },
  
  "conversation_history": [],
  "recent_logs": [
    "User navigated to Amazon camera page",
    "User selected product name 'Canon EOS R50'",
    "User dragged product to canvas"
  ],
  
  "golden_tool_sequence": [
    {
      "function": "extractBatch",
      "parameters": {
        "pageId": "page_001",
        "elementsSelector": "[data-aid-id^='aid-']",
        "createTableWithColumns": ["Product Name", "Price"]
      }
    },
    {
      "function": "convertColumnType",
      "parameters": {
        "instanceId": "extracted_products_table",
        "columnName": "B",
        "targetType": "numerical",
        "cleaningPattern": "[\\$,]",
        "replaceWith": ""
      }
    },
    {
      "function": "tableSort",
      "parameters": {
        "instanceId": "extracted_products_table",
        "columnName": "B",
        "order": "asc"
      }
    }
  ],
  
  "golden_final_state": {
    "instances": [
      {
        "id": "extracted_products_table",
        "type": "table",
        "rows": 16,
        "cols": 2,
        "columnNames": ["Product Name", "Price"],
        "columnTypes": ["categorical", "numeral"]
      }
    ]
  },
  
  "expected_complexity": 3,
  "requires_html_analysis": true,
  "requires_instance_analysis": true
}
```

---

**End of Technical Evaluation Plan**
