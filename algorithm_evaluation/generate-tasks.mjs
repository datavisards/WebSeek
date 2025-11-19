#!/usr/bin/env node
/**
 * Task Generator Runner
 * 
 * This script generates benchmark tasks using controlled webpages and OpenRouter API.
 * It generates ONE task at a time with specific parameters for better control.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const envPath = join(__dirname, '.env');
if (existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  console.error('Error: .env file not found in algorithm_evaluation directory');
  console.error('Please create .env file with OPENROUTER_API_KEY');
  process.exit(1);
}

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
const MODEL = process.env.WEBSEEK_MODEL || 'openai/gpt-4-turbo-preview';

if (!OPENROUTER_API_KEY) {
  console.error('Error: OPENROUTER_API_KEY not found in .env file');
  process.exit(1);
}

// Define the 6 controlled webpages
const CONTROLLED_WEBPAGES = [
  {
    id: 'amazon_cameras',
    filename: 'amazon_cameras.html',
    description: 'Amazon camera product search results',
    url: 'https://www.amazon.com/s?k=digital+camera',
    dataStructure: '20 camera products with columns: Product Name, Price ($X,XXX.XX), Rating (X.X), Reviews (X,XXX), Brand, Prime (badge)',
    dataIssues: 'Prices have $ and commas, some missing Prime badges, formatted numbers need cleaning',
    sampleContent: 'Products include Canon EOS R50 ($679.00, 4.6★), Sony Alpha a6400 ($898.00, 4.7★), Nikon D3500 ($449.95, 4.5★)',
    suitableTools: ['extractBatch', 'tableFilter', 'tableSort', 'convertColumnType', 'searchAndReplace', 'createVisualization', 'mergeInstances (with ebay_cameras)']
  },
  {
    id: 'wikipedia_countries',
    filename: 'wikipedia_countries.html',
    description: 'Wikipedia list of countries by population',
    url: 'https://en.wikipedia.org/wiki/List_of_countries_by_population',
    dataStructure: '30 countries in table format with columns: Rank, Country, Population (X,XXX,XXX), Area (km²), Density (per km²), Growth Rate (+X.XX%)',
    dataIssues: 'Population numbers have commas (1,425,775,850), growth rates have +/- and % symbols, some negative growth',
    sampleContent: 'India (1,425,775,850, +0.81%), China (1,411,750,000, -0.02%), United States (334,914,895, +0.50%)',
    suitableTools: ['extractBatch', 'tableFilter', 'tableSort', 'convertColumnType', 'searchAndReplace', 'fillMissingValues', 'createVisualization']
  },
  {
    id: 'ebay_cameras',
    filename: 'ebay_cameras.html',
    description: 'eBay used camera listings',
    url: 'https://www.ebay.com/sch/i.html?_nkw=used+camera',
    dataStructure: '15 used camera listings with columns: Title, Current Bid ($XXX), Buy It Now ($X,XXX), Condition (Used - X), Time Left (Xd Xh), Seller Rating (XX.X%)',
    dataIssues: 'Mixed price formats ($599.99 vs $895), empty Buy Now fields, varying condition strings',
    sampleContent: 'Canon EOS 5D Mark IV (Current Bid: $895, Condition: Used - Excellent), Sony A7 III ($1,299 Buy Now, Used - Good)',
    suitableTools: ['extractBatch', 'tableFilter', 'convertColumnType', 'fillMissingValues', 'mergeInstances (with amazon_cameras for price comparison)']
  },
  {
    id: 'kaggle_datasets',
    filename: 'kaggle_datasets.html',
    description: 'Kaggle climate dataset search results',
    url: 'https://www.kaggle.com/datasets?search=climate',
    dataStructure: '12 climate datasets with columns: Dataset Name, Author, Size (mixed units: MB/GB/KB), Downloads, Votes, Updated (relative dates)',
    dataIssues: 'Inconsistent size units (850 KB, 2.3 GB, 15.8 GB), natural language dates (2 months ago, 1 week ago)',
    sampleContent: 'Global Temperature Dataset (15.8 GB, 45,678 downloads, 2 months ago), Climate Change Indicators (2.3 GB, 23,456 downloads)',
    suitableTools: ['extractBatch', 'tableFilter', 'tableSort', 'convertColumnType', 'formatColumn', 'createVisualization']
  },
  {
    id: 'github_repos',
    filename: 'github_repos.html',
    description: 'GitHub data analysis repositories',
    url: 'https://github.com/search?q=data+analysis',
    dataStructure: '10 repositories with columns: Repo Name (owner/repo), Stars (XX.Xk format), Forks, Language, Description, Updated (relative)',
    dataIssues: '"k" suffix on numbers (42.3k = 42,300), multiple languages per repo, varying update formats',
    sampleContent: 'pandas-dev/pandas (42.3k⭐, 17.8k forks, Python), apache/superset (58.9k⭐, 12.3k forks, TypeScript)',
    suitableTools: ['extractBatch', 'tableFilter', 'tableSort', 'convertColumnType', 'searchAndReplace', 'createVisualization']
  },
  {
    id: 'imdb_movies',
    filename: 'imdb_movies.html',
    description: 'IMDb top 30 movies',
    url: 'https://www.imdb.com/chart/top',
    dataStructure: '30 movies with columns: Rank, Title, Year (YYYY), Rating (X.X), Votes (X,XXX,XXX), Director, Genre (comma-separated)',
    dataIssues: 'Votes have commas (2,876,543), multiple genres per movie (Drama, Crime, Thriller), need to split genres',
    sampleContent: 'The Shawshank Redemption (1994, 9.3, 2,876,543 votes, Frank Darabont, Drama), The Godfather (1972, 9.2, 2,045,678 votes)',
    suitableTools: ['extractBatch', 'tableFilter', 'tableSort', 'convertColumnType', 'searchAndReplace', 'createVisualization', 'addComputedColumn']
  }
];

// Task generation plan: 50 tasks total
const TASK_PLAN = [
  // Discovery (2 tasks, 4%)
  { category: 'discovery', difficulty: 'easy', page: null, count: 2 },
  
  // Amazon Cameras (8 tasks, 16%)
  { category: 'extraction', difficulty: 'easy', page: 'amazon_cameras', count: 2 },
  { category: 'extraction', difficulty: 'medium', page: 'amazon_cameras', count: 2 },
  { category: 'cleaning', difficulty: 'medium', page: 'amazon_cameras', count: 2 },
  { category: 'visualization', difficulty: 'medium', page: 'amazon_cameras', count: 1 },
  { category: 'composite', difficulty: 'hard', page: 'amazon_cameras', count: 1 },
  
  // Wikipedia Countries (8 tasks, 16%)
  { category: 'extraction', difficulty: 'easy', page: 'wikipedia_countries', count: 2 },
  { category: 'extraction', difficulty: 'medium', page: 'wikipedia_countries', count: 1 },
  { category: 'cleaning', difficulty: 'medium', page: 'wikipedia_countries', count: 3 },
  { category: 'visualization', difficulty: 'medium', page: 'wikipedia_countries', count: 2 },
  
  // eBay Cameras (6 tasks, 12%)
  { category: 'extraction', difficulty: 'easy', page: 'ebay_cameras', count: 2 },
  { category: 'cleaning', difficulty: 'medium', page: 'ebay_cameras', count: 2 },
  { category: 'cleaning', difficulty: 'hard', page: 'ebay_cameras', count: 2 },
  
  // Kaggle Datasets (6 tasks, 12%)
  { category: 'extraction', difficulty: 'easy', page: 'kaggle_datasets', count: 2 },
  { category: 'cleaning', difficulty: 'medium', page: 'kaggle_datasets', count: 2 },
  { category: 'visualization', difficulty: 'medium', page: 'kaggle_datasets', count: 2 },
  
  // GitHub Repos (6 tasks, 12%)
  { category: 'extraction', difficulty: 'easy', page: 'github_repos', count: 2 },
  { category: 'cleaning', difficulty: 'medium', page: 'github_repos', count: 2 },
  { category: 'composite', difficulty: 'hard', page: 'github_repos', count: 2 },
  
  // IMDb Movies (8 tasks, 16%)
  { category: 'extraction', difficulty: 'easy', page: 'imdb_movies', count: 2 },
  { category: 'extraction', difficulty: 'medium', page: 'imdb_movies', count: 2 },
  { category: 'cleaning', difficulty: 'medium', page: 'imdb_movies', count: 2 },
  { category: 'visualization', difficulty: 'medium', page: 'imdb_movies', count: 2 },
  
  // Cross-Page Tasks (6 tasks, 12%)
  { category: 'cross-page', difficulty: 'hard', page: 'amazon_cameras+ebay_cameras', count: 3 },
  { category: 'cross-page', difficulty: 'hard', page: 'multiple', count: 3 }
];

/**
 * Generate a single task using OpenRouter API
 */
async function generateSingleTask(taskSpec, taskNumber) {
  const { category, difficulty, page } = taskSpec;
  
  // Get page information
  let pageInfo = null;
  if (page && page !== 'multiple' && !page.includes('+')) {
    pageInfo = CONTROLLED_WEBPAGES.find(p => p.id === page);
  } else if (page && page.includes('+')) {
    // Cross-page task with specific pages
    const pageIds = page.split('+');
    pageInfo = {
      id: page,
      description: `Cross-page task combining: ${pageIds.join(' and ')}`,
      pages: pageIds.map(id => CONTROLLED_WEBPAGES.find(p => p.id === id))
    };
  }

  // Build task-specific context
  let taskContext = '';
  if (category === 'discovery') {
    taskContext = `
**Task Type**: Discovery
Generate a task where the user needs to find and open a relevant webpage/resource.
**No specific page context** - suggest external websites, documentation, or data sources.
`;
  } else if (category === 'cross-page') {
    if (page.includes('+')) {
      const pages = pageInfo.pages;
      taskContext = `
**Task Type**: Cross-Page
Generate a task that requires merging/comparing data from multiple pages:
${pages.map(p => `
- **${p.id}**: ${p.description}
  Data: ${p.dataStructure}
  Issues: ${p.dataIssues}
  Sample: ${p.sampleContent}
`).join('\n')}

The task should involve using mergeInstances or comparing data across these pages.
`;
    } else {
      taskContext = `
**Task Type**: Cross-Page (Multiple Pages)
Generate a task that involves data from 2-3 different controlled webpages.
Choose appropriate pages from: amazon_cameras, wikipedia_countries, ebay_cameras, kaggle_datasets, github_repos, imdb_movies
The task should require merging or comparing data.
`;
    }
  } else {
    taskContext = `
**Task Type**: ${category.charAt(0).toUpperCase() + category.slice(1)}
**Target Page**: ${pageInfo.id}

**Page Information**:
- Description: ${pageInfo.description}
- URL: ${pageInfo.url}
- Data Structure: ${pageInfo.dataStructure}
- Data Quality Issues: ${pageInfo.dataIssues}
- Sample Content: ${pageInfo.sampleContent}
- Suitable Tools: ${pageInfo.suitableTools.join(', ')}

**File Location**: controlled_webpages/html_snapshots/${pageInfo.filename}

Generate a task that uses THIS specific webpage. The HTML context should be consistent with the data structure described above.
`;
  }

  // Full tool descriptions from macro-tools.ts (with examples and constraints)
  const toolDescriptions = `
**openPage**
Opens a webpage in a new browser tab for suggesting useful data sources related to the user's current work.
Parameters:
- url (string, required): The complete URL to open (must include http:// or https://)
- description (string, required): A brief description of what the page contains and why it's relevant
- openInBackground (boolean, optional): Whether to open the page in background tab (default: false)
Examples:
- openPage("https://www.kaggle.com/datasets", "Browse datasets relevant to your data analysis project", false)
- openPage("https://pandas.pydata.org/docs/", "Pandas documentation for data manipulation techniques", true)

**selectElements**
Automatically identifies and selects relevant DOM elements on webpages for data extraction.
Parameters:
- selector (string, required): CSS selector or pattern to identify elements
- pageUrl (string, required): URL of the page to select elements from
Examples:
- selectElements(".product-card", "https://amazon.com/s?k=camera")
- selectElements("[data-testid='product-item']", "https://ebay.com/search")

**inferSchema**
Analyzes webpage structure and infers data schema for structured extraction from tables and lists.
Parameters:
- pageUrl (string, required): URL of the page to analyze
- targetElement (string, required): Selector for the target table or list element
Examples:
- inferSchema("https://wikipedia.org/wiki/List_of_countries", "table.wikitable")
- inferSchema("https://amazon.com/s?k=laptop", ".s-result-list")

**extractBatch**
Extracts multiple similar data entries from web pages in batch operations using pattern recognition.
Parameters:
- pageUrl (string, required): URL of the page to extract from
- pattern (string, required): Pattern or selector to identify similar items
- maxItems (number, optional): Maximum number of items to extract (default: 50)
Examples:
- extractBatch("https://amazon.com/s?k=camera", ".s-result-item", 20)
- extractBatch("https://wikipedia.org/wiki/List_of_cities", "table tr", 100)

**updateInstance**
Updates the specified instance with new values. Used for row/column autocomplete.
Parameters:
- instanceId (string, required): The ID of the instance to update
- newInstance (object, required): The new instance data (complete Instance object)
Examples:
- updateInstance("Table1", {...updatedTableData})

**addComputedColumn**
Creates new columns based on formulas or calculations derived from existing columns.
Parameters:
- instanceId (string, required): The ID of the table instance
- formula (string, required): Formula or expression to compute new column values (e.g., 'A + B', 'A * 0.1')
- newColumnName (string, required): Name for the new computed column
Examples:
- addComputedColumn("Table1", "B * C", "Total Price")
- addComputedColumn("Table1", "A * 0.1", "Tax Amount")

**tableSort**
Applies sorting to organize data in table instances.
Parameters:
- instanceId (string, required): The ID of the table instance to sort
- columnName (string, required): The EXACT column name or column letter (A, B, C, etc.)
- order (string, required): Sort order: 'asc' for ascending, 'desc' for descending
- secondarySort (object, optional): Optional secondary sort criteria for handling ties
Examples:
- tableSort("Table1", "A", "desc")
- tableSort("Table2", "B", "asc", {"column": "C", "order": "asc"})

**tableFilter**
Applies filtering to show/hide rows based on criteria for data refinement and interactive exploration.
Parameters:
- instanceId (string, required): The ID of the table instance to filter
- conditions (array, required): Array of filter conditions to apply
- operator (string, optional): How to combine multiple conditions: 'AND' or 'OR' (default: "AND")
Examples:
- tableFilter("Table1", [{"column": "B", "operator": ">", "value": 100}])
- tableFilter("Table2", [{"column": "A", "operator": "equals", "value": "electronics"}, {"column": "C", "operator": ">=", "value": 4}], "AND")

**renameColumn**
Renames columns for entity resolution and normalization. Standardizes entity names across datasets.
Parameters:
- instanceId (string, required): The ID of the table instance containing the column to rename
- oldColumnName (string, required): The current name of the column to rename
- newColumnName (string, required): The new name for the column
Examples:
- renameColumn("Table1", "A", "Product Name")
- renameColumn("Table2", "B", "Price")

**formatColumn**
Formats column values for entity resolution and normalization. Standardizes data formats across datasets.
Parameters:
- instanceId (string, required): The ID of the table instance
- columnName (string, required): The name of the column to format
- formatPattern (string, required): Format pattern to apply (e.g., 'uppercase', 'lowercase', 'titlecase', 'date:YYYY-MM-DD')
Examples:
- formatColumn("Table1", "A", "uppercase")
- formatColumn("Table2", "Date", "date:YYYY-MM-DD")

**searchAndReplace**
Removes extraneous characters. Performs find and replace operations with support for regex patterns for advanced text manipulation.
Parameters:
- instanceId (string, required): The ID of the instance to modify (table or text type)
- searchPattern (string, required): Text or regex pattern to search for
- replaceWith (string, required): Text to replace matches with
- useRegex (boolean, optional): Whether to treat searchPattern as regex (default: false)
- columnName (string, optional): Specific column name for table instances
Examples:
- searchAndReplace("Table1", "N/A", "", false, "A")
- searchAndReplace("Table2", "\\\\d{3}-\\\\d{3}-\\\\d{4}", "XXX-XXX-XXXX", true, "B")
- searchAndReplace("Text1", "old_value", "new_value", false)

**mergeInstances**
Joins tables. Combines multiple table instances using union, inner join, left join, or right join operations with flexible column mapping.
Parameters:
- sourceInstanceIds (array, required): Array of exactly 2 table instance IDs to merge
- mergeStrategy (string, required): How to combine the tables (options: "append", "union", "inner_join", "left_join", "right_join")
- joinColumns (object, optional): For join operations: {"leftColumn": "column_name_in_left_table", "rightColumn": "column_name_in_right_table"}
- newInstanceName (string, optional): Name for the merged table instance
Examples:
- mergeInstances(["Table1", "Table2"], "inner_join", {"leftColumn": "Customer ID", "rightColumn": "ID"}, "Customer Orders")
- mergeInstances(["Sales_Data", "Product_Info"], "left_join", {"leftColumn": "ProductCode", "rightColumn": "Code"}, "Sales with Products")
- mergeInstances(["Table3", "Table4"], "union", null, "Combined Dataset")

**convertColumnType**
Data type correction. Converts table columns between data types (e.g., converting currency strings to numbers) with optional cleaning patterns.
Parameters:
- instanceId (string, required): The ID of the table instance containing the column to convert
- columnName (string, required): The name of the column to convert
- targetType (string, required): The target data type (options: "numerical", "categorical")
- cleaningPattern (string, optional): Optional regex pattern to clean values before conversion (e.g., '[\\$,]' to remove $ and commas)
- replaceWith (string, optional): What to replace the cleaning pattern with (default: empty string)
Examples:
- convertColumnType("Table1", "B", "numerical", "[\\$,]", "")  // Convert "$99.99" to 99.99
- convertColumnType("Table1", "A", "categorical")  // Convert numbers to text categories

**fillMissingValues**
Fills missing or empty cells using strategies like mean, median, mode, interpolation, or constant values.
Parameters:
- instanceId (string, required): The ID of the table instance containing missing values
- columnName (string, required): The name of the column to fill missing values in
- strategy (string, required): The imputation strategy (options: "mean", "median", "mode", "forward_fill", "backward_fill", "constant", "interpolate")
- constantValue (string, optional): The constant value to use when strategy is 'constant'
- missingIndicators (array, optional): Array of values to treat as missing (default: ["", "N/A", "null", "NULL", "-"])
Examples:
- fillMissingValues("Table1", "B", "mean")
- fillMissingValues("Table1", "A", "mode")
- fillMissingValues("Table1", "C", "constant", "Unknown")

**createVisualization**
Creates new visualization instances (bar, line, scatterplot, and histograms). Auto-generates or suggests alternative charts.
Parameters:
- sourceInstanceId (string, required): The ID of the table instance to visualize
- chartType (string, required): Type of visualization (options: "bar", "line", "scatter", "histogram")
- xAxis (string, required): Column name for X-axis
- yAxis (string, optional): Column name for Y-axis (not required for histograms)
- title (string, optional): Title for the visualization
Examples:
- createVisualization("Table1", "bar", "A", "B", "Sales by Region")
- createVisualization("Table2", "scatter", "B", "C", "Price vs Rating")
- createVisualization("Table3", "histogram", "A", null, "Distribution")
`;

  // Use neutral prompt (no system name mentioned)
  const prompt = `You are an HCI researcher creating a benchmark to evaluate an AI-powered system for web data analysis and decision-making.

**TASK**: Generate ONE realistic benchmark task for technical evaluation.

## System Overview

The system helps users with data-driven decision-making on the web by:
1. Extracting data from webpages into structured instances (tables, text, images)
2. Providing AI-driven proactive guidance for data manipulation
3. Supporting data cleaning, transformation, joining, and visualization

**Available Tools**: The system provides these macro tools:

${toolDescriptions}

## Task Specification

${taskContext}

**Difficulty Level**: ${difficulty.toUpperCase()}
${difficulty === 'easy' ? '- 1-2 tool calls, single-step operation' : ''}
${difficulty === 'medium' ? '- 3-4 tool calls, tool sequences with dependencies' : ''}
${difficulty === 'hard' ? '- 5+ tool calls, complex multi-instance operations' : ''}

### Task Requirements

1. **Realistic Scenario**: Based on actual user needs (comparison shopping, research, data analysis, etc.)
2. **Clear Goal**: Specific, measurable objective that a real user would have
3. **Simulated Context**: 
   - HTML content with data-aid-id attributes (aid-001, aid-002, etc.)
   - Existing instances on canvas (some tasks start with empty canvas)
   - Recent user actions (logs showing what user just did)
4. **Golden Tool Sequence**: Expert-validated correct solution using ONLY the available tools listed above
5. **Solvable**: Must be achievable with the available tools

### Example Task (DO NOT COPY, USE AS REFERENCE):

\`\`\`json
{
  "task_id": "TASK_001",
  "task_category": "Extraction & Wrangling",
  "difficulty": "Medium",
  "goal_description": "Extract all digital camera products from this Amazon search page, clean the price column to remove dollar signs and commas, then sort by price from lowest to highest.",
  
  "starting_url": "https://www.amazon.com/s?k=digital+camera",
  
  "html_context": "<div class='s-result-list'><div class='s-result-item' data-asin='B09WPVBSHP' data-aid-id='aid-001'><h2 data-aid-id='aid-002'>Canon EOS R50 Mirrorless Camera</h2><span class='a-price' data-aid-id='aid-003'><span class='a-offscreen'>$679.00</span></span><div class='a-row' data-aid-id='aid-004'><span class='a-icon-star' data-aid-id='aid-005'>4.6 out of 5 stars</span></div></div>... [15 more products]</div>",
  
  "initial_canvas_state": {
    "instances": [
      {
        "id": "first_product",
        "type": "text",
        "content": "Canon EOS R50 Mirrorless Camera",
        "source": {"type": "web", "pageId": "page_001", "locator": "aid-002"}
      }
    ],
    "focus_instance_id": null
  },
  
  "conversation_history": [],
  
  "recent_logs": [
    "User navigated to Amazon camera search page",
    "User selected product name 'Canon EOS R50'",
    "User dragged product to canvas as text instance"
  ],
  
  "golden_tool_sequence": [
    {
      "function": "searchAndReplace",
      "parameters": {
        "instanceId": "products_table",
        "searchPattern": "[$,]",
        "replaceWith": "",
        "useRegex": true,
        "columnName": "Price"
      }
    },
    {
      "function": "convertColumnType",
      "parameters": {
        "instanceId": "products_table",
        "columnName": "Price",
        "targetType": "numerical"
      }
    },
    {
      "function": "tableSort",
      "parameters": {
        "instanceId": "products_table",
        "columnName": "Price",
        "order": "asc"
      }
    }
  ],
  
  "golden_final_state": {
    "instances": [
      {
        "id": "products_table",
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
  "requires_instance_analysis": true,
  "notes": "Tests composite workflow: data cleaning → type conversion → sorting"
}
\`\`\`

## Important Guidelines

**DO**:
- Use diverse real-world domains (e-commerce, academic research, travel, finance, news)
- Create realistic HTML contexts with proper data-aid-id attributes
- Ensure golden sequences use ONLY the available tools listed above
- Vary task complexity and tool combinations
- Include tasks that require HTML analysis, instance analysis, or both
- Make goals specific and measurable

**DON'T**:
- Use fake/fictional websites
- Create unsolvable tasks
- Use tools not in the available list
- Make HTML contexts too simple (need realistic complexity)
- Ignore the category/difficulty distribution requirements
- Create duplicate or near-identical tasks

## Output Format

Return ONLY a valid JSON object (NOT an array) for ONE task following this structure:

\`\`\`json
{
  "task_id": "T${String(taskNumber).padStart(3, '0')}",
  "task_category": "${category}",
  "difficulty": "${difficulty}",
  ${page ? `"page": "${page}",` : ''}
  "goal_description": "Clear, specific description of what the user wants to accomplish",
  
  ${page && !page.includes('multiple') ? `"starting_url": "${pageInfo.pages ? pageInfo.pages[0].url : pageInfo.url}",` : '"starting_url": "appropriate_url",'}
  
  "html_context": "<realistic HTML snippet with data-aid-id attributes>",
  
  "initial_canvas_state": {
    "instances": [],
    "focus_instance_id": null
  },
  
  "conversation_history": [],
  
  "recent_logs": [
    "User action 1",
    "User action 2"
  ],
  
  "golden_tool_sequence": [
    {
      "function": "toolName",
      "parameters": {
        "param1": "value1"
      }
    }
  ],
  
  "expected_tools": 2
}
\`\`\`

**CRITICAL**: 
- Return ONLY the JSON object, no markdown formatting, no code blocks, no extra text
- Use the exact task_id format: T${String(taskNumber).padStart(3, '0')}
- Ensure golden_tool_sequence uses ONLY tools from the list above
- Make sure HTML context matches the page's data structure if a page is specified

**BEGIN GENERATION NOW**: Generate ONE task with the specifications above.`;

  console.log(`\n[${taskNumber}/50] Generating ${difficulty} ${category} task${page ? ` for ${page}` : ''}...`);

  try {
    // Use native fetch (available in Node 18+)
    const requestBody = JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are an expert HCI researcher creating benchmark datasets for AI system evaluation. Return ONLY valid JSON objects with no markdown formatting.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 4000
    });

    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://github.com/datavisards/WebSeek',
        'X-Title': 'WebSeek Technical Evaluation'
      },
      body: requestBody
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error(`Unexpected API response format: ${JSON.stringify(data)}`);
    }
    
    let content = data.choices[0].message.content.trim();

    // Remove markdown code blocks if present
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');

    // Try to extract JSON object
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Failed to extract JSON from response');
      console.error('Response:', content.substring(0, 500));
      throw new Error('Could not parse JSON from API response');
    }

    const task = JSON.parse(jsonMatch[0]);
    console.log(`  ✓ Generated task T${String(taskNumber).padStart(3, '0')}: ${task.goal_description?.substring(0, 60)}...`);
    
    return task;
  } catch (error) {
    console.error(`  ✗ Error generating task ${taskNumber}:`);
    console.error(`     ${error.message}`);
    if (error.cause) {
      console.error(`     Cause: ${error.cause.message}`);
    }
    return null;
  }
}

/**
 * Test API connection
 */
async function testAPIConnection() {
  console.log('Testing OpenRouter API connection...');
  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API test failed (${response.status}): ${errorText}`);
    }
    
    console.log('✓ API connection successful\n');
    return true;
  } catch (error) {
    console.error('✗ API connection failed:');
    console.error(`  ${error.message}`);
    if (error.cause) {
      console.error(`  Cause: ${error.cause.message}`);
      console.error(`  Code: ${error.cause.code}`);
    }
    console.error('\nPlease check:');
    console.error('1. Your OPENROUTER_API_KEY is correct in .env');
    console.error('2. You have internet connection');
    console.error('3. OpenRouter API is accessible');
    return false;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('=== WebSeek Benchmark Task Generator ===');
  console.log(`Model: ${MODEL}`);
  console.log('Generating 50 tasks with controlled distribution...\n');

  // Test API connection first
  const apiOk = await testAPIConnection();
  if (!apiOk) {
    process.exit(1);
  }

  const allTasks = [];
  let taskNumber = 1;

  // Expand TASK_PLAN into individual task specs
  const taskSpecs = [];
  for (const planItem of TASK_PLAN) {
    for (let i = 0; i < planItem.count; i++) {
      taskSpecs.push({
        category: planItem.category,
        difficulty: planItem.difficulty,
        page: planItem.page
      });
    }
  }

  console.log(`Total tasks to generate: ${taskSpecs.length}\n`);

  // Generate tasks one at a time
  for (const spec of taskSpecs) {
    const task = await generateSingleTask(spec, taskNumber);
    
    if (task) {
      allTasks.push(task);
    } else {
      console.log(`  ⚠️  Skipping failed task ${taskNumber}, will retry at end...`);
    }
    
    taskNumber++;
    
    // Rate limiting: wait 2 seconds between requests
    if (taskNumber <= taskSpecs.length) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Save to file
  const outputDir = join(__dirname, 'data');
  const outputFile = join(outputDir, 'benchmark_tasks.json');
  
  // Create data directory if it doesn't exist
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  writeFileSync(outputFile, JSON.stringify(allTasks, null, 2));
  console.log(`\n✓ Saved ${allTasks.length} tasks to: ${outputFile}`);
  
  // Print summary
  console.log('\n=== Task Summary ===');
  const categories = {};
  const difficulties = {};
  const pages = {};
  
  allTasks.forEach(task => {
    categories[task.task_category] = (categories[task.task_category] || 0) + 1;
    difficulties[task.difficulty] = (difficulties[task.difficulty] || 0) + 1;
    if (task.page) {
      pages[task.page] = (pages[task.page] || 0) + 1;
    }
  });
  
  console.log('\nBy Category:');
  Object.entries(categories).sort().forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count}`);
  });
  
  console.log('\nBy Difficulty:');
  Object.entries(difficulties).sort().forEach(([diff, count]) => {
    console.log(`  ${diff}: ${count}`);
  });
  
  console.log('\nBy Page:');
  Object.entries(pages).sort().forEach(([page, count]) => {
    console.log(`  ${page}: ${count}`);
  });
  
  if (allTasks.length < taskSpecs.length) {
    console.log(`\n⚠️  Warning: Only generated ${allTasks.length}/${taskSpecs.length} tasks`);
    console.log('Some tasks failed to generate. Review errors above and retry if needed.');
  } else {
    console.log('\n✓ Task generation complete!');
  }
  
  console.log('\nNext steps:');
  console.log('1. Review tasks in data/benchmark_tasks.json');
  console.log('2. Manually verify golden sequences are correct');
  console.log('3. Run evaluation: python scripts/evaluation_runner.py');
}

main();
