# WebSeek Technical Evaluation - Revised Plan with Controlled Webpages

## Overview of Changes

**Key Adjustments**:
1. ✅ **Tool Set Aligned with Table 3** - Updated `macro-tools.ts` to match paper exactly
2. ✅ **Controlled Webpage Approach** - Using 5-7 curated pages for all 100 tasks
3. ✅ **Reduced Discovery Tasks** - Fewer openPage tasks (5 instead of 10)
4. ✅ **Ground Truth Controllable** - HTML contexts are fixed and annotatable

---

## 1. Tool Set - Aligned with Table 3

**16 Tools Organized by Category**:

### Discovery (1 tool)
- `openPage` - Opens useful webpages related to current work

### Data Extraction & Wrangling (7 tools)
- `selectElements` - Identifies relevant DOM elements **(placeholder)**
- `inferSchema` - Infers data schema from tables/lists **(placeholder)**
- `extractBatch` - Batch extraction using pattern recognition **(placeholder)**
- `updateInstance` - Updates instance with new values (autocomplete)
- `addComputedColumn` - Creates derived columns **(placeholder)**
- `tableSort` - Sorts table data
- `tableFilter` - Filters table rows
- `mergeInstances` - Joins tables (union, inner/left/right join)

### Data Profiling & Cleaning (5 tools)
- `renameColumn` - Renames columns for normalization
- `formatColumn` - Formats column values **(placeholder)**
- `searchAndReplace` - Removes extraneous characters with regex
- `convertColumnType` - Converts data types with cleaning patterns
- `fillMissingValues` - Imputes missing values

### Data Modeling & Visualization (3 tools, but counted as features)
- `createVisualization` - Creates bar/line/scatter/histogram charts
- `tableFilter` - Interactive filtering/highlighting (same tool, different use case)

**Note**: Placeholder tools (marked with **(placeholder)**) have empty implementations but are included for completeness to match Table 3.

---

## 2. Controlled Webpage Approach

### Strategy: 5-7 Curated Reference Pages

Instead of 100 different webpages, we'll use a small set of **carefully curated and annotated pages** that can support multiple task types.

### Proposed Reference Pages

#### **Page 1: Amazon Product Search - Digital Cameras**
**URL**: `https://amazon.com/s?k=digital+camera` (simulated/snapshot)

**Data Characteristics**:
- 20 camera products with structured data
- Fields: Product Name, Price, Rating, # Reviews, Brand, Prime Status
- Data quality issues: 
  - Prices in "$X,XXX.XX" format (needs cleaning)
  - Missing ratings for some products
  - Inconsistent brand name formats

**Supports Task Types**:
- ✅ Element selection (identify product cards)
- ✅ Schema inference (infer product table structure)
- ✅ Batch extraction (extract all 20 products)
- ✅ Data type correction (convert price strings to numbers)
- ✅ Sorting/filtering (sort by price, filter by rating)
- ✅ Fill missing values (impute missing ratings)
- ✅ Computed columns (calculate discount percentage)
- ✅ Visualization (price distribution, ratings vs reviews)

**Example Tasks**:
1. Extract top 10 cameras by rating
2. Clean price column and sort by price (ascending)
3. Filter cameras with 4+ stars and Prime shipping
4. Fill missing ratings with median value
5. Create bar chart comparing prices across brands

---

#### **Page 2: Wikipedia - List of Countries by Population**
**URL**: `https://wikipedia.org/wiki/List_of_countries_by_population` (simulated/snapshot)

**Data Characteristics**:
- Table with 50 countries
- Fields: Country Name, Population (2023), Area (km²), Density, Growth Rate
- Data quality issues:
  - Population numbers with commas (e.g., "1,425,893,465")
  - Some growth rates as percentages (e.g., "+1.2%")
  - Missing density values for some countries

**Supports Task Types**:
- ✅ Schema inference (extract table structure)
- ✅ Batch extraction (extract all country data)
- ✅ Data type correction (convert formatted numbers)
- ✅ Entity normalization (standardize country names)
- ✅ Sorting/filtering (largest countries, fastest growing)
- ✅ Computed columns (population per km²)
- ✅ Visualization (population histogram, growth rate scatter)

**Example Tasks**:
1. Extract countries with population > 100 million
2. Clean population column (remove commas) and sort
3. Calculate population density for missing values
4. Rename "Country Name" to "Nation"
5. Create scatter plot: Population vs Area

---

#### **Page 3: eBay Search - Used Camera Equipment**
**URL**: `https://ebay.com/sch/i.html?_nkw=camera` (simulated/snapshot)

**Data Characteristics**:
- 15 used camera listings
- Fields: Item Title, Current Bid, Buy It Now Price, Condition, Time Left, Seller Rating
- Data quality issues:
  - Mixed price formats ("$500" vs "$1,200.00")
  - Condition categories need standardization
  - Some items have only bid price, others only buy-now

**Supports Task Types**:
- ✅ Batch extraction (extract all listings)
- ✅ Data cleaning (standardize prices and conditions)
- ✅ Joining tables (join with Amazon data for price comparison)
- ✅ Entity normalization (standardize condition names)
- ✅ Fill missing values (constant fill for missing prices)

**Example Tasks**:
1. Extract all Canon cameras under $1000
2. Join eBay data with Amazon data on product model
3. Standardize condition field (e.g., "Used - Good" → "Good")
4. Compare eBay vs Amazon prices for same models
5. Filter for "Excellent" condition with <2 days remaining

---

#### **Page 4: Kaggle Datasets Search Results**
**URL**: `https://kaggle.com/datasets?search=climate` (simulated/snapshot)

**Data Characteristics**:
- 12 dataset listings
- Fields: Dataset Name, Author, Size (MB), Downloads, Votes, Updated Date
- Data quality issues:
  - Size in mixed formats ("5.2 MB", "1.3 GB", "850 KB")
  - Dates in various formats
  - Missing download counts for private datasets

**Supports Task Types**:
- ✅ Schema inference and extraction
- ✅ Data type correction (convert sizes to MB, dates to standard format)
- ✅ Sorting (by popularity, size, recency)
- ✅ Computed columns (calculate votes per download ratio)
- ✅ openPage suggestions (suggest relevant datasets based on user's project)

**Example Tasks**:
1. Extract top 5 datasets by vote count
2. Convert all sizes to MB for comparison
3. Sort by most recently updated
4. Suggest 3 related datasets for a "climate analysis" project
5. Calculate popularity score (votes / downloads)

---

#### **Page 5: GitHub Repository Search - Data Analysis Tools**
**URL**: `https://github.com/search?q=data+analysis` (simulated/snapshot)

**Data Characteristics**:
- 10 repository results
- Fields: Repo Name, Stars, Forks, Language, Description, Last Updated
- Data quality issues:
  - Star/fork counts with "k" suffix (e.g., "12.3k")
  - Multiple languages listed
  - Varying description lengths

**Supports Task Types**:
- ✅ Batch extraction
- ✅ Data type correction (convert "12.3k" to 12300)
- ✅ Text processing (clean descriptions)
- ✅ Filtering (Python repos with >1000 stars)
- ✅ Visualization (stars vs forks scatter plot)

**Example Tasks**:
1. Extract Python repos with >5k stars
2. Clean star counts (convert "k" notation to numbers)
3. Sort by fork count (descending)
4. Filter for repos updated in last 30 days
5. Create visualization comparing popularity by language

---

#### **Page 6: IMDb Top Movies**
**URL**: `https://imdb.com/chart/top` (simulated/snapshot)

**Data Characteristics**:
- 30 movies from top 250
- Fields: Rank, Title, Year, Rating, Votes, Director, Genre
- Data quality issues:
  - Year in parentheses: "The Shawshank Redemption (1994)"
  - Multiple genres comma-separated
  - Vote counts with commas

**Supports Task Types**:
- ✅ Extraction and schema inference
- ✅ Text cleaning (extract year from title)
- ✅ Data type correction (clean vote counts)
- ✅ Filtering (by decade, genre, rating threshold)
- ✅ Visualization (rating distribution, movies per decade)

**Example Tasks**:
1. Extract movies from 1990s with rating >8.5
2. Clean title field (remove year parentheses)
3. Count movies per genre
4. Sort by number of votes
5. Create histogram of rating distribution

---

#### **Page 7: LinkedIn Job Listings (Optional - for composite tasks)**
**URL**: `https://linkedin.com/jobs/search/?keywords=data+analyst` (simulated/snapshot)

**Data Characteristics**:
- 8 job postings
- Fields: Job Title, Company, Location, Salary Range, Experience Level, Posted Date
- Data quality issues:
  - Salary ranges ("$60k - $80k", "Competitive", "$70,000 - $90,000")
  - Location formats varying
  - Experience levels need standardization

**Supports Task Types**:
- ✅ Complex extraction scenarios
- ✅ Entity normalization (locations, salary formats)
- ✅ Joining (combine with company data from LinkedIn profiles)
- ✅ Composite workflows (extract → clean → analyze)

---

## 3. Revised Task Distribution (100 Tasks)

### Category Breakdown

| Category | Easy | Medium | Hard | Total | % |
|----------|------|--------|------|-------|---|
| **Discovery** | 3 | 2 | 0 | **5** | 5% |
| **Extraction & Wrangling** | 15 | 20 | 10 | **45** | 45% |
| **Profiling & Cleaning** | 10 | 12 | 8 | **30** | 30% |
| **Modeling & Visualization** | 2 | 5 | 3 | **10** | 10% |
| **Composite (Multi-Step)** | 0 | 6 | 4 | **10** | 10% |
| **TOTAL** | **30** | **45** | **25** | **100** | **100%** |

### Rationale for Distribution

**Discovery (5%)**: Minimal - Only a few "suggest useful websites" scenarios
- Most tasks focus on working with existing data rather than finding new sources

**Extraction & Wrangling (45%)**: Largest category - Core WebSeek functionality
- Covers `selectElements`, `extractBatch`, `tableSort`, `tableFilter`, `mergeInstances`, `addComputedColumn`
- Aligns with paper's emphasis on data extraction from web

**Profiling & Cleaning (30%)**: Second largest - Essential data preparation
- `renameColumn`, `formatColumn`, `searchAndReplace`, `convertColumnType`, `fillMissingValues`
- Real-world data is messy - cleaning is critical

**Modeling & Visualization (10%)**: Smaller but important
- `createVisualization` for various chart types
- Interactive filtering scenarios

**Composite (10%)**: Multi-tool workflows
- End-to-end scenarios requiring 4-7 tools
- Example: Extract → Clean → Join → Sort → Visualize

---

## 4. Task Generation Strategy

### Approach: Page-Based Task Templates

For each reference page, create 15-20 task variations:

**Example: Amazon Camera Page (20 tasks)**

1. **Easy (6 tasks)**:
   - Extract first 5 cameras with rating >4 stars
   - Sort table by price (ascending)
   - Filter products with Prime shipping
   - Convert price column from string to number
   - Rename "Product Name" to "Camera Model"
   - Fill missing ratings with constant value "N/A"

2. **Medium (10 tasks)**:
   - Clean price column ($X,XXX → numbers) → Sort by price
   - Extract all cameras → Filter by brand "Canon" → Sort by rating
   - Calculate average price per brand (addComputedColumn)
   - Join Amazon + eBay data on product model
   - Standardize brand names (Canon vs CANON vs canon)
   - Create bar chart: Price by Brand

3. **Hard (4 tasks)**:
   - Extract all → Clean prices → Fill missing ratings → Create price/rating scatter plot
   - Compare Amazon vs eBay prices: Extract both → Join → Compute price difference → Sort
   - Identify best deals: Extract → Filter (rating >4.5, Prime) → Sort by price → Top 3
   - Time series analysis: Extract historical prices → Fill missing → Create line chart

### Cross-Page Tasks (for Joining/Discovery)

**Join Amazon + eBay**:
- Extract cameras from both → Clean prices → Join on model → Compare

**Suggest Kaggle Datasets**:
- User working on camera price analysis → Suggest relevant Kaggle datasets

**Multi-Source Aggregation**:
- Extract cameras from Amazon + eBay + B&H Photo → Merge → Find best prices

---

## 5. Ground Truth Creation Process

### Step 1: Create Annotated HTML Snapshots

For each reference page:
1. **Capture HTML snapshot** with `data-aid-id` attributes on all elements
2. **Validate data integrity** - ensure all 20/50/15 items are present
3. **Document schema** - list all available fields
4. **Note data quality issues** - catalog formatting problems, missing values

### Step 2: Expert Annotation

Two experts independently:
1. Review each task description
2. Write golden tool sequence
3. Validate parameters (column names, instance IDs)
4. Specify expected final state
5. Mark alternative valid sequences

### Step 3: Inter-Annotator Agreement

- Calculate Cohen's κ on tool selection
- Resolve disagreements through discussion
- Finalize 100 golden sequences

---

## 6. Concrete Example Tasks

### Task #1: Easy Extraction
**Page**: Amazon Cameras  
**Goal**: Extract the top 5 cameras with rating ≥ 4.5 stars  
**Golden Sequence**:
```json
[
  {
    "function": "extractBatch",
    "parameters": {
      "pageUrl": "amazon_cameras",
      "pattern": ".s-result-item",
      "maxItems": 20
    }
  },
  {
    "function": "tableFilter",
    "parameters": {
      "instanceId": "extracted_products",
      "conditions": [{"column": "Rating", "operator": ">=", "value": 4.5}]
    }
  },
  {
    "function": "tableSort",
    "parameters": {
      "instanceId": "filtered_products",
      "columnName": "Rating",
      "order": "desc"
    }
  }
]
```
**Expected Complexity**: 3 tools

---

### Task #42: Medium Cleaning + Sorting
**Page**: Amazon Cameras  
**Goal**: Clean the price column to remove dollar signs and commas, then sort by price (lowest first)  
**Golden Sequence**:
```json
[
  {
    "function": "searchAndReplace",
    "parameters": {
      "instanceId": "products_table",
      "searchPattern": "[$,]",
      "replaceWith": "",
      "useRegex": true,
      "columnName": "B"
    }
  },
  {
    "function": "convertColumnType",
    "parameters": {
      "instanceId": "products_table",
      "columnName": "B",
      "targetType": "numerical"
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
]
```
**Expected Complexity**: 3 tools

---

### Task #87: Hard Composite Workflow
**Page**: Amazon Cameras + eBay Cameras  
**Goal**: Compare prices between Amazon and eBay for Canon cameras, identify best deals  
**Golden Sequence**:
```json
[
  {
    "function": "extractBatch",
    "parameters": {"pageUrl": "amazon_cameras", "pattern": ".s-result-item", "maxItems": 20}
  },
  {
    "function": "tableFilter",
    "parameters": {
      "instanceId": "amazon_table",
      "conditions": [{"column": "Brand", "operator": "equals", "value": "Canon"}]
    }
  },
  {
    "function": "extractBatch",
    "parameters": {"pageUrl": "ebay_cameras", "pattern": ".s-item", "maxItems": 15}
  },
  {
    "function": "tableFilter",
    "parameters": {
      "instanceId": "ebay_table",
      "conditions": [{"column": "Brand", "operator": "equals", "value": "Canon"}]
    }
  },
  {
    "function": "mergeInstances",
    "parameters": {
      "sourceInstanceIds": ["amazon_canon", "ebay_canon"],
      "mergeStrategy": "inner_join",
      "joinColumns": {"leftColumn": "Model", "rightColumn": "Title"},
      "newInstanceName": "price_comparison"
    }
  },
  {
    "function": "addComputedColumn",
    "parameters": {
      "instanceId": "price_comparison",
      "formula": "amazon_price - ebay_price",
      "newColumnName": "Price Difference"
    }
  },
  {
    "function": "tableSort",
    "parameters": {
      "instanceId": "price_comparison",
      "columnName": "Price Difference",
      "order": "desc"
    }
  }
]
```
**Expected Complexity**: 7 tools

---

## 7. Benefits of Controlled Webpage Approach

### ✅ Advantages

1. **Ground Truth Controllable**
   - Fixed HTML → No webpage changes during evaluation
   - Annotators can thoroughly analyze structure
   - Reproducible across evaluation runs

2. **Diverse Task Types from Few Pages**
   - 20 tasks per page × 5 pages = 100 tasks
   - Each page supports 6-8 tool types
   - Cross-page tasks enable joining scenarios

3. **Realistic Complexity**
   - Real-world data quality issues (formatting, missing values)
   - Authentic webpage structures
   - Diverse domains (e-commerce, reference, jobs, code)

4. **Efficient Expert Review**
   - Experts learn page structure once
   - Can validate golden sequences faster
   - Easier to identify alternative valid sequences

5. **Simplified Evaluation Implementation**
   - Load 7 HTML files instead of 100
   - Faster context loading
   - Easier debugging

### ⚠️ Limitations

1. **Less Domain Diversity**
   - 5-7 domains instead of 100 different scenarios
   - May not cover all edge cases

2. **Potential Overfitting**
   - WebSeek might memorize specific page structures
   - Baseline might also benefit from repetition

**Mitigation**: Ensure task diversity WITHIN each page. Vary:
- Starting states (empty canvas vs. partial data)
- User goals (extraction vs. cleaning vs. joining)
- Tool combinations (single vs. composite workflows)

---

## 8. Implementation Adjustments

### Updated Files

1. **`macro-tools.ts`** ✅ - Already updated to match Table 3
2. **Task Generator Prompt** - Update to use controlled pages
3. **Evaluation Plan** - This document
4. **HTML Context Files** - Create 7 annotated HTML snapshots

### Next Steps

1. **Create Reference Pages** (Your task or we can simulate)
   - Option A: You provide real snapshots of Amazon, Wikipedia, etc.
   - Option B: I create realistic simulated HTML with `data-aid-id` attributes

2. **Generate Task Variations**
   - Use GPT-4 with page-specific prompts
   - Generate 15-20 tasks per page
   - Expert review and refinement

3. **Implement Evaluation**
   - Follow existing implementation guide
   - Adjust to load controlled HTML contexts
   - Run evaluation with WebSeek + Baseline

---

## 9. Example Reference Page Structure

```html
<!-- Amazon Camera Page Snapshot -->
<div class="s-result-list" data-aid-id="aid-root">
  <!-- Product 1 -->
  <div class="s-result-item" data-asin="B09WPVBSHP" data-aid-id="aid-001">
    <h2 class="product-title" data-aid-id="aid-002">
      Canon EOS R50 Mirrorless Camera
    </h2>
    <span class="a-price" data-aid-id="aid-003">
      <span class="a-offscreen">$679.00</span>
    </span>
    <div class="a-row" data-aid-id="aid-004">
      <span class="a-icon-star" data-aid-id="aid-005">
        4.6 out of 5 stars
      </span>
      <span class="a-size-base" data-aid-id="aid-006">
        (1,234 ratings)
      </span>
    </div>
    <span class="prime-badge" data-aid-id="aid-007">Prime</span>
    <span class="brand" data-aid-id="aid-008">Canon</span>
  </div>
  
  <!-- Product 2 -->
  <div class="s-result-item" data-asin="B0BQRWZ9H8" data-aid-id="aid-009">
    ...
  </div>
  
  <!-- 18 more products -->
  ...
</div>
```

---

## 10. Timeline Remains Similar

- **Week 1**: Create 7 HTML pages, generate 100 tasks, expert review
- **Week 2**: Implement integration, run evaluation, calculate metrics
- **Week 3**: Analyze results, write paper section

---

## Questions for You

1. **Reference Pages**: Should I create simulated HTML, or will you provide real snapshots?
2. **Task Distribution**: Is 5% for Discovery (openPage) sufficient, or do you want more?
3. **Placeholder Tools**: Are you comfortable having `selectElements`, `inferSchema`, etc. as placeholders for this evaluation?
4. **Cross-Page Tasks**: How many tasks should involve joining data from multiple pages (e.g., Amazon + eBay)?

---

## Summary of Changes

✅ **Tool alignment with Table 3** - 16 tools across 4 categories  
✅ **Controlled webpage approach** - 5-7 curated pages for all 100 tasks  
✅ **Reduced discovery tasks** - 5% instead of 10%  
✅ **Realistic yet manageable** - Ground truth is controllable, tasks are diverse  
✅ **Implementation ready** - Can proceed with generation and evaluation

This revised plan maintains scientific rigor while making ground truth creation and evaluation execution more manageable. The controlled webpage approach is actually a **strength**, not a limitation, as it ensures reproducibility and thorough expert annotation.
