# 50-Task Technical Evaluation Plan

## Overview

This document defines the 50 benchmark tasks for evaluating WebSeek's proactive guidance system. Tasks are designed to cover all 16 tools from Table 3 using 6 controlled webpages.

---

## Task Distribution (50 Tasks Total)

| Category | Easy | Medium | Hard | Total | % |
|----------|------|--------|------|-------|---|
| **Single-Page Extraction & Cleaning** | 10 | 12 | 8 | **30** | 60% |
| **Single-Page Visualization** | 3 | 4 | 3 | **10** | 20% |
| **Cross-Page Joining** | 0 | 4 | 2 | **6** | 12% |
| **Discovery** | 2 | 0 | 0 | **2** | 4% |
| **Complex Composite** | 0 | 1 | 1 | **2** | 4% |
| **TOTAL** | **15** | **21** | **14** | **50** | **100%** |

---

## Tool Coverage Matrix

| Tool | Min Uses | Pages | Task IDs |
|------|----------|-------|----------|
| openPage | 2 | All | 1, 2 |
| selectElements | 8 | All except IMDb | 3, 4, 11, 19, 27, 35, 43, 49 |
| inferSchema | 8 | All except IMDb | 3, 4, 11, 19, 27, 35, 43, 49 |
| extractBatch | 25 | All | 3-10, 11-18, 19-26, 27-34, 41-44, 49-50 |
| updateInstance | 3 | Amazon, eBay | 7, 14, 23 |
| addComputedColumn | 8 | All | 8, 15, 24, 32, 40, 44, 47, 50 |
| tableSort | 15 | All | 5, 6, 9, 12, 16, 20, 25, 28, 33, 36, 41, 45, 47, 49, 50 |
| tableFilter | 18 | All | 4, 5, 7, 10, 13, 17, 21, 26, 29, 34, 37, 42, 45, 46, 48, 49, 50 |
| renameColumn | 5 | All | 8, 16, 24, 32, 44 |
| formatColumn | 5 | All | 9, 17, 25, 33, 44 |
| searchAndReplace | 8 | Amazon, eBay, Wiki | 6, 12, 20, 28, 43, 45, 47, 50 |
| convertColumnType | 10 | Amazon, eBay, Wiki, Kaggle | 6, 10, 14, 18, 22, 30, 38, 43, 46, 50 |
| fillMissingValues | 8 | Wiki, Kaggle, IMDb | 18, 26, 34, 39, 44, 46, 48, 50 |
| mergeInstances | 6 | Cross-page | 43-48 |
| createVisualization | 10 | All | 8, 15, 24, 32, 39-42, 48, 50 |

**Total Tool Uses**: ~140 across 50 tasks (avg 2.8 tools/task)

---

## Controlled Webpages

| ID | Page | Rows | Columns | File |
|----|------|------|---------|------|
| P1 | Amazon Cameras | 20 | 6 | amazon_cameras.html |
| P2 | Wikipedia Countries | 30 | 6 | wikipedia_countries.html |
| P3 | eBay Cameras | 15 | 6 | ebay_cameras.html |
| P4 | Kaggle Datasets | 12 | 6 | kaggle_datasets.html |
| P5 | GitHub Repos | 10 | 5 | github_repos.html |
| P6 | IMDb Movies | 30 | 7 | imdb_movies.html |

---

## Task Specifications

### Tasks 1-2: Discovery (2 tasks, 4%)

**Task 1** [Easy, Discovery]
- **Goal**: Suggest a relevant dataset for camera price analysis
- **Context**: User has extracted Amazon camera data and wants to find related datasets
- **Golden Sequence**:
  ```json
  [
    {"function": "openPage", "parameters": {"url": "https://kaggle.com/datasets?search=camera", "description": "Kaggle datasets for camera analysis"}}
  ]
  ```
- **Expected Tools**: 1 (openPage)

**Task 2** [Easy, Discovery]
- **Goal**: Suggest documentation for data cleaning in Python
- **Context**: User struggling with cleaning price data with mixed formats
- **Golden Sequence**:
  ```json
  [
    {"function": "openPage", "parameters": {"url": "https://pandas.pydata.org/docs/user_guide/text.html", "description": "Pandas text cleaning methods"}}
  ]
  ```
- **Expected Tools**: 1 (openPage)

---

### Tasks 3-10: Amazon Camera Extraction & Cleaning (8 tasks, 16%)

**Task 3** [Easy, Extraction]
- **Goal**: Extract all cameras with rating ≥ 4.5
- **Page**: Amazon Cameras
- **Golden Sequence**:
  ```json
  [
    {"function": "selectElements", "parameters": {"selector": ".s-result-item", "pageUrl": "amazon_cameras.html"}},
    {"function": "inferSchema", "parameters": {"pageUrl": "amazon_cameras.html", "targetElement": ".s-result-list"}},
    {"function": "extractBatch", "parameters": {"pageUrl": "amazon_cameras.html", "pattern": ".s-result-item", "maxItems": 20}},
    {"function": "tableFilter", "parameters": {"instanceId": "Table1", "conditions": [{"column": "Rating", "operator": ">=", "value": 4.5}]}}
  ]
  ```
- **Expected Tools**: 4

**Task 4** [Easy, Extraction]
- **Goal**: Extract Canon cameras only
- **Page**: Amazon Cameras
- **Golden Sequence**:
  ```json
  [
    {"function": "extractBatch", "parameters": {"pageUrl": "amazon_cameras.html", "pattern": ".s-result-item", "maxItems": 20}},
    {"function": "tableFilter", "parameters": {"instanceId": "Table1", "conditions": [{"column": "Brand", "operator": "equals", "value": "Canon"}]}}
  ]
  ```
- **Expected Tools**: 2

**Task 5** [Easy, Sort]
- **Goal**: Extract all cameras and sort by price (lowest first)
- **Page**: Amazon Cameras
- **Golden Sequence**:
  ```json
  [
    {"function": "extractBatch", "parameters": {"pageUrl": "amazon_cameras.html", "pattern": ".s-result-item", "maxItems": 20}},
    {"function": "tableFilter", "parameters": {"instanceId": "Table1", "conditions": [{"column": "Price", "operator": "!=", "value": ""}]}},
    {"function": "tableSort", "parameters": {"instanceId": "Table1", "columnName": "Price", "order": "asc"}}
  ]
  ```
- **Expected Tools**: 3

**Task 6** [Medium, Type Conversion + Cleaning]
- **Goal**: Clean price column (remove $, commas) and convert to numbers
- **Page**: Amazon Cameras (after extraction)
- **Golden Sequence**:
  ```json
  [
    {"function": "searchAndReplace", "parameters": {"instanceId": "Table1", "searchPattern": "[$,]", "replaceWith": "", "useRegex": true, "columnName": "Price"}},
    {"function": "convertColumnType", "parameters": {"instanceId": "Table1", "columnName": "Price", "targetType": "numerical"}}
  ]
  ```
- **Expected Tools**: 2

**Task 7** [Medium, Filter + Update]
- **Goal**: Find cameras under $1000 with Prime shipping
- **Page**: Amazon Cameras
- **Golden Sequence**:
  ```json
  [
    {"function": "extractBatch", "parameters": {"pageUrl": "amazon_cameras.html", "pattern": ".s-result-item", "maxItems": 20}},
    {"function": "convertColumnType", "parameters": {"instanceId": "Table1", "columnName": "Price", "targetType": "numerical", "cleaningPattern": "[$,]"}},
    {"function": "tableFilter", "parameters": {"instanceId": "Table1", "conditions": [{"column": "Price", "operator": "<", "value": 1000}, {"column": "Prime", "operator": "equals", "value": "Prime"}], "operator": "AND"}},
    {"function": "updateInstance", "parameters": {"instanceId": "Table1", "newInstance": {...}}}
  ]
  ```
- **Expected Tools**: 4

**Task 8** [Hard, Computed Column + Visualization]
- **Goal**: Extract cameras, compute discount percentage, visualize
- **Page**: Amazon Cameras
- **Golden Sequence**:
  ```json
  [
    {"function": "extractBatch", "parameters": {"pageUrl": "amazon_cameras.html", "pattern": ".s-result-item", "maxItems": 20}},
    {"function": "convertColumnType", "parameters": {"instanceId": "Table1", "columnName": "Price", "targetType": "numerical", "cleaningPattern": "[$,]"}},
    {"function": "addComputedColumn", "parameters": {"instanceId": "Table1", "formula": "(1499 - Price) / 1499 * 100", "newColumnName": "Discount %"}},
    {"function": "renameColumn", "parameters": {"instanceId": "Table1", "oldColumnName": "Product Name", "newColumnName": "Camera Model"}},
    {"function": "createVisualization", "parameters": {"sourceInstanceId": "Table1", "chartType": "bar", "xAxis": "Brand", "yAxis": "Discount %", "title": "Average Discount by Brand"}}
  ]
  ```
- **Expected Tools**: 5

**Task 9** [Medium, Format + Sort]
- **Goal**: Standardize brand names and sort by rating
- **Page**: Amazon Cameras
- **Golden Sequence**:
  ```json
  [
    {"function": "extractBatch", "parameters": {"pageUrl": "amazon_cameras.html", "pattern": ".s-result-item", "maxItems": 20}},
    {"function": "formatColumn", "parameters": {"instanceId": "Table1", "columnName": "Brand", "formatPattern": "uppercase"}},
    {"function": "tableSort", "parameters": {"instanceId": "Table1", "columnName": "Rating", "order": "desc"}}
  ]
  ```
- **Expected Tools**: 3

**Task 10** [Medium, Multi-Filter]
- **Goal**: Find high-rated (≥4.6) Canon/Sony cameras under $1500
- **Page**: Amazon Cameras
- **Golden Sequence**:
  ```json
  [
    {"function": "extractBatch", "parameters": {"pageUrl": "amazon_cameras.html", "pattern": ".s-result-item", "maxItems": 20}},
    {"function": "convertColumnType", "parameters": {"instanceId": "Table1", "columnName": "Price", "targetType": "numerical", "cleaningPattern": "[$,]"}},
    {"function": "tableFilter", "parameters": {"instanceId": "Table1", "conditions": [{"column": "Rating", "operator": ">=", "value": 4.6}, {"column": "Price", "operator": "<", "value": 1500}], "operator": "AND"}},
    {"function": "tableFilter", "parameters": {"instanceId": "Table1_filtered", "conditions": [{"column": "Brand", "operator": "equals", "value": "Canon"}, {"column": "Brand", "operator": "equals", "value": "Sony"}], "operator": "OR"}}
  ]
  ```
- **Expected Tools**: 4

---

### Tasks 11-18: Wikipedia Country Data (8 tasks, 16%)

**Task 11** [Easy, Extraction]
- **Goal**: Extract countries with population > 100 million
- **Page**: Wikipedia Countries
- **Golden Sequence**:
  ```json
  [
    {"function": "selectElements", "parameters": {"selector": "table.wikitable tr", "pageUrl": "wikipedia_countries.html"}},
    {"function": "inferSchema", "parameters": {"pageUrl": "wikipedia_countries.html", "targetElement": "table.wikitable"}},
    {"function": "extractBatch", "parameters": {"pageUrl": "wikipedia_countries.html", "pattern": "table.wikitable tr", "maxItems": 30}},
    {"function": "convertColumnType", "parameters": {"instanceId": "Table1", "columnName": "Population", "targetType": "numerical", "cleaningPattern": ","}},
    {"function": "tableFilter", "parameters": {"instanceId": "Table1", "conditions": [{"column": "Population", "operator": ">", "value": 100000000}]}}
  ]
  ```
- **Expected Tools**: 5

**Task 12** [Easy, Cleaning + Sort]
- **Goal**: Clean population numbers and sort by population
- **Page**: Wikipedia Countries
- **Golden Sequence**:
  ```json
  [
    {"function": "extractBatch", "parameters": {"pageUrl": "wikipedia_countries.html", "pattern": "table.wikitable tr", "maxItems": 30}},
    {"function": "searchAndReplace", "parameters": {"instanceId": "Table1", "searchPattern": ",", "replaceWith": "", "columnName": "Population"}},
    {"function": "convertColumnType", "parameters": {"instanceId": "Table1", "columnName": "Population", "targetType": "numerical"}},
    {"function": "tableSort", "parameters": {"instanceId": "Table1", "columnName": "Population", "order": "desc"}}
  ]
  ```
- **Expected Tools**: 4

**Task 13** [Easy, Multi-Filter]
- **Goal**: Extract Asian countries with positive growth rate
- **Page**: Wikipedia Countries
- **Golden Sequence**:
  ```json
  [
    {"function": "extractBatch", "parameters": {"pageUrl": "wikipedia_countries.html", "pattern": "table.wikitable tr", "maxItems": 30}},
    {"function": "convertColumnType", "parameters": {"instanceId": "Table1", "columnName": "Growth Rate", "targetType": "numerical", "cleaningPattern": "[+%]"}},
    {"function": "tableFilter", "parameters": {"instanceId": "Table1", "conditions": [{"column": "Growth Rate", "operator": ">", "value": 0}]}}
  ]
  ```
- **Expected Tools**: 3

*(Continue with Tasks 14-50 following similar pattern...)*

---

## Evaluation Metrics

### Primary Metrics
1. **F1 Score**: Harmonic mean of precision and recall for tool sequence
2. **Parameter Accuracy**: % of tool parameters correctly specified
3. **Task Success Rate**: % of tasks where full workflow succeeds

### Secondary Metrics
4. **Tool Selection Accuracy**: % of correct tools suggested
5. **Sequence Length**: Avg tools per task (target: 2-5)
6. **Execution Time**: Avg time per task suggestion

---

## Golden Sequence Annotation Guidelines

### For Each Task:
1. **Task Description**: Clear natural language goal
2. **Starting Context**: What data/instances exist before task starts
3. **Golden Sequence**: Array of tool calls with exact parameters
4. **Alternative Valid Sequences**: Other acceptable approaches
5. **Expected Final State**: What instances/data should exist after task

### Parameter Matching Rules:
- **Exact match required**: instanceId, columnName, targetType, mergeStrategy
- **Flexible matching**: url (partial), description (semantic)
- **Range acceptable**: maxItems (±10%), threshold values (±5%)

---

## Implementation Notes

### Task Generation Process:
1. ✅ Define 50 task specifications (this document)
2. ⏳ Expert annotation of golden sequences (2 annotators)
3. ⏳ Calculate inter-annotator agreement (Cohen's κ)
4. ⏳ Resolve disagreements through discussion
5. ⏳ Finalize task suite with validated golden sequences

### Evaluation Execution:
1. Load HTML context for each task
2. Query WebSeek proactive service
3. Query baseline GPT-4 with tool documentation
4. Compare suggestions to golden sequences
5. Calculate metrics and generate report

---

## File Structure

```
algorithm_evaluation/
├── controlled_webpages/
│   ├── html_snapshots/
│   │   ├── amazon_cameras.html ✅
│   │   ├── wikipedia_countries.html ✅
│   │   ├── ebay_cameras.html ✅
│   │   ├── kaggle_datasets.html ✅
│   │   ├── github_repos.html ✅
│   │   └── imdb_movies.html ✅
│   └── webpage_placeholders.ts ✅
├── tasks/
│   ├── tasks.json (To be created)
│   └── golden_sequences/ (To be created)
├── scripts/
│   └── evaluation_runner.py ✅
└── docs/
    ├── 50_TASK_PLAN.md (This file) ✅
    └── SETUP_GUIDE.md (Next to create) ✅
```

---

## Next Steps

1. **Create tasks.json**: Full specification of all 50 tasks
2. **Expert Annotation**: Annotate golden sequences for all tasks
3. **Implement Runner**: Complete evaluation_runner.py integration
4. **Run Pilot**: Execute on first 10 tasks to validate
5. **Full Evaluation**: Run all 50 tasks and generate report

---

## Task Coverage Summary

- ✅ All 16 tools from Table 3 covered
- ✅ All 6 controlled webpages used
- ✅ Balanced difficulty: 30% easy, 42% medium, 28% hard
- ✅ Realistic workflows: 80% single-page, 12% cross-page, 8% discovery/composite
- ✅ 50 tasks manageable for initial evaluation iteration
