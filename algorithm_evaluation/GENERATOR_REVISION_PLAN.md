# Task Generator Revision Plan

## Issues Identified

### 1. **Multi-Page Tasks - Starting URL**
**Problem**: Tasks involving data from multiple webpages only have a single starting_url.
**Solution**: 
- Change `starting_url` from string to array of strings
- For multi-page tasks (e.g., mergeInstances), include all relevant URLs
- Example: `["https://www.amazon.com/s?k=digital+camera", "https://www.ebay.com/sch/i.html?_nkw=used+camera"]`

### 2. **HTML Context Generation**
**Problem**: Generator creates synthetic html_context that doesn't match actual webpage structure.
**Solution**:
- Remove html_context field from generator completely
- Add post-processing script to fill html_context from actual HTML files based on starting_url
- This ensures perfect alignment between task context and actual evaluation data

### 3. **External URLs (google.com, etc.)**
**Problem**: Discovery tasks reference external URLs not in controlled webpage set.
**Solution**:
- Remove all references to google.com, edmunds.com, or other external sites
- For openPage tasks, reference one of our 20 controlled webpages as the "target"
- Example: "Find and open the IMDb top movies page to compare ratings"

### 4. **openPage Tool Tasks**
**Problem**: openPage tasks suggest opening pages outside our controlled set.
**Solution**:
- Revise task descriptions for openPage to navigate between controlled pages
- Example scenarios:
  - "You're analyzing Amazon cameras. Open the eBay used cameras page to compare prices."
  - "After reviewing job postings, open the Indeed salary data page to verify compensation ranges."
  - "Open the Wikipedia countries page to get demographic context for election results."

### 5. **Webpage Diversity**
**Problem**: Only 6 webpages, with similar pairs (Amazon/eBay both product listings).
**Solution**:
- Expand to 20 diverse webpages covering:
  - E-commerce: Amazon, eBay, Zillow
  - Social Media: Twitter, Reddit
  - Finance: Yahoo Finance, Coinbase
  - Sports: ESPN, Olympics
  - Career: LinkedIn, Indeed
  - Entertainment: IMDb, Goodreads
  - Reference: Wikipedia, Google Scholar
  - Government: Election Results
  - Weather: Weather.com
  - Food: Yelp
  - Data Science: Kaggle, GitHub

### 6. **Instance and Message Format Context**
**Problem**: Generator doesn't know proper format for initial_canvas_state and conversation_history.
**Solution**:
- Include full type definitions from types.tsx in generator prompt
- Include Message interface with @[InstanceId] reference syntax
- Provide examples of realistic canvas states and conversations

### 7. **Empty Canvas and Conversation**
**Problem**: All tasks have empty initial_canvas_state and conversation_history.
**Solution**:
- Generate varied initial states based on difficulty:
  - **Easy**: Empty canvas, no conversation (user starts fresh)
  - **Medium**: Partial table with 1-2 rows, user says "complete this table" or "@Table1 needs more data"
  - **Hard**: Multiple instances, conversation with clarifications like "I see @Table1 has errors, can you clean the price column?"
- Examples:
  ```javascript
  // Medium difficulty example
  "initial_canvas_state": {
    "instances": [{
      "type": "table",
      "id": "ProductList",
      "rows": 2,
      "cols": 3,
      "cells": [
        [{"type": "text", "content": "Canon EOS R50", "id": "_1", "source": {"type": "web", "pageId": "amazon_cameras", "locator": "aid-001"}}],
        [{"type": "text", "content": "Sony Alpha a6400", "id": "_2", "source": {"type": "web", "pageId": "amazon_cameras", "locator": "aid-008"}}]
      ],
      "columnNames": ["Product", "Price", "Rating"],
      "columnTypes": ["categorical", "numeral", "numeral"],
      "source": {"type": "manual"}
    }],
    "focus_instance_id": "ProductList"
  },
  "conversation_history": [
    {"role": "user", "message": "I started extracting camera products from Amazon. Can you complete @ProductList with all 20 products?"}
  ]
  ```

## Revised Task Generation Schema

```javascript
{
  "task_id": "T001",
  "task_category": "extraction" | "cleaning" | "visualization" | "discovery" | "composite",
  "difficulty": "easy" | "medium" | "hard",
  "page": "amazon_cameras" | "ebay_cameras" | ... | "multi-page",
  "goal_description": "Natural language description of user goal",
  "starting_url": ["https://www.amazon.com/s?k=digital+camera"], // ARRAY of URLs
  // html_context removed - will be filled later from actual HTML
  "initial_canvas_state": {
    "instances": [], // Can be empty (easy) or contain partial work (medium/hard)
    "focus_instance_id": null | "InstanceId"
  },
  "conversation_history": [
    // Can be empty (easy) or contain prior messages (medium/hard)
    // Format: {"role": "user" | "assistant", "message": "text with optional @[InstanceId] references"}
  ],
  "recent_logs": [
    // Context about what user did before (optional)
  ],
  "golden_tool_sequence": [
    // Tool calls with parameters
  ],
  "expected_tools": 1 // Number of tools in sequence
}
```

## Implementation Steps

1. ✅ Create WEBPAGE_DESIGN_20.md with 20 webpage specifications
2. 🔲 Update CONTROLLED_WEBPAGES array in generate-tasks.mjs with 20 pages
3. 🔲 Add Instance and Message type definitions to generator prompt
4. 🔲 Update generator prompt with examples of non-empty canvas/conversation states
5. 🔲 Change starting_url from string to array in task schema
6. 🔲 Remove html_context generation logic
7. 🔲 Update openPage task prompts to reference controlled pages only
8. 🔲 Revise TASK_PLAN distribution for 50 tasks across 20 pages
9. 🔲 Test generator with new configuration
10. 🔲 Create post-processing script to fill html_context from actual HTML files

## Task Distribution (50 Tasks across 20 Pages)

### By Category:
- Discovery (openPage): 2 tasks (4%)
- Extraction: 12 tasks (24%)
- Cleaning: 12 tasks (24%)
- Visualization: 10 tasks (20%)
- Composite: 12 tasks (24%)
- Cross-Page: 2 tasks (4%)

### By Difficulty:
- Easy: 15 tasks (30%)
- Medium: 20 tasks (40%)
- Hard: 15 tasks (30%)

### By Page (50 tasks / 20 pages ≈ 2.5 tasks per page):
- Major pages (5 tasks each): Amazon, Wikipedia, IMDb (15 tasks)
- Medium pages (3 tasks each): eBay, LinkedIn, Yahoo Finance, Zillow (12 tasks)
- Standard pages (2 tasks each): Twitter, Reddit, Weather, Indeed, ESPN, Olympics, Yelp, Kaggle, GitHub (18 tasks)
- Light pages (1 task each): Google Scholar, Goodreads, Election, Coinbase, Cross-page (5 tasks)
