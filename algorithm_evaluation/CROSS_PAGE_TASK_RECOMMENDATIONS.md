# Cross-Page Task Recommendations

## Overview

Based on your question about cross-page tasks (joining data from multiple pages), here's my recommendation:

**Suggested: 10-15 cross-page tasks (10-15% of the 100 tasks)**

This provides enough coverage to evaluate:
- `mergeInstances` with different join types
- Complex multi-step workflows
- Real-world data integration scenarios

---

## Distribution Recommendation

| Task Type | Count | % | Tools Emphasized |
|-----------|-------|---|------------------|
| **Single-page extraction & cleaning** | 55-60 | 55-60% | selectElements, extractBatch, inferSchema, formatColumn, searchAndReplace, convertColumnType, fillMissingValues, tableSort, tableFilter |
| **Single-page visualization** | 15-20 | 15-20% | createVisualization, addComputedColumn |
| **Cross-page joining** | 10-15 | 10-15% | mergeInstances (all join types), extractBatch (multiple pages) |
| **Multi-page discovery** | 5 | 5% | openPage |
| **Complex composite workflows** | 5-10 | 5-10% | All tools combined |
| **TOTAL** | **100** | **100%** | All 16 tools from Table 3 |

---

## Why 10-15 Cross-Page Tasks?

### Benefits:
1. **Covers all join types**: inner_join, left_join, right_join, union (4 types × 2-3 tasks each = 8-12 tasks)
2. **Tests complex scenarios**: Price comparison, data consolidation, multi-source aggregation
3. **Validates merge logic**: Column mapping, key matching, handling duplicates
4. **Real-world relevance**: Comparing prices across sites, consolidating datasets

### Not Too Many:
- Most real-world tasks involve working within a single page
- Extraction and cleaning are more common than joining
- Too many join tasks would inflate `mergeInstances` coverage artificially

---

## Cross-Page Task Categories

### Category 1: E-commerce Price Comparison (5 tasks)
**Pages**: Amazon Cameras + eBay Cameras

**Task Example 1** (Easy - Union):
- Extract Canon cameras from Amazon
- Extract Canon cameras from eBay  
- Combine both lists using `mergeInstances` (union strategy)
- **Tools**: extractBatch (×2), tableFilter (×2), mergeInstances (union)

**Task Example 2** (Medium - Inner Join):
- Extract all cameras from Amazon
- Extract all cameras from eBay
- Join on product model using `mergeInstances` (inner_join)
- Calculate price difference with `addComputedColumn`
- **Tools**: extractBatch (×2), mergeInstances (inner_join), addComputedColumn

**Task Example 3** (Hard - Left Join + Cleaning):
- Extract cameras from Amazon (clean price format)
- Extract cameras from eBay (clean price format)
- Left join Amazon with eBay on model name
- Fill missing eBay prices with "Not available"
- Sort by price difference
- **Tools**: extractBatch (×2), convertColumnType (×2), searchAndReplace (×2), mergeInstances (left_join), fillMissingValues, addComputedColumn, tableSort

**Task Example 4** (Medium - Right Join):
- Extract cameras from Amazon
- Extract cameras from eBay
- Right join to find products only on eBay
- Filter for condition = "Excellent"
- **Tools**: extractBatch (×2), mergeInstances (right_join), tableFilter

**Task Example 5** (Hard - Multi-step Comparison):
- Extract Amazon cameras → Clean prices → Filter rating >4.5
- Extract eBay cameras → Clean prices → Filter condition "Excellent"
- Inner join on model
- Compute savings (Amazon - eBay)
- Create scatter plot: Amazon Price vs eBay Price
- **Tools**: extractBatch (×2), convertColumnType (×2), searchAndReplace (×2), tableFilter (×2), mergeInstances (inner_join), addComputedColumn, createVisualization

---

### Category 2: Reference Data Consolidation (3 tasks)
**Pages**: Wikipedia Countries + (simulated) UN Population Database

**Task Example 6** (Easy - Append):
- Extract country data from Wikipedia
- Extract country data from UN database
- Append both datasets using `mergeInstances` (append strategy)
- **Tools**: extractBatch (×2), mergeInstances (append)

**Task Example 7** (Medium - Inner Join):
- Extract Wikipedia country data
- Extract UN demographic data
- Inner join on country name
- Standardize country names with `formatColumn`
- **Tools**: extractBatch (×2), formatColumn (×2), mergeInstances (inner_join)

**Task Example 8** (Hard - Left Join + Missing Data):
- Extract Wikipedia countries → Clean population numbers
- Extract UN growth rate data
- Left join Wikipedia with UN on country code
- Fill missing growth rates with regional median
- Create visualization: Population vs Growth Rate
- **Tools**: extractBatch (×2), convertColumnType, searchAndReplace, mergeInstances (left_join), fillMissingValues, createVisualization

---

### Category 3: Tech Resource Aggregation (2 tasks)
**Pages**: Kaggle Datasets + GitHub Repos

**Task Example 9** (Medium - Union):
- Extract Kaggle climate datasets
- Extract GitHub climate repos
- Combine using union for comprehensive resource list
- Rename columns for consistency
- **Tools**: extractBatch (×2), renameColumn (×2), mergeInstances (union)

**Task Example 10** (Hard - Cross-Reference):
- Extract Kaggle datasets → Filter by tag "climate"
- Extract GitHub repos → Filter by language "Python"
- Create cross-reference table (Cartesian product simulation)
- Add computed column: "Suggested Match" based on keyword overlap
- **Tools**: extractBatch (×2), tableFilter (×2), mergeInstances (append), addComputedColumn

---

### Category 4: Entertainment + E-commerce (2 tasks)
**Pages**: IMDb Movies + Amazon Products (DVDs/Blu-rays)

**Task Example 11** (Medium - Inner Join):
- Extract IMDb top movies
- Extract Amazon movie DVDs
- Inner join on movie title
- Compare IMDB rating vs Amazon rating
- **Tools**: extractBatch (×2), mergeInstances (inner_join), addComputedColumn

**Task Example 12** (Hard - Left Join + Price Analysis):
- Extract IMDb movies from 1990s
- Extract Amazon DVDs
- Left join IMDb with Amazon on title
- Fill missing prices with "Not available"
- Filter for high-rated (>8.5) movies
- Create bar chart: Rating vs Price
- **Tools**: extractBatch (×2), tableFilter, mergeInstances (left_join), fillMissingValues, createVisualization

---

### Category 5: Multi-Source Data Integration (3 tasks)
**Pages**: 3+ pages combined

**Task Example 13** (Hard - Triple Join):
- Extract cameras from Amazon
- Extract cameras from eBay
- Extract camera reviews from (simulated) TechCrunch
- Join Amazon + eBay on model → Join result with reviews
- Compute "Best Deal Score" = (Rating × 10) - Price
- Sort by score
- **Tools**: extractBatch (×3), mergeInstances (×2), addComputedColumn, tableSort

**Task Example 14** (Hard - Aggregation Workflow):
- Extract climate datasets from Kaggle
- Extract climate repos from GitHub
- Extract climate articles from (simulated) ArXiv
- Union all three into "Climate Resources" table
- Add computed column: "Resource Type"
- Create histogram: Resources by Type
- **Tools**: extractBatch (×3), mergeInstances (×2 unions), addComputedColumn, createVisualization

**Task Example 15** (Very Hard - Comprehensive Analysis):
- Extract Wikipedia countries
- Extract Kaggle population datasets
- Extract World Bank economic data (simulated)
- Inner join Wikipedia + Kaggle on country
- Left join result with World Bank on country code
- Fill missing economic indicators with regional median
- Compute "Development Index" from multiple columns
- Create scatter plot: Population vs Development Index
- **Tools**: extractBatch (×3), mergeInstances (×2), fillMissingValues, addComputedColumn, createVisualization

---

## Join Type Coverage

| Join Type | Task Count | Task IDs |
|-----------|------------|----------|
| **union** | 3-4 | 1, 6, 9, 14 |
| **inner_join** | 4-5 | 2, 7, 11, 13 |
| **left_join** | 3-4 | 3, 8, 12, 15 |
| **right_join** | 1-2 | 4 |
| **append** | 2-3 | 6, 10 |

This ensures all 5 join strategies from `mergeInstances` are evaluated.

---

## Why This Distribution Works

### ✅ Strengths:
1. **Balanced coverage**: Tests all join types without over-emphasizing merging
2. **Realistic scenarios**: Mirrors real-world data integration workflows
3. **Difficulty progression**: Easy (2 pages, 2 tools) → Hard (3+ pages, 7+ tools)
4. **Tool diversity**: Cross-page tasks use 8-10 different tools on average

### ⚠️ Considerations:
1. **Webpage availability**: You'll need 6-7 controlled HTML snapshots
2. **Ground truth complexity**: Join tasks have multiple valid solutions (column names, strategies)
3. **Annotation time**: Cross-page tasks take longer to validate than single-page tasks

---

## Final Recommendation

**Start with 12 cross-page tasks** distributed as follows:

- **E-commerce comparison**: 5 tasks (40%)
- **Reference data**: 3 tasks (25%)
- **Tech resources**: 2 tasks (17%)
- **Multi-source**: 2 tasks (17%)

This leaves **88 single-page tasks** to thoroughly test extraction, cleaning, profiling, and visualization tools.

---

## Implementation Notes

### For Task Generation:
1. **Generate task descriptions** first (natural language)
2. **Expert annotation** of golden tool sequences
3. **Validate** that each task can be completed with available tools
4. **Test** placeholder implementations return expected results

### For Evaluation:
1. **WebSeek system** gets task context (2 HTML pages loaded)
2. **Baseline GPT-4** gets same context + tool documentation
3. **Compare** suggested tool sequences to golden sequences
4. **Metrics**: F1 score, parameter accuracy, success rate

---

## Questions to Consider

1. **Do you have 6-7 real webpages** to use, or should I create simulated HTML?
2. **Join column flexibility**: Should we allow different join column names (e.g., "Model" vs "Product Name") as valid alternatives?
3. **Multi-step credit**: If a cross-page task requires 7 tools, does it "count" toward multiple categories, or just one?

Let me know which approach you prefer, and I can proceed with:
- Creating the full 100-task specification
- Generating HTML snapshots for controlled pages
- Writing the evaluation runner implementation
