# Technical Evaluation Plan - Executive Summary

**Date**: November 17, 2025  
**Prepared for**: WebSeek paper revision responding to 2AC reviewer comments

---

## Problem Statement

**2AC's Concern**: "The evaluation had two main limitations -- the first is there was no technical evaluation, which leaves me wondering to what extent the operations that are in theory supported truly work or what gaps remain... I also don't understand how often the proactive suggestions are useful or not."

## Proposed Solution

Conduct a **batch simulation technical evaluation** (inspired by *ProactiveVA*, TVCG 2025) to measure WebSeek's AI-driven proactive guidance capabilities.

### What We Evaluate
✅ **WebSeek's proactive reasoning engine** - Can it generate correct tool sequences?  
✅ **System specialization value** - Does domain-specific design outperform generic agents?  
✅ **Guidance quality** - How accurate, efficient, and contextually appropriate are suggestions?

### What We DON'T Evaluate  
❌ **Web scraping reliability** (element locators, DOM stability)  
❌ **Real-time interaction dynamics** (covered by user study)  
❌ **LLM's general capabilities** (not our contribution)

---

## Methodology Overview

### Benchmark Design
- **100 tasks** across 5 categories (Discovery, Extraction & Wrangling, Profiling & Cleaning, Modeling & Visualization, Composite)
- **3 difficulty levels** (Easy: 1-2 tools, Medium: 3-4 tools, Hard: 5+ tools)
- **Real-world scenarios** (comparison shopping, research, data analysis)
- **Static context snapshots** (HTML, instances, logs) - sacrifice real-time reactivity for reproducibility

### Ground Truth
- **Expert-annotated tool sequences** using WebSeek's 11 macro tools
- **2 expert annotators** with inter-annotator agreement validation
- **Alternative valid sequences** allowed (multiple correct solutions)

### Baseline Comparison
- **Generic GPT-4 agent** with same tools, same context
- **Key difference**: WebSeek uses domain-specific prompts with embedded heuristic rules
- **Fair comparison**: Isolates value of WebSeek's specialized framework

### Evaluation Metrics
- **Tool Selection F1 Score** - Precision, recall, perfect match rate
- **Parameter Accuracy** - Required params, correct values, instance references
- **Task Success Rate** - Execution validity and goal achievement
- **Efficiency** - Step count, redundancy rate
- **LLM-as-Judge Scoring** - Task completion, data accuracy, path efficiency (0-5 scale)

---

## Expected Outcomes

### Hypotheses
- **H1**: WebSeek achieves >80% F1 score (demonstrates reliability)
- **H2**: WebSeek outperforms baseline by >15% (demonstrates specialization value)
- **H3**: WebSeek generates more efficient sequences (fewer steps)
- **H4**: Performance varies by category (strengths/weaknesses identified)

### Deliverables for Paper
1. **Technical Evaluation Section** (3-4 pages)
   - Methodology description
   - Results table with metrics
   - Per-category performance breakdown
   - Baseline comparison analysis
   - Failure mode discussion

2. **Supplementary Materials**
   - Full benchmark dataset (100 tasks)
   - Evaluation results (all outputs)
   - Human expert annotations
   - Code repository for reproduction

### Response to Reviewers
- **Addresses 2AC's first concern**: "We conducted a technical evaluation on 100 benchmark tasks, achieving X% tool selection accuracy with Y identified gaps..."
- **Addresses baseline concern**: "Compared to generic GPT-4 agents, WebSeek's specialized framework provides Z% improvement (p < 0.05)..."
- **Strengthens contributions**: Technical validation + user study = comprehensive evaluation

---

## Implementation Status

### ✅ Completed
- [x] Comprehensive methodology designed
- [x] Evaluation infrastructure scaffolded
- [x] Type definitions created
- [x] Task generator prompt written
- [x] Baseline agent prompt created
- [x] Sequence comparator implemented
- [x] Evaluation orchestrator structured
- [x] Implementation guide documented

### ⚙️ In Progress (Needs Your Action)
- [ ] **WebSeek integration** - Choose implementation approach:
  - **Option A** (Recommended): Node.js subprocess
  - **Option B**: REST API wrapper
  - **Option C**: Direct TypeScript execution
  
- [ ] **Baseline agent implementation** - Python OpenAI API call
- [ ] **Metrics calculation integration** - Connect Python ↔ TypeScript
- [ ] **Task generation execution** - Run GPT-4 to create 100 tasks
- [ ] **Expert review process** - 2 experts validate tasks

### 📋 TODO
- [ ] Run evaluation (WebSeek + Baseline on 100 tasks)
- [ ] Calculate metrics and statistical tests
- [ ] Generate visualizations (comparison plots, category breakdowns)
- [ ] Write paper section (3-4 pages)
- [ ] Prepare supplementary materials
- [ ] Revise abstract and contributions
- [ ] Draft rebuttal addressing 2AC's concerns

---

## Critical Validation Points

### Plan Validation ✅
The AI agent's proposed plan is **fundamentally sound** with these adjustments:

**✅ Correct**:
- Static snapshot approach (realistic trade-off)
- ProactiveVA-inspired methodology (appropriate reference)
- Tool sequence evaluation (matches WebSeek's architecture)
- Baseline comparison (addresses reviewer concern)
- LLM-as-judge scoring (validated approach)

**⚠️ Adjusted**:
- **Tool set**: WebSeek uses 11 MACRO_TOOLS, not arbitrary "Table 3" tools
- **Output format**: WebSeek generates `toolCall`/`toolSequence` suggestions
- **System prompts**: Technical eval prompt vs. user study prompt (justified difference)

### Key Insights from Codebase Analysis

1. **WebSeek's Guidance Architecture**:
   - Uses `proactive-service-enhanced.ts` with AI-driven suggestions
   - Employs trigger rules from `trigger-engine.ts` (15+ heuristic patterns)
   - Generates macro (peripheral) and micro (in-situ) suggestions
   - Tools defined in `macro-tools.ts` (11 functions for data manipulation)

2. **Evaluation Alignment**:
   - Technical eval tests the same reasoning engine used in real system
   - Simulated context matches actual context structure (HTML, instances, logs)
   - Tool sequences in benchmark match actual suggestion format

3. **Fair Baseline Design**:
   - Baseline uses same LLM model (GPT-4)
   - Baseline gets same tools (11 MACRO_TOOLS)
   - Baseline gets same context inputs
   - **Only difference**: Generic prompt vs. WebSeek's specialized prompt with embedded rules

---

## Timeline & Effort Estimate

| Phase | Duration | Effort | Description |
|-------|----------|--------|-------------|
| **1. Infrastructure** | 3-4 days | High | Implement WebSeek integration, baseline agent, metrics calculator |
| **2. Task Generation** | 2-3 days | Medium | Generate 150 tasks with GPT-4, expert review to 100 final |
| **3. Evaluation** | 1 day | Low | Run automated evaluation (30-60 min runtime, mostly waiting) |
| **4. Analysis** | 2-3 days | Medium | Calculate metrics, create visualizations, analyze failure modes |
| **5. Paper Writing** | 3-4 days | High | Write 3-4 page section, revise abstract, prepare rebuttal |
| **Total** | **~2 weeks** | | From implementation to paper submission |

---

## Success Criteria

This evaluation succeeds if:

✅ **Criterion 1**: WebSeek achieves ≥80% F1 score → Demonstrates reliability  
✅ **Criterion 2**: WebSeek vs. Baseline: p < 0.05, Cohen's d > 0.5 → Statistically significant improvement  
✅ **Criterion 3**: <5 major error categories identified → Actionable insights for future work  
✅ **Criterion 4**: Results provide clear, data-backed response to 2AC concerns  
✅ **Criterion 5**: Human-LLM judge correlation ≥0.7 → Validates automated evaluation

**Impact**: Transforms paper from "promising system" to "technically robust + user-validated framework"

---

## Files Created

### Core Documentation
- `TECHNICAL_EVALUATION_PLAN.md` - Complete 50+ page methodology
- `README.md` - Quick start guide
- `IMPLEMENTATION_GUIDE.md` - Step-by-step implementation instructions
- `EXECUTIVE_SUMMARY.md` - This file

### Source Code
- `src/types.ts` - TypeScript type definitions
- `src/task-generator.ts` - GPT-4 task generation with prompt
- `src/prompts-baseline.ts` - Baseline agent prompt and API caller
- `src/sequence-comparator.ts` - Metrics calculation algorithms

### Scripts
- `scripts/evaluation_runner.py` - Main orchestrator (needs implementation)

### Directory Structure
```
algorithm_evaluation/
├── TECHNICAL_EVALUATION_PLAN.md    ← Full methodology
├── IMPLEMENTATION_GUIDE.md         ← How to implement
├── EXECUTIVE_SUMMARY.md            ← This file
├── README.md                       ← Quick start
├── data/                           ← Benchmark tasks (to be generated)
├── src/                            ← Evaluation code (partially implemented)
├── results/                        ← Outputs (created during run)
└── scripts/                        ← Automation scripts (needs completion)
```

---

## Next Steps for You

### Immediate Actions (Today)

1. **Review this plan** - Ensure it aligns with your paper's contributions and reviewer concerns
2. **Clarify "Table 3"** - Confirm if it refers to MACRO_TOOLS or different operators
3. **Choose integration approach** - Decide on Option A (subprocess), B (API), or C (direct execution)

### This Week

4. **Implement WebSeek integration** - Follow `IMPLEMENTATION_GUIDE.md` Step 1
5. **Implement baseline agent** - Follow `IMPLEMENTATION_GUIDE.md` Step 2
6. **Test with 5 sample tasks** - Validate the pipeline works end-to-end

### Next Week

7. **Generate benchmark tasks** - Run task generator, expert review
8. **Run full evaluation** - Execute on all 100 tasks
9. **Analyze results** - Calculate metrics, create visualizations

### Week After

10. **Write paper section** - 3-4 pages with results
11. **Prepare rebuttal** - Address 2AC's concerns with data
12. **Submit revision** - Updated paper + supplementary materials

---

## Questions to Resolve

Before proceeding with full implementation, please confirm:

1. **Tool Set Alignment**: Does "Table 3" in your paper refer to the 11 MACRO_TOOLS, or different low-level operators?
   - If different: We need to adjust the evaluation to match paper's claims
   - If same: We're aligned and can proceed as planned

2. **Evaluation Scope Approval**: Are you comfortable with evaluating tool sequence generation (not full end-to-end execution)?
   - This is the right scope given ProactiveVA precedent
   - User study covers end-to-end utility

3. **Timeline Feasibility**: Can you commit 2 weeks to this evaluation before paper deadline?
   - Most time-consuming: Expert task review (2-3 days)
   - Most critical: WebSeek integration (3-4 days)

4. **Expert Availability**: Do you have 2 data analysis experts available for task annotation?
   - Need ~4-6 hours each for reviewing 100 tasks
   - Inter-annotator agreement validation required

5. **OpenAI API Budget**: Evaluation will cost ~$50-100 in API fees
   - 100 tasks × 2 systems × $0.03-0.05 per call
   - Plus task generation and LLM judging

---

## Approval Decision

**Review this plan and respond with one of:**

✅ **APPROVED - Proceed with implementation**
- I confirm the plan aligns with our paper
- I'm ready to commit 2 weeks to this evaluation
- Please proceed with implementation following the guide

⚠️ **APPROVED WITH MODIFICATIONS**
- The plan is good but needs these changes: [specify]
- Please update the plan before implementation

❌ **NOT APPROVED - Alternative approach needed**
- This plan doesn't align with our goals because: [specify]
- Let's discuss alternative evaluation strategies

---

## Contact & Support

For questions during implementation:
- **Methodology**: Review `TECHNICAL_EVALUATION_PLAN.md`
- **Implementation**: Follow `IMPLEMENTATION_GUIDE.md`
- **Technical issues**: Check troubleshooting section in guide

**Ready to proceed?** Start with implementation Step 1 in `IMPLEMENTATION_GUIDE.md`
