# Task Generator V2 - Complete Revision Summary

## 🎯 What Changed

### 1. ✅ **starting_url is now an ARRAY**
**Before (V1)**:
```json
"starting_url": "https://www.amazon.com/s?k=digital+camera"
```

**After (V2)**:
```json
"starting_url": ["https://www.amazon.com/s?k=digital+camera"]
```

**For multi-page tasks**:
```json
"starting_url": [
  "https://www.amazon.com/s?k=digital+camera",
  "https://www.ebay.com/sch/i.html?_nkw=used+camera"
]
```

**Why**: Supports tasks that require data from multiple webpages (e.g., price comparison, data merging)

---

### 2. ✅ **html_context field REMOVED from generator**
**Before (V1)**: Generator creates synthetic HTML context
```json
"html_context": "<div class='s-result-list'>... synthetic HTML ...</div>"
```

**After (V2)**: Field removed completely, will be filled by post-processor
```json
// NO html_context field in generated tasks
```

**Post-processing script** (to be created):
```javascript
// Read task's starting_url array
// For each URL, load corresponding HTML file
// Fill html_context with actual raw HTML from files
// This ensures 100% alignment with controlled webpages
```

**Why**: Eliminates mismatch between synthetic HTML and actual controlled webpages

---

### 3. ✅ **20 Diverse Controlled Webpages (not 6)**

**Old Pages (V1)**:
1. Amazon Cameras
2. eBay Cameras
3. Wikipedia Countries
4. IMDb Movies
5. Kaggle Datasets
6. GitHub Repos

**New Pages (V2)** - Added 14 more diverse pages:
7. **Twitter Trending** - Social media trends
8. **LinkedIn Jobs** - Job postings
9. **Weather Forecast** - 10-day weather data
10. **Reddit r/dataisbeautiful** - Social media posts
11. **Zillow Homes** - Real estate listings
12. **Indeed Salaries** - Salary comparison
13. **ESPN NBA** - Sports league standings
14. **Olympic Medals** - Medal rankings
15. **Yahoo Finance** - Stock quotes
16. **Yelp Restaurants** - Local business reviews
17. **Google Scholar** - Academic papers
18. **Goodreads Books** - Book ratings
19. **Election Results** - Vote counts by state
20. **Coinbase Crypto** - Cryptocurrency prices

**Why**: Better coverage of real-world domains beyond just product comparisons

---

### 4. ✅ **openPage Tasks Reference Controlled Pages Only**

**Before (V1)**: Tasks referenced external sites
```json
{
  "task_category": "discovery",
  "starting_url": "https://www.google.com",
  "golden_tool_sequence": [{
    "function": "openPage",
    "parameters": {
      "url": "https://www.marketresearch.com/...",  // ❌ External site!
      "description": "Market research reports"
    }
  }]
}
```

**After (V2)**: Tasks navigate between controlled pages
```json
{
  "task_category": "discovery",
  "starting_url": ["https://www.amazon.com/s?k=digital+camera"],
  "golden_tool_sequence": [{
    "function": "openPage",
    "parameters": {
      "url": "https://www.ebay.com/sch/i.html?_nkw=used+camera",  // ✓ Controlled page!
      "description": "Open eBay to compare used camera prices with Amazon"
    }
  }]
}
```

**Example scenarios**:
- Analyzing Amazon → Suggest opening eBay for price comparison
- Reviewing LinkedIn jobs → Suggest opening Indeed salaries for compensation data
- Extracted IMDb movies → Suggest opening Goodreads books for related content

**Why**: All task execution stays within controlled evaluation environment

---

### 5. ✅ **WebSeek Type System Documentation Included**

Added comprehensive type system docs to generator prompt:

**Instance Types** (from types.tsx):
- BaseInstance (all instances extend this)
- TextInstance, ImageInstance, TableInstance, SketchInstance, VisualizationInstance
- InstanceSource (WebCaptureSource vs ManualSource)
- EmbeddedInstance types for table cells

**Message Format** (from types.tsx):
- Message interface structure
- @[InstanceId] reference syntax
- Conversation examples showing user references

**Example**:
```json
"conversation_history": [
  {
    "role": "user",
    "message": "I started extracting cameras into @ProductTable. Can you complete it?"
  }
]
```

**Why**: Generator now produces correctly formatted canvas states and conversations

---

### 6. ✅ **Non-Empty Canvas and Conversation States**

**Before (V1)**: All tasks had empty states
```json
"initial_canvas_state": {
  "instances": [],  // Always empty
  "focus_instance_id": null
},
"conversation_history": []  // Always empty
```

**After (V2)**: Varies by difficulty

**Easy tasks**: Empty (start from scratch)
```json
"initial_canvas_state": {
  "instances": [],
  "focus_instance_id": null
},
"conversation_history": []
```

**Medium tasks**: Partial work (30-50% complete)
```json
"initial_canvas_state": {
  "instances": [{
    "id": "ProductTable",
    "type": "table",
    "rows": 2,
    "cols": 3,
    "columnNames": ["Product", "Price", "Rating"],
    "columnTypes": ["categorical", "numeral", "numeral"],
    "cells": [/* 2 sample rows */],
    "source": {"type": "manual"}
  }],
  "focus_instance_id": "ProductTable"
},
"conversation_history": [
  {
    "role": "user",
    "message": "I started extracting products into @ProductTable. Can you complete it with all 20 items?"
  }
]
```

**Hard tasks**: Substantial work (50-70% complete)
```json
"initial_canvas_state": {
  "instances": [
    {/* Table1 with data */},
    {/* Table2 with data */},
    {/* Visualization with issues */}
  ],
  "focus_instance_id": "Table1"
},
"conversation_history": [
  {"role": "user", "message": "I extracted data into @Table1 and @Table2"},
  {"role": "assistant", "message": "I see you have product data from both Amazon and eBay."},
  {"role": "user", "message": "@Table1 has formatting issues in the Price column. Can you clean it and then merge with @Table2?"}
]
```

**Why**: Creates more realistic evaluation scenarios matching actual user workflows

---

## 📊 Task Distribution Changes

**V1 Distribution** (6 pages, 50 tasks):
- Amazon: 8 tasks (16%)
- Wikipedia: 8 tasks (16%)
- IMDb: 8 tasks (16%)
- eBay: 6 tasks (12%)
- Kaggle: 6 tasks (12%)
- GitHub: 6 tasks (12%)
- Cross-page: 6 tasks (12%)
- Discovery: 2 tasks (4%)

**V2 Distribution** (20 pages, 50 tasks):
- **Major pages** (5 tasks each): Amazon, Wikipedia, IMDb
- **Medium pages** (3 tasks each): eBay, LinkedIn, Yahoo Finance, Zillow
- **Standard pages** (2 tasks each): Twitter, Reddit, Weather, Indeed, ESPN, Olympics, Kaggle, GitHub
- **Light pages** (1 task each): Yelp, Scholar, Goodreads, Election, Coinbase
- **Cross-page**: 2 tasks
- **Discovery**: 2 tasks

**More balanced coverage** across diverse domains

---

## 🔧 Technical Implementation Changes

### Generator Prompt Changes

**Added to prompt**:
1. TYPE_SYSTEM_DOCS constant (500+ lines of type definitions)
2. Canvas generation guidelines based on difficulty
3. Available controlled pages list for discovery tasks
4. Instructions to return starting_url as array
5. Instructions to NOT generate html_context
6. Examples of @[InstanceId] syntax usage

**Removed from prompt**:
- Any mention of "WebSeek" (remain neutral for unbiased evaluation)
- HTML context generation requirements
- Single-page assumptions

### Code Structure Changes

**generate-tasks-v2.mjs**:
- `CONTROLLED_WEBPAGES`: Expanded from 6 to 20 pages
- `TASK_PLAN`: Updated distribution for 50 tasks across 20 pages
- `TYPE_SYSTEM_DOCS`: New constant with full type system documentation
- `generateSingleTask()`: 
  - Returns starting_url as array
  - Removes html_context from generated task
  - Validates starting_url is array
  - Generates canvas/conversation based on difficulty
- Canvas generation logic: Conditional based on difficulty level

---

## 📝 Output Format Changes

### Old Format (V1):
```json
{
  "task_id": "T001",
  "task_category": "extraction",
  "difficulty": "easy",
  "page": "amazon_cameras",
  "goal_description": "Extract camera products...",
  "starting_url": "https://www.amazon.com/...",  // STRING
  "html_context": "<div>... synthetic HTML ...</div>",  // Generated
  "initial_canvas_state": { "instances": [], "focus_instance_id": null },  // Always empty
  "conversation_history": [],  // Always empty
  "recent_logs": ["..."],
  "golden_tool_sequence": [/*...*/],
  "expected_tools": 2
}
```

### New Format (V2):
```json
{
  "task_id": "T001",
  "task_category": "extraction",
  "difficulty": "medium",
  "page": "amazon_cameras",
  "goal_description": "Extract camera products...",
  "starting_url": ["https://www.amazon.com/..."],  // ARRAY
  // NO html_context field (will be added by post-processor)
  "initial_canvas_state": {
    "instances": [{/* Partial work */}],  // Can have content
    "focus_instance_id": "ProductTable"
  },
  "conversation_history": [
    {"role": "user", "message": "Complete @ProductTable..."}  // Can have messages
  ],
  "recent_logs": ["..."],
  "golden_tool_sequence": [/*...*/],
  "expected_tools": 3
}
```

---

## 🚀 Usage Instructions

### Generate Tasks with V2:

```bash
cd algorithm_evaluation
node generate-tasks-v2.mjs
```

**Output**: `data/benchmark_tasks_v2.json`

### Next Steps After Generation:

1. **Review generated tasks**:
   ```bash
   cat data/benchmark_tasks_v2.json | jq '.[] | {task_id, page, difficulty, starting_url}'
   ```

2. **Create 20 HTML snapshot files** (if not exists):
   ```bash
   # Create controlled_webpages/html_snapshots/ directory
   # Generate HTML files for all 20 pages with data-aid-id attributes
   ```

3. **Run post-processor to fill html_context**:
   ```bash
   # To be created: fill-html-context.mjs
   node fill-html-context.mjs data/benchmark_tasks_v2.json
   ```

4. **Manual validation**:
   - Check golden_tool_sequence correctness
   - Verify canvas states are realistic
   - Validate conversation messages use correct @[InstanceId] syntax
   - Ensure starting_url arrays contain correct controlled page URLs

5. **Run evaluation**:
   ```bash
   python scripts/evaluation_runner.py --tasks data/benchmark_tasks_v2.json
   ```

---

## 📋 Validation Checklist

Before running evaluation, verify:

- [ ] All tasks have starting_url as ARRAY (not string)
- [ ] NO tasks have html_context field (generator doesn't create it)
- [ ] Discovery tasks use openPage with controlled page URLs only
- [ ] Cross-page tasks have multiple URLs in starting_url
- [ ] Medium tasks have partial canvas state (1-2 instances)
- [ ] Hard tasks have substantial canvas state (2-4 instances)
- [ ] Conversation history uses @[InstanceId] syntax correctly
- [ ] All instance IDs in messages match actual instance IDs in canvas
- [ ] Golden tool sequences use only available tools from macro-tools.ts
- [ ] All URLs in starting_url are from the 20 controlled pages

---

## 🔄 Migration from V1 to V2

If you have existing V1 tasks, convert with this script:

```javascript
// migrate-v1-to-v2.mjs
import { readFileSync, writeFileSync } from 'fs';

const v1Tasks = JSON.parse(readFileSync('data/benchmark_tasks.json'));
const v2Tasks = v1Tasks.map(task => {
  // Convert starting_url to array
  const starting_url = Array.isArray(task.starting_url) 
    ? task.starting_url 
    : [task.starting_url];
  
  // Remove html_context
  const { html_context, ...taskWithoutHtml } = task;
  
  return {
    ...taskWithoutHtml,
    starting_url
  };
});

writeFileSync('data/benchmark_tasks_v2_migrated.json', JSON.stringify(v2Tasks, null, 2));
console.log(`Migrated ${v2Tasks.length} tasks from V1 to V2 format`);
```

---

## 🐛 Known Issues & Limitations

1. **HTML files need to be created**: The 20 controlled webpage HTML snapshots need to be manually created or scripted
2. **Post-processor needed**: Still need to create `fill-html-context.mjs` to populate html_context from actual HTML files
3. **Validation needed**: Generated canvas states and conversations need manual review for accuracy
4. **LLM limitations**: OpenRouter API may occasionally generate incorrect type structures despite documentation

---

## 📚 Related Documentation

- `WEBPAGE_DESIGN_20.md` - Specifications for all 20 controlled webpages
- `GENERATOR_REVISION_PLAN.md` - Detailed revision plan and rationale
- `types.tsx` - WebSeek type system source of truth
- `prompts.ts` - WebSeek prompt templates showing @[InstanceId] usage
- `macro-tools.ts` - All 16 available tools with full specifications

---

## 💡 Benefits of V2

1. **Better evaluation coverage**: 20 diverse pages vs 6 similar ones
2. **Realistic workflows**: Non-empty canvas states match actual usage
3. **Multi-page support**: starting_url array enables cross-page tasks
4. **Perfect alignment**: html_context from actual HTML (no synthetic mismatch)
5. **Controlled environment**: All URLs within controlled page set
6. **Type safety**: Full type system documentation ensures correct formats
7. **User context**: Conversations with @[InstanceId] references match real interactions

---

## ✅ Summary

**V2 Generator is a MAJOR improvement** addressing all 7 feedback points:
1. ✅ Multi-page support (starting_url as array)
2. ✅ html_context removed (post-processing approach)
3. ✅ No external URLs (all controlled pages)
4. ✅ openPage references controlled pages
5. ✅ 20 diverse webpages (not 6)
6. ✅ Type system documentation included
7. ✅ Realistic canvas and conversation states

**Ready for testing**: Run `node generate-tasks-v2.mjs` to generate improved tasks!
