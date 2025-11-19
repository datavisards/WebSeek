# Technical Evaluation - Implementation Status & Next Steps

## ✅ Completed Work

### 1. Tool Set Alignment (COMPLETE)
- ✅ Updated `macro-tools.ts` to match Table 3 from paper
- ✅ Added 16 tools across 4 categories:
  - **Discovery** (1): openPage
  - **Extraction & Wrangling** (7): selectElements, inferSchema, extractBatch, updateInstance, addComputedColumn, tableSort, tableFilter
  - **Profiling & Cleaning** (5): renameColumn, formatColumn, searchAndReplace, convertColumnType, fillMissingValues  
  - **Visualization** (3 features, 2 tools): createVisualization, tableFilter (dual-use)
- ✅ Removed tools not in Table 3: exportData, duplicateInstance

### 2. Placeholder Implementations (COMPLETE)
- ✅ Created `webpage_placeholders.ts` with hard-coded implementations for:
  - `selectElements` - Returns element counts based on page structure
  - `inferSchema` - Returns schema info for controlled pages
  - `extractBatch` - Simulates batch extraction
  - `addComputedColumn` - Validates formulas and simulates computation
  - `formatColumn` - Validates format patterns and simulates formatting
- ✅ Defined 6 controlled webpage structures (Amazon, Wikipedia, eBay, Kaggle, GitHub, IMDb)
- ✅ Each placeholder returns deterministic outputs for evaluation

### 3. Evaluation Plan Documentation (COMPLETE)
- ✅ `REVISED_PLAN_CONTROLLED_PAGES.md` - Complete plan with controlled webpages
- ✅ `CROSS_PAGE_TASK_RECOMMENDATIONS.md` - 12-15 cross-page task examples
- ✅ Task distribution: 55-60% single-page, 15-20% visualization, 10-15% cross-page, 5% discovery
- ✅ Proposed 7 reference webpages with realistic data quality issues

### 4. Existing Infrastructure (ALREADY BUILT)
- ✅ `macro-tool-executor.ts` - Execution engine for real tools
- ✅ Type definitions in `types.tsx`
- ✅ Validation logic in `macro-tools.ts`
- ✅ Python evaluation runner skeleton in `scripts/evaluation_runner.py`

---

## 📋 Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Approach** | Controlled webpages | Ground truth is reproducible and controllable |
| **# Webpages** | 6-7 reference pages | Supports 100 diverse tasks without webpage variability |
| **Discovery Tasks** | 5% (5 tasks) | Most tasks focus on data work, not discovery |
| **Cross-Page Tasks** | 10-15% (10-15 tasks) | Covers all join types without over-emphasizing merging |
| **Placeholder Tools** | Hard-coded outputs | Allows evaluation without full implementation |
| **Task Source** | You provide pages OR simulated HTML | Either approach works |

---

## 🎯 Next Steps

### Step 1: Finalize Webpage Sources (YOUR INPUT NEEDED)
**Decision Required**: Which approach?

**Option A: You Provide Real Pages**
- Find 6-7 real webpages that match the proposed structures
- Requirements:
  - Amazon product search (20 items, structured data)
  - Wikipedia table (50 rows, clean structure)
  - eBay listings (15 items)
  - Kaggle/GitHub search results
  - IMDb table
- I'll process HTML and add `data-aid-id` attributes

**Option B: I Create Simulated HTML**
- I'll generate realistic HTML snapshots for all 7 pages
- Includes `data-aid-id` attributes for ground truth
- Data will be internally consistent and clean
- Faster to implement, but less "real-world"

**Recommendation**: Option B (simulated) for faster iteration. You can replace with real pages later if needed.

---

### Step 2: Generate 100 Tasks (1-2 days)
Once webpages are decided:

1. **Create task templates** for each page (15-20 tasks per page)
2. **Expert annotation** of golden tool sequences
3. **Validate** placeholder tools work correctly
4. **Document** task descriptions, contexts, expected outputs

**Deliverables**:
- `tasks.json` - 100 annotated tasks with golden sequences
- `task_contexts/` - HTML snapshots for each task
- `validation_report.md` - Inter-annotator agreement stats

---

### Step 3: Implement Evaluation Runner (2-3 days)
Update `scripts/evaluation_runner.py` to:

1. **Load task contexts** from HTML snapshots
2. **Query WebSeek** proactive service with task context
3. **Query baseline GPT-4** with same context + tool docs
4. **Compare** suggestions to golden sequences
5. **Calculate metrics** (F1, precision, recall, parameter accuracy)
6. **Generate report** with results breakdown

**Deliverables**:
- Working Python script
- WebSeek integration completed
- Baseline GPT-4 integration completed
- Metrics calculation validated

---

### Step 4: Run Evaluation & Analyze (1 day)
1. Execute evaluation on all 100 tasks
2. Generate performance report
3. Identify patterns in successes/failures
4. Write paper section with results

**Expected Metrics**:
- **WebSeek F1 Score**: 0.75-0.85 (target)
- **Baseline F1 Score**: 0.50-0.65 (expected)
- **Parameter Accuracy**: 80-90% (WebSeek), 60-70% (baseline)
- **Task Success Rate**: 70-80% (WebSeek), 40-50% (baseline)

---

## 📊 Tool Coverage Strategy

The 100 tasks will ensure:

| Tool | Min Tasks | Coverage Strategy |
|------|-----------|-------------------|
| openPage | 5 | Discovery scenarios |
| selectElements | 15 | Every extraction task starts here |
| inferSchema | 15 | Schema inference before extraction |
| extractBatch | 40 | Core extraction tool, most tasks |
| updateInstance | 5 | Autocomplete scenarios |
| addComputedColumn | 15 | Derived data scenarios |
| tableSort | 30 | Organization step in many tasks |
| tableFilter | 35 | Refinement step in most tasks |
| renameColumn | 10 | Column standardization |
| formatColumn | 10 | Entity normalization |
| searchAndReplace | 15 | Text cleaning scenarios |
| convertColumnType | 20 | Type correction (prices, dates) |
| fillMissingValues | 15 | Missing data handling |
| mergeInstances | 12 | Cross-page joining |
| createVisualization | 20 | Chart creation |

**Total Tool Uses**: ~270 across 100 tasks (avg 2.7 tools/task)

---

## 🚀 Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| **Webpage Sources** | 1 day | Your decision (Option A or B) |
| **Task Generation** | 2 days | Webpages finalized |
| **Expert Annotation** | 2 days | Tasks generated |
| **Evaluation Implementation** | 3 days | - |
| **Evaluation Run** | 1 day | All above complete |
| **Analysis & Writing** | 2 days | Results available |
| **TOTAL** | **~11 days** | |

**Critical Path**: Webpage decision → Task generation → Evaluation run

---

## 💡 Recommendations

### For Rapid Progress:
1. ✅ **Choose Option B** (simulated HTML) - I can generate all 7 pages in 1 hour
2. ✅ **Start with 50 tasks** - Validate approach before generating all 100
3. ✅ **Single annotator first** - Get one complete pass, then second annotator for IAA
4. ✅ **Focus on Table 3 coverage** - Ensure all 16 tools are tested at least once

### For Rigor:
1. ⚠️ **Use real webpages** (Option A) - More authentic but slower
2. ⚠️ **Generate all 100 tasks** - Complete coverage from the start
3. ⚠️ **Two annotators from start** - Higher IAA but slower

---

## ❓ Open Questions

Please clarify:

1. **Webpage source preference**: Option A (real pages) or Option B (simulated)?
2. **Timeline**: Do you need this evaluation complete for the camera-ready deadline, or is it for revision?
3. **Join column flexibility**: Should different column names be accepted as valid (e.g., "Model" vs "Product Name")?
4. **Annotation resources**: Will you annotate golden sequences yourself, or do you have collaborators?

---

## 📝 What I'll Do Next

Based on your preferences, I can immediately:

1. **Generate 7 simulated HTML pages** with `data-aid-id` attributes (30 min)
2. **Create 20 sample tasks** for validation (1 hour)
3. **Implement evaluation runner** WebSeek integration (2 hours)
4. **Run pilot evaluation** on 20 tasks to validate approach (1 hour)

**Total time to pilot**: ~4 hours of work

Then we can iterate before scaling to 100 tasks.

---

## Summary

✅ **Tool alignment complete** - `macro-tools.ts` matches Table 3  
✅ **Placeholder implementations ready** - Deterministic outputs for evaluation  
✅ **Evaluation plan finalized** - Controlled webpages, 100 tasks, clear metrics  
✅ **Infrastructure scaffolded** - Documentation, types, execution engine  

🎯 **Next critical decision**: Choose webpage source (Option A or B)  
🚀 **Then**: Generate tasks → Implement runner → Execute evaluation → Analyze results

Let me know your preferences and I'll proceed immediately!
