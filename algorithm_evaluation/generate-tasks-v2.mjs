#!/usr/bin/env node
/**
 * Task Generator Runner - Version 2 (Heavily Revised)
 * 
 * MAJOR CHANGES FROM V1:
 * 1. starting_url is now an ARRAY (supports multi-page tasks)
 * 2. html_context removed from generator (will be filled later from actual HTML)
 * 3. 20 diverse controlled webpages (not just 6)
 * 4. openPage tasks reference controlled pages only (no google.com, etc.)
 * 5. Includes Instance and Message type definitions for canvas/conversation generation
 * 6. Generates realistic initial_canvas_state and conversation_history (not always empty)
 * 7. Includes full WebSeek type system documentation
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

// Define the 20 controlled webpages
const CONTROLLED_WEBPAGES = [
  {
    id: 'amazon_cameras',
    filename: 'amazon_cameras.html',
    description: 'Amazon camera product search results',
    url: 'https://www.amazon.com/s?k=digital+camera',
    dataStructure: '20 camera products with columns: Product Name, Price ($X,XXX.XX), Rating (X.X), Reviews (X,XXX), Brand, Prime (badge)',
    dataIssues: 'Prices have $ and commas, some missing Prime badges, formatted numbers need cleaning',
    suitableTools: ['extractBatch', 'tableFilter', 'tableSort', 'convertColumnType', 'searchAndReplace', 'createVisualization', 'mergeInstances']
  },
  {
    id: 'ebay_cameras',
    filename: 'ebay_cameras.html',
    description: 'eBay used camera listings',
    url: 'https://www.ebay.com/sch/i.html?_nkw=used+camera',
    dataStructure: '15 used camera listings with columns: Title, Current Bid ($XXX), Buy It Now ($X,XXX), Condition (Used - X), Time Left (Xd Xh), Seller Rating (XX.X%)',
    dataIssues: 'Mixed price formats, empty Buy Now fields, varying condition strings',
    suitableTools: ['extractBatch', 'tableFilter', 'convertColumnType', 'fillMissingValues', 'mergeInstances']
  },
  {
    id: 'wikipedia_countries',
    filename: 'wikipedia_countries.html',
    description: 'Wikipedia list of countries by population',
    url: 'https://en.wikipedia.org/wiki/List_of_countries_by_population',
    dataStructure: '30 countries with columns: Rank, Country, Population (X,XXX,XXX), Area (km²), Density (per km²), Growth Rate (+X.XX%)',
    dataIssues: 'Population numbers have commas, growth rates have +/- and % symbols, some negative growth',
    suitableTools: ['extractBatch', 'tableFilter', 'tableSort', 'convertColumnType', 'searchAndReplace', 'fillMissingValues', 'createVisualization']
  },
  {
    id: 'imdb_movies',
    filename: 'imdb_movies.html',
    description: 'IMDb top 30 movies',
    url: 'https://www.imdb.com/chart/top',
    dataStructure: '30 movies with columns: Rank, Title, Year (YYYY), Rating (X.X), Votes (X,XXX,XXX), Director, Genre',
    dataIssues: 'Votes have commas, multiple genres per movie, need to split genres',
    suitableTools: ['extractBatch', 'tableFilter', 'tableSort', 'convertColumnType', 'searchAndReplace', 'createVisualization', 'addComputedColumn']
  },
  {
    id: 'kaggle_datasets',
    filename: 'kaggle_datasets.html',
    description: 'Kaggle climate dataset search results',
    url: 'https://www.kaggle.com/datasets?search=climate',
    dataStructure: '12 climate datasets with columns: Dataset Name, Author, Size (mixed units: MB/GB/KB), Downloads, Votes, Updated (relative dates)',
    dataIssues: 'Inconsistent size units (850 KB, 2.3 GB), natural language dates (2 months ago)',
    suitableTools: ['extractBatch', 'tableFilter', 'tableSort', 'convertColumnType', 'formatColumn', 'createVisualization']
  },
  {
    id: 'github_repos',
    filename: 'github_repos.html',
    description: 'GitHub data analysis repositories',
    url: 'https://github.com/search?q=data+analysis',
    dataStructure: '10 repositories with columns: Repo Name, Stars (XX.Xk format), Forks, Language, Description, Updated (relative)',
    dataIssues: 'k suffix on numbers (42.3k), multiple languages per repo, varying update formats',
    suitableTools: ['extractBatch', 'tableFilter', 'tableSort', 'convertColumnType', 'searchAndReplace', 'createVisualization']
  },
  {
    id: 'twitter_trending',
    filename: 'twitter_trending.html',
    description: 'Twitter/X trending topics',
    url: 'https://twitter.com/explore/tabs/trending',
    dataStructure: '15 trending hashtags with columns: Hashtag, Tweet Count, Category, Timestamp',
    dataIssues: 'Formatted tweet counts (1.2M, 45.6K), mixed categories, timezone issues',
    suitableTools: ['extractBatch', 'searchAndReplace', 'convertColumnType', 'tableFilter', 'createVisualization']
  },
  {
    id: 'linkedin_jobs',
    filename: 'linkedin_jobs.html',
    description: 'LinkedIn job postings for data scientists',
    url: 'https://www.linkedin.com/jobs/search/?keywords=data%20scientist',
    dataStructure: '20 data scientist jobs with columns: Title, Company, Location, Salary Range, Posted Date',
    dataIssues: 'Salary ranges ($80K-$120K), missing salaries, relative dates, remote/hybrid labels',
    suitableTools: ['extractBatch', 'searchAndReplace', 'fillMissingValues', 'tableFilter', 'tableSort']
  },
  {
    id: 'weather_forecast',
    filename: 'weather_forecast.html',
    description: 'Weather.com 10-day forecast',
    url: 'https://weather.com/weather/tenday/l/Seattle+WA',
    dataStructure: '10-day forecast with columns: Date, High Temp, Low Temp, Precipitation %, Conditions, Wind Speed',
    dataIssues: 'Temperature symbols (°F), percentage symbols, wind in mph, mixed condition labels',
    suitableTools: ['extractBatch', 'convertColumnType', 'formatColumn', 'createVisualization']
  },
  {
    id: 'reddit_dataisbeautiful',
    filename: 'reddit_dataisbeautiful.html',
    description: 'Reddit r/dataisbeautiful hot posts',
    url: 'https://www.reddit.com/r/dataisbeautiful/hot/',
    dataStructure: '20 hot posts with columns: Title, Author, Upvotes, Comments, Awards, Posted Time',
    dataIssues: 'Formatted upvotes (12.3k), relative times (2 hours ago), multiple award types',
    suitableTools: ['extractBatch', 'searchAndReplace', 'convertColumnType', 'tableFilter', 'tableSort']
  },
  {
    id: 'zillow_homes',
    filename: 'zillow_homes.html',
    description: 'Zillow real estate home listings',
    url: 'https://www.zillow.com/homes/Seattle-WA/',
    dataStructure: '15 home listings with columns: Address, Price, Beds, Baths, Sqft, Days on Market',
    dataIssues: 'Formatted prices ($1,234,567), missing sqft for some, abbreviations (bd/ba)',
    suitableTools: ['extractBatch', 'convertColumnType', 'fillMissingValues', 'tableFilter', 'tableSort', 'createVisualization']
  },
  {
    id: 'indeed_salaries',
    filename: 'indeed_salaries.html',
    description: 'Indeed salary data for data scientists',
    url: 'https://www.indeed.com/career/data-scientist/salaries',
    dataStructure: '15 locations with columns: Location, Average Salary, Salary Range, Job Count, Cost of Living Index',
    dataIssues: 'Formatted salaries ($123,456), ranges with dashes, missing cost of living for some',
    suitableTools: ['extractBatch', 'searchAndReplace', 'convertColumnType', 'fillMissingValues', 'createVisualization']
  },
  {
    id: 'espn_nba',
    filename: 'espn_nba.html',
    description: 'ESPN NBA standings',
    url: 'https://www.espn.com/nba/standings',
    dataStructure: '30 NBA teams with columns: Team, Wins, Losses, Win %, Games Behind, Streak, Last 10',
    dataIssues: 'Percentage symbols, streak formats (W3/L2), last 10 as text (7-3)',
    suitableTools: ['extractBatch', 'searchAndReplace', 'convertColumnType', 'tableSort', 'createVisualization']
  },
  {
    id: 'olympic_medals',
    filename: 'olympic_medals.html',
    description: 'Olympic medal count Paris 2024',
    url: 'https://olympics.com/en/olympic-games/paris-2024/medals',
    dataStructure: '20 countries with columns: Rank, Country, Gold, Silver, Bronze, Total Medals',
    dataIssues: 'Rank with # symbol, tied ranks, missing medals for some countries',
    suitableTools: ['extractBatch', 'addComputedColumn', 'tableSort', 'createVisualization']
  },
  {
    id: 'yahoo_finance',
    filename: 'yahoo_finance.html',
    description: 'Yahoo Finance stock quotes',
    url: 'https://finance.yahoo.com/quote/AAPL?p=AAPL',
    dataStructure: '15 tech stocks with columns: Symbol, Price, Change, Change %, Volume, Market Cap',
    dataIssues: 'Price formatting ($123.45), change with +/-, percentage with %, abbreviated market cap (1.2T)',
    suitableTools: ['extractBatch', 'searchAndReplace', 'convertColumnType', 'tableSort', 'createVisualization']
  },
  {
    id: 'yelp_restaurants',
    filename: 'yelp_restaurants.html',
    description: 'Yelp restaurant listings Seattle',
    url: 'https://www.yelp.com/search?find_desc=restaurants&find_loc=Seattle,+WA',
    dataStructure: '20 restaurants with columns: Name, Rating, Price Range ($$), Cuisine, Review Count, Location',
    dataIssues: 'Price symbols ($-$$$$), formatted review counts (1.2k), multiple cuisines',
    suitableTools: ['extractBatch', 'tableFilter', 'tableSort', 'createVisualization']
  },
  {
    id: 'scholar_papers',
    filename: 'scholar_papers.html',
    description: 'Google Scholar machine learning publications',
    url: 'https://scholar.google.com/scholar?q=machine+learning',
    dataStructure: '15 papers with columns: Title, Authors, Year, Citations, Venue, Cited By Count',
    dataIssues: 'Multiple authors, formatted citations ([PDF] tags), missing venue for some',
    suitableTools: ['extractBatch', 'searchAndReplace', 'fillMissingValues', 'tableSort', 'tableFilter']
  },
  {
    id: 'goodreads_books',
    filename: 'goodreads_books.html',
    description: 'Goodreads best books ever',
    url: 'https://www.goodreads.com/list/show/1.Best_Books_Ever',
    dataStructure: '20 books with columns: Title, Author, Avg Rating, Ratings Count, Published Year, Genre',
    dataIssues: 'Formatted ratings (4.23), formatted rating counts (1.2M), multiple genres',
    suitableTools: ['extractBatch', 'convertColumnType', 'tableFilter', 'tableSort', 'createVisualization']
  },
  {
    id: 'election_results',
    filename: 'election_results.html',
    description: '2024 US Election results by state',
    url: 'https://www.politico.com/2024-election/results/',
    dataStructure: '15 states with columns: State, Candidate Votes, Vote %, Total Votes, Precincts Reporting %',
    dataIssues: 'Percentage symbols, formatted vote counts (1,234,567), incomplete reporting',
    suitableTools: ['extractBatch', 'convertColumnType', 'addComputedColumn', 'tableSort', 'createVisualization']
  },
  {
    id: 'coinbase_crypto',
    filename: 'coinbase_crypto.html',
    description: 'Coinbase cryptocurrency prices',
    url: 'https://www.coinbase.com/explore',
    dataStructure: '12 cryptocurrencies with columns: Name, Price, 24h Change, 24h Volume, Market Cap',
    dataIssues: 'Price precision ($12,345.67), change with +/-, percentage, abbreviated volume (1.2B)',
    suitableTools: ['extractBatch', 'searchAndReplace', 'convertColumnType', 'tableSort', 'createVisualization']
  }
];

// Task generation plan: 50 tasks total across 20 pages
const TASK_PLAN = [
  // Discovery (2 tasks) - Navigate between controlled pages
  { category: 'discovery', difficulty: 'easy', page: null, count: 2 },
  
  // Amazon Cameras (5 tasks - major page)
  { category: 'extraction', difficulty: 'easy', page: 'amazon_cameras', count: 1 },
  { category: 'extraction', difficulty: 'medium', page: 'amazon_cameras', count: 1 },
  { category: 'cleaning', difficulty: 'medium', page: 'amazon_cameras', count: 2 },
  { category: 'composite', difficulty: 'hard', page: 'amazon_cameras', count: 1 },
  
  // Wikipedia Countries (5 tasks - major page)
  { category: 'extraction', difficulty: 'easy', page: 'wikipedia_countries', count: 1 },
  { category: 'cleaning', difficulty: 'medium', page: 'wikipedia_countries', count: 2 },
  { category: 'visualization', difficulty: 'medium', page: 'wikipedia_countries', count: 2 },
  
  // IMDb Movies (5 tasks - major page)
  { category: 'extraction', difficulty: 'easy', page: 'imdb_movies', count: 1 },
  { category: 'extraction', difficulty: 'medium', page: 'imdb_movies', count: 1 },
  { category: 'cleaning', difficulty: 'medium', page: 'imdb_movies', count: 1 },
  { category: 'visualization', difficulty: 'medium', page: 'imdb_movies', count: 2 },
  
  // eBay, LinkedIn, Yahoo Finance, Zillow (3 tasks each)
  { category: 'extraction', difficulty: 'easy', page: 'ebay_cameras', count: 1 },
  { category: 'cleaning', difficulty: 'medium', page: 'ebay_cameras', count: 2 },
  
  { category: 'extraction', difficulty: 'easy', page: 'linkedin_jobs', count: 1 },
  { category: 'cleaning', difficulty: 'medium', page: 'linkedin_jobs', count: 2 },
  
  { category: 'extraction', difficulty: 'easy', page: 'yahoo_finance', count: 1 },
  { category: 'visualization', difficulty: 'medium', page: 'yahoo_finance', count: 2 },
  
  { category: 'extraction', difficulty: 'easy', page: 'zillow_homes', count: 1 },
  { category: 'cleaning', difficulty: 'medium', page: 'zillow_homes', count: 1 },
  { category: 'visualization', difficulty: 'medium', page: 'zillow_homes', count: 1 },
  
  // Standard pages (2 tasks each)
  { category: 'extraction', difficulty: 'easy', page: 'twitter_trending', count: 1 },
  { category: 'cleaning', difficulty: 'medium', page: 'twitter_trending', count: 1 },
  
  { category: 'extraction', difficulty: 'easy', page: 'reddit_dataisbeautiful', count: 1 },
  { category: 'cleaning', difficulty: 'medium', page: 'reddit_dataisbeautiful', count: 1 },
  
  { category: 'extraction', difficulty: 'easy', page: 'weather_forecast', count: 1 },
  { category: 'visualization', difficulty: 'medium', page: 'weather_forecast', count: 1 },
  
  { category: 'extraction', difficulty: 'easy', page: 'indeed_salaries', count: 1 },
  { category: 'cleaning', difficulty: 'medium', page: 'indeed_salaries', count: 1 },
  
  { category: 'extraction', difficulty: 'easy', page: 'espn_nba', count: 1 },
  { category: 'visualization', difficulty: 'medium', page: 'espn_nba', count: 1 },
  
  { category: 'extraction', difficulty: 'easy', page: 'olympic_medals', count: 1 },
  { category: 'visualization', difficulty: 'medium', page: 'olympic_medals', count: 1 },
  
  { category: 'extraction', difficulty: 'easy', page: 'kaggle_datasets', count: 1 },
  { category: 'cleaning', difficulty: 'medium', page: 'kaggle_datasets', count: 1 },
  
  { category: 'extraction', difficulty: 'easy', page: 'github_repos', count: 1 },
  { category: 'cleaning', difficulty: 'medium', page: 'github_repos', count: 1 },
  
  // Light pages (1 task each)
  { category: 'extraction', difficulty: 'easy', page: 'yelp_restaurants', count: 1 },
  { category: 'extraction', difficulty: 'easy', page: 'scholar_papers', count: 1 },
  { category: 'extraction', difficulty: 'easy', page: 'goodreads_books', count: 1 },
  { category: 'extraction', difficulty: 'easy', page: 'election_results', count: 1 },
  { category: 'extraction', difficulty: 'easy', page: 'coinbase_crypto', count: 1 },
  
  // Cross-Page Tasks (2 tasks)
  { category: 'cross-page', difficulty: 'hard', page: 'amazon_cameras+ebay_cameras', count: 1 },
  { category: 'cross-page', difficulty: 'hard', page: 'linkedin_jobs+indeed_salaries', count: 1 }
];

// WebSeek Type System Documentation (from types.tsx)
const TYPE_SYSTEM_DOCS = `
## WebSeek Type System (from types.tsx)

### Instance Types

The system uses a structured type system for all instances on the canvas:

**BaseInstance** (all instances extend this):
- id: string (unique identifier)
- source: InstanceSource (origin of the instance)
- originalId?: string (optional reference to original if copied)

**InstanceSource** (union type):
- WebCaptureSource: { type: 'web', pageId: string, locator: string }
  - Used for instances extracted from webpages
  - locator is the data-aid-id value (e.g., "aid-001")
- ManualSource: { type: 'manual' }
  - Used for instances created by user or AI from scratch

**Instance Types**:

1. **TextInstance**:
   - type: 'text'
   - content: string
   - x, y, width, height (optional positioning)

2. **ImageInstance**:
   - type: 'image'
   - src: string (URL or data URI)
   - x, y, width, height (optional)

3. **TableInstance**:
   - type: 'table'
   - rows: number
   - cols: number
   - cells: Array<Array<EmbeddedInstance | null>>
   - columnNames: string[]
   - columnTypes: ('numeral' | 'categorical')[]
   - x, y, width, height (optional)

4. **VisualizationInstance**:
   - type: 'visualization'
   - spec: object (Vega-Lite spec)
   - thumbnail?: string
   - x, y, width, height (optional)

**EmbeddedInstance** (for cells in tables):
- Can be: EmbeddedTextInstance, EmbeddedImageInstance, EmbeddedTableInstance, etc.
- Each has same properties as standalone but lives inside another instance

**Complete TableInstance Example**:
\`\`\`json
{
  "id": "ProductTable",
  "type": "table",
  "rows": 3,
  "cols": 2,
  "columnNames": ["Product", "Price"],
  "columnTypes": ["categorical", "numeral"],
  "cells": [
    [
      {"type": "text", "content": "Canon EOS R50", "id": "_cell1", "source": {"type": "web", "pageId": "amazon_page", "locator": "aid-001"}},
      {"type": "text", "content": "$679.00", "id": "_cell2", "source": {"type": "web", "pageId": "amazon_page", "locator": "aid-002"}}
    ],
    [
      {"type": "text", "content": "Sony A6400", "id": "_cell3", "source": {"type": "web", "pageId": "amazon_page", "locator": "aid-008"}},
      {"type": "text", "content": "$898.00", "id": "_cell4", "source": {"type": "web", "pageId": "amazon_page", "locator": "aid-009"}}
    ]
  ],
  "source": {"type": "manual"},
  "x": 100,
  "y": 150,
  "width": 400,
  "height": 200
}
\`\`\`

### Message Format

**Message interface** (from types.tsx):
\`\`\`typescript
interface Message {
  role: 'user' | 'assistant';
  message: string;
  chatType?: 'chat' | 'infer' | 'suggest';
  id?: string;
  isRetrying?: boolean;
  instancesCheckpoint?: Instance[];
  operations?: string[];
}
\`\`\`

**@[InstanceId] Reference Syntax**:
Users can reference instances in messages using @ notation:
- "complete @Table1" - refers to instance with id "Table1"
- "clean the price column in @ProductTable"
- "compare @AmazonData with @eBayData"

**Example conversation_history**:
\`\`\`json
[
  {
    "role": "user",
    "message": "I started extracting cameras from Amazon. Can you complete @ProductList with all 20 products?"
  },
  {
    "role": "assistant",
    "message": "I'll extract all 20 camera products from the Amazon search page into @ProductList.",
    "operations": ["Extracted 20 products using extractBatch", "Created table ProductList"]
  },
  {
    "role": "user",
    "message": "Great! Now clean the Price column to remove $ and commas."
  }
]
\`\`\`

### Recent Logs Format

**CRITICAL**: The \`recent_logs\` field is a **simple string array** - NOT structured objects!

**KEY INSIGHT**: WebSeek uses a **table editor system**. When users edit tables, they enter/exit editor sessions:
- Entering: "Edit table \\"X\\" by editing the embedded table \\"X_1\\""
- Exiting: "Saved and closed the table editor. Created [X_1](#instance-X_1) from [X](#instance-X)"
- This pattern is CRUCIAL for WebSeek to understand if user is in main view or table editor
- In editor: suggestions focus on table-level operations (micro suggestions)
- In main view: suggestions focus on workflow/cross-instance operations (macro suggestions)

Each log entry is a human-readable string describing a user action or system event. Examples:

**Instance Operations**:
- "Created table \\"ProductTable\\""
- "Updated table \\"CountryList\\""
- "Removed visualization \\"PriceChart\\""
- "Created text \\"Notes\\""
- "Updated image \\"Screenshot\\""

**Page Navigation**:
- "Opened page: Amazon Camera Search"
- "Navigated to eBay used cameras"
- "Loaded Wikipedia countries page"

**Tool/Suggestion Execution**:
- "Applied suggestion - Extracted 20 products"
- "Applied suggestion - Sorted table by Price"
- "Applied suggestion - Cleaned Price column"
- "Executed extractBatch on Amazon page"
- "Merged ProductTable with PriceComparison"

**Workspace Actions**:
- "Named workspace \\"Camera Price Analysis\\""
- "Renamed workspace to \\"Country Demographics\\""

**Editor Entry/Exit** (CRITICAL for context):
- "Edit table \\"ProductTable\\" by editing the embedded table \\"ProductTable_1\\"" (entering editor)
- "Saved and closed the table editor. Created [ProductTable_1](#instance-ProductTable_1) from [ProductTable](#instance-ProductTable)" (exiting editor)
- "Saved and closed the table editor. Created [CountryList](#instance-CountryList) with [USA](#instance-_abc123), [China](#instance-_def456)" (exiting after initial creation)

**User Edits** (while IN table editor):
- "Add text \\"_xyz789\\" to table cell (3, A) in table \\"ProductTable\\""
- "Add text \\"_abc123\\" to table cell (1, B) in table \\"CountryList\\""
- "Add column after column C in table \\"ProductTable\\""
- "Add row to CountryList"
- "Removed column Rating from MovieData"

**AI Interactions**:
- "User asked: 'Can you sort this by price?'"
- "AI suggested: Extract all camera brands"
- "User accepted proactive suggestion"

**Format Rules**:
1. Each log is a plain string (not JSON object)
2. Use double quotes for instance IDs/names: "ProductTable" not 'ProductTable'
3. Keep logs concise but descriptive (under 100 chars)
4. Use past tense for completed actions
5. Reference instance IDs when relevant
6. Logs should reflect sequential progress toward the task goal

**Example recent_logs for a medium-difficulty task** (showing editor entry/exit):
\`\`\`json
"recent_logs": [
  "Opened page: Amazon Camera Search",
  "Created table \\"ProductTable\\"",
  "Edit table \\"ProductTable\\" by editing the embedded table \\"ProductTable_1\\"",
  "Add text \\"_a1b2c3\\" to table cell (1, A) in table \\"ProductTable_1\\"",
  "Add text \\"_d4e5f6\\" to table cell (2, A) in table \\"ProductTable_1\\"",
  "Add text \\"_g7h8i9\\" to table cell (3, A) in table \\"ProductTable_1\\"",
  "Applied suggestion - Updated cells: R0C0, R0C1, R1C0, R1C1, R2C0, R2C1",
  "Add text \\"_j0k1l2\\" to table cell (4, A) in table \\"ProductTable_1\\"",
  "Add text \\"_m3n4o5\\" to table cell (5, A) in table \\"ProductTable_1\\"",
  "Saved and closed the table editor. Created [ProductTable_1](#instance-ProductTable_1) from [ProductTable](#instance-ProductTable) with [Canon EOS](#instance-_a1b2c3), [$679.00](#instance-_d4e5f6)",
  "User asked: 'Can you complete the extraction with all 20 products?'",
  "Edit table \\"ProductTable_1\\" by editing the embedded table \\"ProductTable_1_1\\"",
  "Applied suggestion - Extracted remaining 15 products",
  "Saved and closed the table editor. Created [ProductTable_1_1](#instance-ProductTable_1_1) from [ProductTable_1](#instance-ProductTable_1)"
]
\`\`\`

**Example recent_logs for a hard-difficulty task** (showing complex multi-step workflow with editor sessions):
\`\`\`json
"recent_logs": [
  "Opened page: Amazon Camera Search",
  "Created table \\"AmazonProducts\\"",
  "Edit table \\"AmazonProducts\\" by editing the embedded table \\"AmazonProducts_1\\"",
  "Applied suggestion - Extracted 20 cameras into AmazonProducts_1",
  "Add text \\"_p1q2r3\\" to table cell (1, B) in table \\"AmazonProducts_1\\"",
  "Add text \\"_s4t5u6\\" to table cell (2, B) in table \\"AmazonProducts_1\\"",
  "Saved and closed the table editor. Created [AmazonProducts_1](#instance-AmazonProducts_1) from [AmazonProducts](#instance-AmazonProducts)",
  "Executed searchAndReplace on column Price in AmazonProducts_1",
  "Converted column Price to numeral type in AmazonProducts_1",
  "Added computed column \\"PricePerMegapixel\\" to AmazonProducts_1",
  "Sorted AmazonProducts_1 by Price ascending",
  "Opened page: eBay Used Cameras",
  "Created table \\"eBayProducts\\"",
  "Edit table \\"eBayProducts\\" by editing the embedded table \\"eBayProducts_1\\"",
  "Applied suggestion - Extracted 15 cameras into eBayProducts_1",
  "Saved and closed the table editor. Created [eBayProducts_1](#instance-eBayProducts_1) from [eBayProducts](#instance-eBayProducts)",
  "Executed searchAndReplace on column Current Bid in eBayProducts_1",
  "Renamed column \\"Current Bid\\" to \\"Price\\" in eBayProducts_1",
  "Converted column Price to numeral type in eBayProducts_1",
  "Filled missing values in column Condition in eBayProducts_1 with 'Unknown'",
  "User asked: 'Now merge these tables to compare prices for the same camera models'"
]
\`\`\`

**Example recent_logs for cleaning/profiling task** (showing iterative refinement with editor sessions):
\`\`\`json
"recent_logs": [
  "Opened page: Wikipedia Countries",
  "Created table \\"CountryData\\"",
  "Edit table \\"CountryData\\" by editing the embedded table \\"CountryData_1\\"",
  "Applied suggestion - Extracted 30 countries",
  "Saved and closed the table editor. Created [CountryData_1](#instance-CountryData_1) from [CountryData](#instance-CountryData)",
  "Edit table \\"CountryData_1\\" by editing the embedded table \\"CountryData_1_1\\"",
  "Updated table \\"CountryData_1_1\\" schema - added column types",
  "Executed searchAndReplace on column Population - removed commas",
  "Attempted to convert column Population to numeral - found 3 invalid values",
  "Add text \\"_w7x8y9\\" to table cell (8, B) in table \\"CountryData_1_1\\"",
  "Add text \\"_z0a1b2\\" to table cell (15, B) in table \\"CountryData_1_1\\"",
  "Add text \\"_c3d4e5\\" to table cell (22, B) in table \\"CountryData_1_1\\"",
  "Converted column Population to numeral type in CountryData_1_1",
  "Saved and closed the table editor. Created [CountryData_1_1](#instance-CountryData_1_1) from [CountryData_1](#instance-CountryData_1)",
  "User asked: 'The growth rates have +/- symbols, clean those too'",
  "Edit table \\"CountryData_1_1\\" by editing the embedded table \\"CountryData_1_1_1\\"",
  "Executed searchAndReplace on column Growth Rate - removed + symbols",
  "Executed searchAndReplace on column Growth Rate - removed % symbols",
  "Converted column Growth Rate to numeral type in CountryData_1_1_1",
  "Sorted CountryData_1_1_1 by Population descending",
  "Saved and closed the table editor. Created [CountryData_1_1_1](#instance-CountryData_1_1_1) from [CountryData_1_1](#instance-CountryData_1_1)",
  "Added computed column \\"PopulationDensity\\" to CountryData_1_1_1",
  "User asked: 'Some density values look wrong, can you check the calculation?'"
]
\`\`\`

**Example recent_logs for visualization task** (showing data prep + viz with editor sessions):
\`\`\`json
"recent_logs": [
  "Opened page: IMDb Top Movies",
  "Created table \\"MovieData\\"",
  "Edit table \\"MovieData\\" by editing the embedded table \\"MovieData_1\\"",
  "Applied suggestion - Extracted 30 movies",
  "Saved and closed the table editor. Created [MovieData_1](#instance-MovieData_1) from [MovieData](#instance-MovieData)",
  "Edit table \\"MovieData_1\\" by editing the embedded table \\"MovieData_1_1\\"",
  "Converted column Rating to numeral type in MovieData_1_1",
  "Executed searchAndReplace on column Votes - removed commas",
  "Converted column Votes to numeral type in MovieData_1_1",
  "Filtered MovieData_1_1 to show only movies with Rating >= 8.5",
  "Saved and closed the table editor. Created [MovieData_1_1](#instance-MovieData_1_1) from [MovieData_1](#instance-MovieData_1)",
  "Created visualization \\"RatingDistribution\\" - bar chart",
  "User asked: 'Can you color the bars by decade?'",
  "Edit table \\"MovieData_1_1\\" by editing the embedded table \\"MovieData_1_1_1\\"",
  "Added computed column \\"Decade\\" using formula Math.floor(Year/10)*10",
  "Saved and closed the table editor. Created [MovieData_1_1_1](#instance-MovieData_1_1_1) from [MovieData_1_1](#instance-MovieData_1_1)",
  "Updated visualization \\"RatingDistribution\\" - added color by Decade",
  "User asked: 'Now show me a scatter plot of rating vs votes'"
]
\`\`\`

**Example recent_logs for cross-page merging task** (showing complex joins with multiple editor sessions):
\`\`\`json
"recent_logs": [
  "Opened page: LinkedIn Job Postings",
  "Created table \\"JobPostings\\"",
  "Edit table \\"JobPostings\\" by editing the embedded table \\"JobPostings_1\\"",
  "Applied suggestion - Extracted 20 job postings",
  "Saved and closed the table editor. Created [JobPostings_1](#instance-JobPostings_1) from [JobPostings](#instance-JobPostings)",
  "Edit table \\"JobPostings_1\\" by editing the embedded table \\"JobPostings_1_1\\"",
  "Renamed column \\"Posted Date\\" to \\"Date\\" in JobPostings_1_1",
  "Filtered JobPostings_1_1 to show only data scientist positions",
  "Removed column \\"Company Logo\\" from JobPostings_1_1",
  "Saved and closed the table editor. Created [JobPostings_1_1](#instance-JobPostings_1_1) from [JobPostings_1](#instance-JobPostings_1)",
  "Opened page: Indeed Salary Data",
  "Created table \\"SalaryData\\"",
  "Edit table \\"SalaryData\\" by editing the embedded table \\"SalaryData_1\\"",
  "Applied suggestion - Extracted 15 locations",
  "Saved and closed the table editor. Created [SalaryData_1](#instance-SalaryData_1) from [SalaryData](#instance-SalaryData)",
  "Edit table \\"SalaryData_1\\" by editing the embedded table \\"SalaryData_1_1\\"",
  "Executed searchAndReplace on column Average Salary - removed $ and commas",
  "Converted column Average Salary to numeral type in SalaryData_1_1",
  "Saved and closed the table editor. Created [SalaryData_1_1](#instance-SalaryData_1_1) from [SalaryData_1](#instance-SalaryData_1)",
  "User asked: 'Merge the salary data with job postings by location'",
  "Attempted merge - found location name mismatches",
  "Edit table \\"JobPostings_1_1\\" by editing the embedded table \\"JobPostings_1_1_1\\"",
  "Executed searchAndReplace on column Location - standardized format",
  "Saved and closed the table editor. Created [JobPostings_1_1_1](#instance-JobPostings_1_1_1) from [JobPostings_1_1](#instance-JobPostings_1_1)",
  "Edit table \\"SalaryData_1_1\\" by editing the embedded table \\"SalaryData_1_1_1\\"",
  "Executed searchAndReplace on column Location - standardized format",
  "Saved and closed the table editor. Created [SalaryData_1_1_1](#instance-SalaryData_1_1_1) from [SalaryData_1_1](#instance-SalaryData_1_1)",
  "Merged JobPostings_1_1_1 and SalaryData_1_1_1 by Location",
  "Created merged table \\"JobsWithSalary\\"",
  "User asked: 'Calculate the salary difference from average for each job'"
]
\`\`\`
`;

/**
 * Generate a single task using OpenRouter API
 */
async function generateSingleTask(taskSpec, taskNumber) {
  const { category, difficulty, page } = taskSpec;
  
  // Get page information
  let pageInfo = null;
  let pageUrls = [];
  
  if (page && page !== 'multiple' && !page.includes('+')) {
    pageInfo = CONTROLLED_WEBPAGES.find(p => p.id === page);
    pageUrls = [pageInfo.url];
  } else if (page && page.includes('+')) {
    // Cross-page task with specific pages
    const pageIds = page.split('+');
    const pages = pageIds.map(id => CONTROLLED_WEBPAGES.find(p => p.id === id));
    pageUrls = pages.map(p => p.url);
    pageInfo = {
      id: page,
      description: `Cross-page task combining: ${pageIds.join(' and ')}`,
      pages: pages
    };
  }

  // Build task-specific context
  let taskContext = '';
  if (category === 'discovery') {
    // For discovery tasks, suggest navigating between controlled pages
    const availablePages = CONTROLLED_WEBPAGES.map(p => `- ${p.id}: ${p.description} (${p.url})`).join('\n');
    taskContext = `
**Task Type**: Discovery (Navigation between controlled pages)

**Available Controlled Pages**:
${availablePages}

**Scenario Ideas**:
- User is analyzing Amazon cameras, suggest opening eBay cameras page to compare prices
- User reviewed job postings on LinkedIn, suggest opening Indeed salaries page for compensation data
- User extracted IMDb movie data, suggest opening Goodreads books page for related content analysis
- After looking at Wikipedia demographics, suggest opening election results page for political context

Generate a task where the user needs to navigate from one context to another using openPage, choosing appropriate pages from the list above.
The starting_url should be one controlled page, and the golden_tool_sequence should use openPage to navigate to another controlled page.
`;
  } else if (category === 'cross-page') {
    if (page.includes('+')) {
      const pages = pageInfo.pages;
      taskContext = `
**Task Type**: Cross-Page (Data Merging/Comparison)
**Pages**: ${pages.map(p => p.id).join(' + ')}

${pages.map(p => `
**${p.id}**:
- Description: ${p.description}
- URL: ${p.url}
- Data Structure: ${p.dataStructure}
- Data Issues: ${p.dataIssues}
- Suitable Tools: ${p.suitableTools.join(', ')}
`).join('\n')}

**Task Requirements**:
- Starting URLs should include BOTH pages: ${JSON.stringify(pageUrls)}
- Task should require mergeInstances or comparing/analyzing data across pages
- Example: Compare camera prices between Amazon and eBay, join job postings with salary data, etc.
`;
    } else {
      taskContext = `
**Task Type**: Cross-Page (Multiple Pages - choose 2-3)
Choose 2-3 appropriate pages from the 20 controlled pages for a data merging/comparison task.
The task should require mergeInstances or cross-page analysis.
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
- Suitable Tools: ${pageInfo.suitableTools.join(', ')}

Generate a task that uses THIS specific webpage.
`;
  }

  // Canvas and Conversation generation guidelines
  const canvasGuidelines = difficulty === 'easy' ? `
**Initial Canvas State**: EMPTY
- instances: []
- focus_instance_id: null

**Conversation History**: EMPTY
- conversation_history: []

**Rationale**: Easy tasks start from scratch with no prior work.
` : difficulty === 'medium' ? `
**Initial Canvas State**: PARTIAL WORK (30-50% complete)
Generate 1-2 instances showing initial work with realistic imperfections:
- A table with 3-8 sample rows (incomplete dataset showing pattern but not full extraction)
- Include cells with actual data from the source page (use realistic values)
- Tables may have issues: some cells with raw formatting ($, commas), inconsistent types
- Column names may be rough: "Column1", or extracted headers that need cleaning
- Set focus_instance_id to the primary working instance

**Conversation History**: 2-3 messages
Show realistic user-AI interaction with @[InstanceId] references:
- User describes partial work: "I extracted a few rows into @ProductTable but got tired"
- AI acknowledges: "I can help complete @ProductTable with all 20 products"
- User requests next step: "Also, can you clean the Price column?"

**Recent Logs**: 4-8 entries showing the work done so far:
- Include specific actions: table creation, extractions, edits, column operations
- Show iterative refinement: "Edited cell in ProductTable at row 3", "Renamed column X to Y"
- Mix of manual edits and AI suggestions
- Last log should set up the current task need

Use realistic instance IDs like "ProductTable", "CountryList", "MovieData", etc.

**Rationale**: Medium tasks show user has started extraction/cleaning but needs AI to complete/refine with remaining operations.
` : `
**Initial Canvas State**: SUBSTANTIAL WORK (50-70% complete)
Generate 2-4 instances showing significant progress with realistic complexity:
- Multiple tables, each with 5-15 rows of actual data
- Some successful cleaning operations (some columns already cleaned, others still messy)
- Mix of completed steps and remaining issues
- May include intermediate visualizations or computed columns
- Show realistic data quality issues: missing values, format inconsistencies, type mismatches
- Set focus_instance_id to the instance needing the next operation

**Conversation History**: 3-5 messages
Show realistic multi-turn workflow with @[InstanceId] references and problem-solving:
- User describes completed work: "I extracted @AmazonProducts and @eBayProducts"
- AI acknowledges intermediate steps: "I cleaned the Price columns in both tables"
- User identifies new problems: "@AmazonProducts has some missing Brand values"
- User requests complex operations: "Now merge @AmazonProducts with @eBayProducts to compare prices"
- Include failed attempts or refinements: "The merge didn't work because location names don't match"

**Recent Logs**: 10-20 entries showing extensive workflow:
- Multiple page navigations and table creations
- Series of data cleaning operations (searchAndReplace, convertColumnType, fillMissingValues)
- Iterative refinements with specific row/column edits
- Include failed attempts: "Attempted to convert column X to numeral - found 3 invalid values"
- Show computed columns, filters, sorts applied
- Mix of user manual edits and AI-applied suggestions
- Build toward a complex final operation (merge, visualization, complex transformation)

**Rationale**: Hard tasks show user has done extensive multi-step work across multiple instances but needs help with complex cross-instance operations, fixing accumulated issues, or final synthesis steps.
`;

  const toolDescriptions = `
**Available Tools** (16 tools):

1. **openPage**(url, description, openInBackground): Opens a webpage (MUST be one of the 20 controlled pages)
2. **selectElements**(selector, pageUrl): Identifies and selects DOM elements for extraction
3. **inferSchema**(pageUrl, targetElement): Analyzes webpage structure and infers data schema
4. **extractBatch**(pageUrl, pattern, maxItems): Extracts multiple similar entries in batch
5. **updateInstance**(instanceId, newInstance): Updates an instance with new values
6. **addComputedColumn**(instanceId, formula, newColumnName): Creates computed columns
7. **tableSort**(instanceId, columnName, order, secondarySort?): Sorts table data
8. **tableFilter**(instanceId, conditions, operator?): Filters table rows by criteria
9. **renameColumn**(instanceId, oldColumnName, newColumnName): Renames table columns
10. **formatColumn**(instanceId, columnName, formatPattern): Formats column values
11. **searchAndReplace**(instanceId, searchPattern, replaceWith, useRegex?, columnName?): Find/replace text
12. **convertColumnType**(instanceId, columnName, targetType, cleaningPattern?, replaceWith?): Type conversion
13. **fillMissingValues**(instanceId, columnName, strategy, constantValue?, missingIndicators?): Imputes missing data
14. **createVisualization**(sourceInstanceId, chartType, xAxis, yAxis?, title?): Creates visualizations
15. **mergeInstances**(sourceInstanceIds, mergeStrategy, joinColumns?, newInstanceName?): Joins/merges tables

See full parameter details and examples in the tool descriptions section below.
`;

  const prompt = `You are an HCI researcher creating a technical evaluation benchmark for an AI-powered web data analysis system.

  Each task in this benchmark should include a description of the goal, the source webpages, the golden tool sequence to accomplish the task, and the expected number of tools needed.

  - 

  - Source webpages: One or more webpage selected from a controlled set of 20 webpages (see controlled webpage list below). You only need to specify the webpage IDs in source_pages. Do NOT include any webpages outside the controlled set.

${TYPE_SYSTEM_DOCS}

${toolDescriptions}

## Task Specification

${taskContext}

**Difficulty Level**: ${difficulty.toUpperCase()}
${difficulty === 'easy' ? '- 1-2 tool calls, single-step operation' : ''}
${difficulty === 'medium' ? '- 3-4 tool calls, tool sequences with dependencies' : ''}
${difficulty === 'hard' ? '- 5+ tool calls, complex multi-instance operations' : ''}

${canvasGuidelines}

## Output Format

Return ONLY valid JSON (no markdown, no code blocks):

\`\`\`json
{
  "task_id": "T${String(taskNumber).padStart(3, '0')}",
  "task_category": "${category}",
  "difficulty": "${difficulty}",
  ${page ? `"page": "${page}",` : ''}
  "goal_description": "Clear description of what user wants to accomplish",
  
  "source_pages": ["appropriate_controlled_page_id"],
  
  "initial_canvas_state": {
    "instances": [/* Generate based on difficulty - can be empty for easy tasks */],
    "focus_instance_id": null /* or instance ID if applicable */
  },
  
  "conversation_history": [
    /* Generate based on difficulty - can be empty for easy tasks */
    /* Use @[InstanceId] syntax to reference instances */
  ],
  
  "recent_logs": [
    "User action 1",
    "User action 2"
  ],
  
  "golden_tool_sequence": [
    {
      "function": "toolName",
      "parameters": { /* valid parameters for the tool */ }
    }
  ],
  
  "expected_tools": 2
}
\`\`\`

**CRITICAL REMINDERS**:
- starting_url is ARRAY not string
- NO html_context field
- ALL URLs from controlled pages only
- Generate realistic canvas/conversation for medium/hard tasks
- Use @[InstanceId] syntax in conversation messages
- Return only JSON, no markdown formatting

Generate the task now.`;

  console.log(`\n[${taskNumber}/50] Generating ${difficulty} ${category} task${page ? ` for ${page}` : ''}...`);

  try {
    const requestBody = JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are an expert HCI researcher creating benchmark datasets. Return ONLY valid JSON with no markdown.'
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

    // --- Post-processing and validation ---
    // If the model produced a `starting_url` field (legacy), convert it to `source_pages`
    if (task.starting_url) {
      if (!Array.isArray(task.starting_url)) task.starting_url = [task.starting_url];
      const urlToId = (u) => {
        const found = CONTROLLED_WEBPAGES.find(p => p.url === u || p.url === u.replace(/\/$/, ''));
        return found ? found.id : null;
      };
      task.source_pages = task.starting_url.map(u => urlToId(u) || u).filter(Boolean);
      delete task.starting_url;
    }

    // Ensure `source_pages` exists; if not, infer from the generator spec page
    if (!task.source_pages || !Array.isArray(task.source_pages) || task.source_pages.length === 0) {
      if (page && typeof page === 'string') {
        task.source_pages = page.includes('+') ? page.split('+') : [page];
      } else {
        task.source_pages = [];
      }
    }

    // Remove html_context if present; real HTML will be filled later in the form:
    // "[webpage id]: [raw HTML], [webpage id]: [raw HTML], ..."
    if (task.html_context) {
      delete task.html_context;
    }
    
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
    return false;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('=== WebSeek Benchmark Task Generator V2 ===');
  console.log(`Model: ${MODEL}`);
  console.log('MAJOR CHANGES:');
  console.log('- starting_url is now ARRAY (supports multi-page tasks)');
  console.log('- html_context removed (will be filled later)');
  console.log('- 20 diverse controlled webpages');
  console.log('- Generates realistic canvas/conversation states');
  console.log('- openPage tasks reference controlled pages only\n');

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

  // Optional preview limit for testing (set PREVIEW_LIMIT env var)
  const PREVIEW_LIMIT = process.env.PREVIEW_LIMIT ? parseInt(process.env.PREVIEW_LIMIT, 10) : null;
  if (PREVIEW_LIMIT && Number.isInteger(PREVIEW_LIMIT) && PREVIEW_LIMIT > 0) {
    console.log(`[PREVIEW_MODE] Limiting generation to first ${PREVIEW_LIMIT} tasks for quick testing.`);
    taskSpecs.splice(PREVIEW_LIMIT);
  }

  console.log(`Total tasks to generate: ${taskSpecs.length}\n`);

  // Generate tasks one at a time
  for (const spec of taskSpecs) {
    const task = await generateSingleTask(spec, taskNumber);
    
    if (task) {
      allTasks.push(task);
    } else {
      console.log(`  ⚠️  Skipping failed task ${taskNumber}`);
    }
    
    taskNumber++;
    
    // Rate limiting: wait 2 seconds between requests
    if (taskNumber <= taskSpecs.length) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Save to file
  const outputDir = join(__dirname, 'data');
  const outputFile = join(outputDir, 'benchmark_tasks_v2.json');
  
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
  
  console.log('\n✓ Task generation complete!');
  console.log('\nNext steps:');
  console.log('1. Review tasks in data/benchmark_tasks_v2.json');
  console.log('2. Create 20 HTML snapshot files');
  console.log('3. Run post-processor to fill html_context from actual HTML');
  console.log('4. Manually verify golden sequences');
}

main();
