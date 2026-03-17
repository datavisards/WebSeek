#!/usr/bin/env node
/**
 * Task Generator Runner - Version 3 (Clean Start)
 * 
 * CHANGES FROM V2:
 * - Removed all system state fields (html_context, initial_canvas_state, conversation_history, recent_logs)
 * - Each task is just: task_id, description, difficulty, source_pages
 * - Users start from scratch for each task
 * - Focuses on task definition and expected tool usage only
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
    description: 'Twitter trending topics',
    url: 'https://twitter.com/explore/trending',
    dataStructure: '15 trending topics with columns: Rank, Topic, Category, Tweets (XXK format), Change (↑↓±X.X%)',
    dataIssues: 'K suffix on numbers, unicode arrows, mixed percentage formats',
    suitableTools: ['extractBatch', 'tableFilter', 'tableSort', 'convertColumnType', 'searchAndReplace', 'createVisualization']
  },
  {
    id: 'reddit_posts',
    filename: 'reddit_posts.html',
    description: 'Reddit r/datascience hot posts',
    url: 'https://www.reddit.com/r/datascience/hot',
    dataStructure: '20 posts with columns: Title, Author, Upvotes (XXk format), Comments, Time Posted (relative), Flair',
    dataIssues: 'k suffix on numbers, relative time strings (3h ago, 2d ago)',
    suitableTools: ['extractBatch', 'tableFilter', 'tableSort', 'convertColumnType', 'searchAndReplace']
  },
  {
    id: 'linkedin_jobs',
    filename: 'linkedin_jobs.html',
    description: 'LinkedIn data analyst job postings',
    url: 'https://www.linkedin.com/jobs/search/?keywords=data%20analyst',
    dataStructure: '25 job postings with columns: Job Title, Company, Location, Posted Date (relative), Applicants (XX applicants), Level (Entry/Mid/Senior)',
    dataIssues: 'Relative dates, natural language applicant counts',
    suitableTools: ['extractBatch', 'tableFilter', 'tableSort', 'convertColumnType', 'searchAndReplace', 'createVisualization']
  },
  {
    id: 'stackoverflow_questions',
    filename: 'stackoverflow_questions.html',
    description: 'Stack Overflow Python questions',
    url: 'https://stackoverflow.com/questions/tagged/python',
    dataStructure: '18 questions with columns: Title, Votes, Answers, Views (XXk format), Asked (relative time), Tags',
    dataIssues: 'k suffix on views, multiple tags per question, relative time',
    suitableTools: ['extractBatch', 'tableFilter', 'tableSort', 'convertColumnType', 'searchAndReplace']
  },
  {
    id: 'weather_cities',
    filename: 'weather_cities.html',
    description: 'Weather.com major city forecasts',
    url: 'https://weather.com/weather/today',
    dataStructure: '20 cities with columns: City, Temperature (XX°F/°C), Condition, Humidity (XX%), Wind (XX mph), Precipitation (%)',
    dataIssues: 'Mixed temperature units, % and mph units need cleaning',
    suitableTools: ['extractBatch', 'tableFilter', 'tableSort', 'convertColumnType', 'searchAndReplace', 'createVisualization']
  },
  {
    id: 'zillow_homes',
    filename: 'zillow_homes.html',
    description: 'Zillow home listings',
    url: 'https://www.zillow.com/homes/',
    dataStructure: '15 homes with columns: Address, Price ($XXX,XXX), Beds (X bd), Baths (X ba), Sqft (X,XXX sqft), $/sqft ($XXX)',
    dataIssues: 'Price has $ and commas, bd/ba/sqft suffixes need parsing',
    suitableTools: ['extractBatch', 'tableFilter', 'tableSort', 'convertColumnType', 'searchAndReplace', 'createVisualization', 'addComputedColumn']
  },
  {
    id: 'google_finance',
    filename: 'google_finance.html',
    description: 'Google Finance stock prices',
    url: 'https://www.google.com/finance',
    dataStructure: '12 stocks with columns: Ticker, Company, Price ($XXX.XX), Change ($±X.XX), Change% (±X.XX%), Volume (X.XXM)',
    dataIssues: '+/- symbols, % symbols, M suffix on volume, need to handle negative changes',
    suitableTools: ['extractBatch', 'tableFilter', 'tableSort', 'convertColumnType', 'searchAndReplace', 'createVisualization']
  },
  {
    id: 'espn_nba',
    filename: 'espn_nba.html',
    description: 'ESPN NBA team standings',
    url: 'https://www.espn.com/nba/standings',
    dataStructure: '30 teams with columns: Rank, Team, W (wins), L (losses), Win% (.XXX), GB (games behind), Streak (WX/LX)',
    dataIssues: 'Win% is decimal .XXX format, GB has - for leader, streak needs parsing',
    suitableTools: ['extractBatch', 'tableFilter', 'tableSort', 'convertColumnType', 'fillMissingValues', 'createVisualization']
  },
  {
    id: 'booking_hotels',
    filename: 'booking_hotels.html',
    description: 'Booking.com hotel search results',
    url: 'https://www.booking.com/searchresults.html',
    dataStructure: '20 hotels with columns: Hotel Name, Rating (X.X), Reviews (X,XXX reviews), Price ($XXX/night), Distance (X.X mi from center)',
    dataIssues: 'Price has /night suffix, reviews has natural language, distance has mi unit',
    suitableTools: ['extractBatch', 'tableFilter', 'tableSort', 'convertColumnType', 'searchAndReplace', 'createVisualization']
  },
  {
    id: 'yelp_restaurants',
    filename: 'yelp_restaurants.html',
    description: 'Yelp restaurant listings',
    url: 'https://www.yelp.com/search?find_desc=restaurants',
    dataStructure: '15 restaurants with columns: Name, Rating (X.X stars), Reviews (XXX), Price ($ to $$$$), Category, Delivery (Yes/No)',
    dataIssues: 'stars suffix, multiple $, mixed category strings',
    suitableTools: ['extractBatch', 'tableFilter', 'tableSort', 'convertColumnType', 'searchAndReplace']
  },
  {
    id: 'coinmarketcap',
    filename: 'coinmarketcap.html',
    description: 'CoinMarketCap top cryptocurrencies',
    url: 'https://coinmarketcap.com/',
    dataStructure: '20 cryptocurrencies with columns: Rank, Name, Symbol, Price ($X,XXX.XX), 24h%, 7d%, Market Cap ($XXB/$XXM)',
    dataIssues: 'Mixed B/M suffixes on market cap, +/- on percentages, varying decimal places',
    suitableTools: ['extractBatch', 'tableFilter', 'tableSort', 'convertColumnType', 'searchAndReplace', 'createVisualization']
  },
  {
    id: 'goodreads_books',
    filename: 'goodreads_books.html',
    description: 'Goodreads bestselling books',
    url: 'https://www.goodreads.com/book/popular_by_date',
    dataStructure: '18 books with columns: Title, Author, Rating (X.XX), Ratings (X,XXX,XXX), Published (YYYY), Genre',
    dataIssues: 'Ratings have commas, multiple genres per book',
    suitableTools: ['extractBatch', 'tableFilter', 'tableSort', 'convertColumnType', 'searchAndReplace', 'createVisualization']
  },
  {
    id: 'crunchbase_startups',
    filename: 'crunchbase_startups.html',
    description: 'Crunchbase AI startup funding',
    url: 'https://www.crunchbase.com/search/companies',
    dataStructure: '10 startups with columns: Company, Industry, Funding ($XXM/$XXB), Investors, Founded (YYYY), Location',
    dataIssues: 'Mixed M/B suffixes, multiple investors per company',
    suitableTools: ['extractBatch', 'tableFilter', 'tableSort', 'convertColumnType', 'searchAndReplace', 'createVisualization']
  },
  {
    id: 'producthunt_products',
    filename: 'producthunt_products.html',
    description: 'Product Hunt featured products',
    url: 'https://www.producthunt.com/',
    dataStructure: '15 products with columns: Product Name, Tagline, Upvotes, Comments, Category, Maker',
    dataIssues: 'Some products have multiple categories, natural language counts',
    suitableTools: ['extractBatch', 'tableFilter', 'tableSort', 'convertColumnType']
  }
];

// WebSeek tool catalog
const WEBSEEK_TOOLS = [
  {
    name: 'openPage',
    category: 'Navigation',
    description: 'Open a webpage and load its content into WebSeek',
    parameters: ['url'],
    typical_use: 'Starting point of most tasks - opens the source webpage'
  },
  {
    name: 'extractBatch',
    category: 'Extraction',
    description: 'Batch extract similar data elements from a webpage (e.g., all product listings)',
    parameters: ['pageInstance', 'elementSelector', 'extractionPattern'],
    typical_use: 'Extract structured data (tables, lists) from webpages'
  },
  {
    name: 'extractSingle',
    category: 'Extraction',
    description: 'Extract a single element from a webpage',
    parameters: ['pageInstance', 'elementSelector'],
    typical_use: 'Extract specific data points (e.g., total count, page title)'
  },
  {
    name: 'createTable',
    category: 'Data Creation',
    description: 'Create an empty table with specified columns',
    parameters: ['tableName', 'columnNames'],
    typical_use: 'Manually create tables before populating with data'
  },
  {
    name: 'createText',
    category: 'Data Creation',
    description: 'Create a text note or comment',
    parameters: ['content'],
    typical_use: 'Add annotations, summaries, or notes to canvas'
  },
  {
    name: 'createSketch',
    category: 'Data Creation',
    description: 'Create a freeform drawing/sketch',
    parameters: ['sketchData'],
    typical_use: 'Add visual annotations or diagrams'
  },
  {
    name: 'tableFilter',
    category: 'Data Transformation',
    description: 'Filter table rows based on conditions',
    parameters: ['tableInstance', 'column', 'operator', 'value'],
    typical_use: 'Subset data (e.g., ratings > 4.0, price < $500)'
  },
  {
    name: 'tableSort',
    category: 'Data Transformation',
    description: 'Sort table by column(s)',
    parameters: ['tableInstance', 'column', 'direction'],
    typical_use: 'Reorder data (e.g., highest to lowest price)'
  },
  {
    name: 'convertColumnType',
    category: 'Data Transformation',
    description: 'Convert column data type (string → number, number → string, etc.)',
    parameters: ['tableInstance', 'column', 'targetType'],
    typical_use: 'Convert text prices to numbers, format dates'
  },
  {
    name: 'searchAndReplace',
    category: 'Data Transformation',
    description: 'Find and replace text/patterns in a column',
    parameters: ['tableInstance', 'column', 'searchPattern', 'replacement'],
    typical_use: 'Clean data (remove $, remove commas, standardize formats)'
  },
  {
    name: 'fillMissingValues',
    category: 'Data Transformation',
    description: 'Fill null/empty cells with a value or strategy',
    parameters: ['tableInstance', 'column', 'fillStrategy'],
    typical_use: 'Handle missing data (fill with 0, mean, forward-fill, etc.)'
  },
  {
    name: 'addComputedColumn',
    category: 'Data Transformation',
    description: 'Add a new column based on computations from existing columns',
    parameters: ['tableInstance', 'newColumnName', 'formula'],
    typical_use: 'Calculate derived values (total = quantity × price)'
  },
  {
    name: 'formatColumn',
    category: 'Data Transformation',
    description: 'Apply formatting to column values (e.g., number precision, date format)',
    parameters: ['tableInstance', 'column', 'formatSpec'],
    typical_use: 'Standardize display (2 decimal places, MM/DD/YYYY dates)'
  },
  {
    name: 'mergeInstances',
    category: 'Data Integration',
    description: 'Merge/join two tables or data instances',
    parameters: ['instance1', 'instance2', 'joinType', 'joinKeys'],
    typical_use: 'Combine data from multiple sources (join Amazon + eBay cameras)'
  },
  {
    name: 'createVisualization',
    category: 'Visualization',
    description: 'Create a chart/visualization from table data',
    parameters: ['tableInstance', 'vizType', 'xColumn', 'yColumn', 'options'],
    typical_use: 'Generate bar charts, line graphs, scatter plots from data'
  },
  {
    name: 'deleteInstance',
    category: 'Management',
    description: 'Delete an instance from canvas',
    parameters: ['instanceId'],
    typical_use: 'Remove unwanted instances from workspace'
  },
  {
    name: 'renameInstance',
    category: 'Management',
    description: 'Rename an instance',
    parameters: ['instanceId', 'newName'],
    typical_use: 'Give meaningful names to tables/visualizations'
  }
];

/**
 * Task Distribution (50 total):
 * - 20 easy (single-page extraction + basic transformation)
 * - 20 medium (multi-step transformations, cleaning, single-page viz)
 * - 10 hard (multi-page merging, complex cleaning, advanced viz)
 */
const TASK_DISTRIBUTION = {
  easy: 20,
  medium: 20,
  hard: 10
};

// OpenRouter API call with retry logic
async function callOpenRouter(messages, retries = 3) {
  const payload = JSON.stringify({
    model: MODEL,
    messages: messages,
    temperature: 0.7,
    max_tokens: 4000
  });

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await new Promise((resolve, reject) => {
        const options = {
          hostname: new URL(OPENROUTER_BASE_URL).hostname,
          path: '/api/v1/chat/completions',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'HTTP-Referer': 'https://github.com/webseek',
            'X-Title': 'WebSeek Task Generator',
            'Content-Length': Buffer.byteLength(payload)
          }
        };

        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            if (res.statusCode === 200) {
              resolve(JSON.parse(data));
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            }
          });
        });

        req.on('error', reject);
        req.write(payload);
        req.end();
      });

      return response;
    } catch (error) {
      console.error(`Attempt ${attempt}/${retries} failed:`, error.message);
      if (attempt === retries) throw error;
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
    }
  }
}

// Generate tasks using OpenRouter with retry logic if count is insufficient
async function generateTasks(count, difficulty, attempt = 1) {
  console.log(`\n=== Generating ${count} ${difficulty} tasks (attempt ${attempt}) ===`);

  const toolList = WEBSEEK_TOOLS.map(t => `- ${t.name}: ${t.description}`).join('\n');
  const webpageList = CONTROLLED_WEBPAGES.map(w =>
    `- ${w.id}: ${w.description}\n  Data: ${w.dataStructure}\n  Issues: ${w.dataIssues}`
  ).join('\n\n');

  const difficultyGuide = {
    easy: `
**Easy Task Requirements:**
- **Webpages:** Exactly 1 source webpage  
- **Operations:** ≤4 column- or cell-based operations (e.g., filtering, sorting, basic parsing)  
- **Visualization:** None  
- **Examples:** Extract a product table; filter by rating ≥4; sort by price; rename one column
`,
    medium: `
**Medium Task Requirements:**
- **Webpages:** 1–2 source webpages  
- **Operations:** 5+ column- or cell-based operations **or**  
- **Visualization:** Includes at least one chart or plot (even with ≤5 operations)  
- **Examples:** Scrape product specs from one site, clean inconsistent prices, convert units, add derived columns, and generate a bar chart
`,
    hard: `
**Hard Task Requirements:**
- **Webpages:** 2+ distinct source webpages  
- **Operations:** ≥5 column- or cell-based operations  
- **Visualization:** Includes at least one visualization  
- **Examples:** Merge tables, reconcile naming differences, compare multiple attributes, handle missing data, and visualize comparisons
`
  };

  const systemPrompt = `You are an expert task designer for data synthesis.

Generate EXACTLY ${count} realistic ${difficulty}-difficulty benchmark tasks. This is critical - you must generate exactly ${count} tasks, no more, no less.

**Available Tools:**
${toolList}

**Available Webpages (MUST use these only):**
${webpageList}

${difficultyGuide[difficulty]}

**Task Format (JSON):**
{
  "description": "Clear, specific task description",
  "source_pages": ["webpage_id1", "webpage_id2"]
}

**CRITICAL RULES:**
1. source_pages MUST contain only webpage IDs from the controlled list (e.g., ["amazon_cameras", "ebay_cameras"])
2. Task descriptions should be natural language (what user wants to accomplish)
3. Tasks should leverage the data issues listed for each webpage (e.g., clean prices, convert units)
4. The available tools listed above will be used to help the user accomplish the tasks. Users will have access to basic data manipulation and visualization functionalities, as well system-generated proactive guidance based on the above tools. Please make sure these tools can be of use for the tasks you generate so that users are likely to actively use the guidance based on them. 

**Output Format:**
Return a JSON array of ${count} task objects. ONLY return the JSON array, no other text.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Generate EXACTLY ${count} ${difficulty} tasks as a JSON array. Count carefully and ensure you provide exactly ${count} task objects.` }
  ];

  console.log(`Calling OpenRouter API (model: ${MODEL})...`);
  const response = await callOpenRouter(messages);

  const content = response.choices[0].message.content.trim();

  // Extract JSON array from markdown code blocks if present
  let jsonText = content;
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    jsonText = jsonMatch[1];
  }

  const tasks = JSON.parse(jsonText);
  console.log(`✓ Generated ${tasks.length} ${difficulty} tasks`);

  // If we didn't get enough tasks, generate more to fill the gap
  if (tasks.length < count && attempt < 3) {
    const remaining = count - tasks.length;
    console.log(`⚠️  Short by ${remaining} tasks, generating more...`);
    const moreTasks = await generateTasks(remaining, difficulty, attempt + 1);
    return [...tasks, ...moreTasks];
  }

  return tasks;
}

// Main execution
async function main() {
  console.log('WebSeek Task Generator v3 - Clean Start (No System State)');
  console.log('='.repeat(60));

  const previewLimit = parseInt(process.env.PREVIEW_LIMIT);
  const isPreview = !isNaN(previewLimit) && previewLimit > 0;

  let allTasks = [];

  if (isPreview) {
    console.log(`\n🔍 PREVIEW MODE: Generating ${previewLimit} tasks only`);
    const distribution = {
      easy: Math.ceil(previewLimit * 0.4),
      medium: Math.ceil(previewLimit * 0.4),
      hard: Math.max(1, previewLimit - Math.ceil(previewLimit * 0.4) * 2)
    };

    for (const [difficulty, count] of Object.entries(distribution)) {
      if (count > 0) {
        const tasks = await generateTasks(count, difficulty);
        allTasks.push(...tasks);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Rate limiting
      }
    }
  } else {
    // Full generation - track tasks by difficulty as we generate them
    const tasksByDifficulty = {};
    for (const [difficulty, count] of Object.entries(TASK_DISTRIBUTION)) {
      const tasks = await generateTasks(count, difficulty);
      tasksByDifficulty[difficulty] = tasks;
      allTasks.push(...tasks);
      await new Promise(resolve => setTimeout(resolve, 2000)); // Rate limiting
    }
  }

  // Post-process and validate tasks
  console.log('\n=== Post-processing tasks ===');

  // Track which difficulty batch each task came from
  let taskIndex = 0;
  const processedTasks = [];

  // Process tasks by difficulty batch
  if (isPreview) {
    const distribution = {
      easy: Math.ceil(previewLimit * 0.4),
      medium: Math.ceil(previewLimit * 0.4),
      hard: Math.max(1, previewLimit - Math.ceil(previewLimit * 0.4) * 2)
    };

    let currentIndex = 0;
    for (const [difficulty, count] of Object.entries(distribution)) {
      if (count > 0) {
        // Take only what we actually have for this difficulty
        const actualCount = Math.min(count, allTasks.slice(currentIndex).length);
        const batch = allTasks.slice(currentIndex, currentIndex + actualCount);
        batch.forEach((task, batchIndex) => {
          const processed = processTask(task, taskIndex++, difficulty);
          processedTasks.push(processed);
        });
        currentIndex += actualCount;
      }
    }
  } else {
    let currentIndex = 0;
    for (const [difficulty, count] of Object.entries(TASK_DISTRIBUTION)) {
      // Take only what we actually have for this difficulty
      const actualCount = Math.min(count, allTasks.slice(currentIndex).length);
      const batch = allTasks.slice(currentIndex, currentIndex + actualCount);
      batch.forEach((task, batchIndex) => {
        const processed = processTask(task, taskIndex++, difficulty);
        processedTasks.push(processed);
      });
      currentIndex += actualCount;
    }
  }

  allTasks = processedTasks;

  function processTask(task, index, difficulty) {
    // Add standardized task_id
    task.task_id = `task_${String(index + 1).padStart(3, '0')}`;

    // Add difficulty tag
    task.difficulty = difficulty;

    // Ensure source_pages is an array of IDs
    if (!Array.isArray(task.source_pages)) {
      task.source_pages = [task.source_pages].filter(Boolean);
    }

    // Validate source_pages contain only controlled webpage IDs
    task.source_pages = task.source_pages.filter(id =>
      CONTROLLED_WEBPAGES.find(w => w.id === id)
    );

    return task;
  }

  // Save to file
  const outputDir = join(__dirname, 'data');
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = join(outputDir, 'benchmark_tasks_v3.json');
  writeFileSync(outputPath, JSON.stringify(allTasks, null, 2));

  console.log(`\n✅ Generated ${allTasks.length} tasks`);
  console.log(`📁 Saved to: ${outputPath}`);

  // Summary statistics
  const summary = {
    total: allTasks.length,
    easy: allTasks.filter(t => t.difficulty === 'easy').length,
    medium: allTasks.filter(t => t.difficulty === 'medium').length,
    hard: allTasks.filter(t => t.difficulty === 'hard').length,
    avg_source_pages: (allTasks.reduce((sum, t) => sum + t.source_pages.length, 0) / allTasks.length).toFixed(2)
  };

  console.log('\n=== Summary ===');
  console.log(`Total tasks: ${summary.total}`);
  console.log(`Easy: ${summary.easy}, Medium: ${summary.medium}, Hard: ${summary.hard}`);
  console.log(`Avg source pages per task: ${summary.avg_source_pages}`);

  if (isPreview) {
    console.log('\n📋 Sample tasks:');
    allTasks.slice(0, 3).forEach(task => {
      console.log(`\n${task.task_id} (${task.difficulty}):`);
      console.log(`  Description: ${task.description}`);
      console.log(`  Source pages: ${task.source_pages.join(', ')}`);
    });
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
