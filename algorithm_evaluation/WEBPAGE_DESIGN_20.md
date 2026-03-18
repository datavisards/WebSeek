# 20 Diverse Controlled Webpages for Evaluation

## Design Principles
- **Diversity**: Cover different domains (e-commerce, social media, government, finance, sports, weather, etc.)
- **Realistic data issues**: Include formatting inconsistencies, missing values, mixed units
- **Tool coverage**: Ensure each webpage supports multiple tool operations
- **Complexity levels**: Range from simple tables to complex nested structures

## Webpage List

### 1. **Amazon Cameras** (E-commerce - Product Listing)
- **URL**: `https://www.amazon.com/s?k=digital+camera`
- **Data**: 20 camera products with price, rating, reviews, brand, Prime badge
- **Issues**: Formatted numbers ($1,234.56), missing Prime badges, inconsistent ratings
- **Tools**: extractBatch, tableFilter, tableSort, convertColumnType, formatColumn, createVisualization

### 2. **eBay Cameras** (E-commerce - Used Products)
- **URL**: `https://www.ebay.com/sch/i.html?_nkw=used+camera`
- **Data**: 15 used camera listings with condition, price, seller rating, location
- **Issues**: Mixed condition labels (like new/excellent/good), price variations
- **Tools**: extractBatch, tableFilter, mergeInstances (for comparison with Amazon)

### 3. **Wikipedia Countries** (Reference - Demographics)
- **URL**: `https://en.wikipedia.org/wiki/List_of_countries_by_population`
- **Data**: 30 countries with population, area, density, GDP, growth rate
- **Issues**: Formatted large numbers with commas, missing GDP data for some countries
- **Tools**: extractBatch, convertColumnType, fillMissingValues, tableSort, createVisualization

### 4. **IMDb Top Movies** (Entertainment - Rankings)
- **URL**: `https://www.imdb.com/chart/top/`
- **Data**: 30 top-rated movies with title, year, rating, votes, director, genre
- **Issues**: Year in parentheses, formatted vote counts, multiple genres per movie
- **Tools**: extractBatch, tableFilter, searchAndReplace, createVisualization, tableSort

### 5. **Kaggle Datasets** (Data Science - Dataset Search)
- **URL**: `https://www.kaggle.com/datasets?search=climate`
- **Data**: 12 climate datasets with name, size (GB/MB), downloads, update date
- **Issues**: Mixed size units (GB/MB), relative dates ("2 months ago"), formatted numbers
- **Tools**: extractBatch, convertColumnType, formatColumn, tableSort, createVisualization

### 6. **GitHub Repositories** (Development - Repository Search)
- **URL**: `https://github.com/search?q=data+analysis`
- **Data**: 10 data analysis repos with name, stars, forks, language, last update
- **Issues**: Abbreviated star counts (42.3k), relative dates, multiple languages
- **Tools**: extractBatch, searchAndReplace, convertColumnType, tableSort, createVisualization

### 7. **Twitter/X Trending Topics** (Social Media - Trends)
- **URL**: `https://twitter.com/explore/tabs/trending`
- **Data**: 15 trending hashtags with name, tweet count, category, timestamp
- **Issues**: Formatted tweet counts (1.2M, 45.6K), mixed categories, timezone issues
- **Tools**: extractBatch, searchAndReplace, convertColumnType, tableFilter, createVisualization

### 8. **LinkedIn Job Postings** (Career - Job Search)
- **URL**: `https://www.linkedin.com/jobs/search/?keywords=data%20scientist`
- **Data**: 20 data scientist jobs with title, company, location, salary range, posted date
- **Issues**: Salary ranges ("$80K-$120K"), missing salaries, relative dates, remote/hybrid labels
- **Tools**: extractBatch, searchAndReplace, fillMissingValues, tableFilter, tableSort

### 9. **Weather.com Forecast** (Weather - 10-Day Forecast)
- **URL**: `https://weather.com/weather/tenday/l/Seattle+WA`
- **Data**: 10-day forecast with date, high/low temp, precipitation %, conditions, wind speed
- **Issues**: Temperature symbols (°F), percentage symbols, wind in mph, mixed condition labels
- **Tools**: extractBatch, convertColumnType, formatColumn, createVisualization

### 10. **Reddit r/dataisbeautiful** (Social Media - Post Listings)
- **URL**: `https://www.reddit.com/r/dataisbeautiful/hot/`
- **Data**: 20 hot posts with title, author, upvotes, comments, awards, posted time
- **Issues**: Formatted upvotes (12.3k), relative times ("2 hours ago"), multiple award types
- **Tools**: extractBatch, searchAndReplace, convertColumnType, tableFilter, tableSort

### 11. **Zillow Real Estate** (Real Estate - Home Listings)
- **URL**: `https://www.zillow.com/homes/Seattle-WA/`
- **Data**: 15 home listings with address, price, beds, baths, sqft, days on market
- **Issues**: Formatted prices ($1,234,567), missing sqft for some, abbreviations (bd/ba)
- **Tools**: extractBatch, convertColumnType, fillMissingValues, tableFilter, tableSort, createVisualization

### 12. **Indeed Salary Data** (Career - Salary Comparison)
- **URL**: `https://www.indeed.com/career/data-scientist/salaries`
- **Data**: 15 locations with average salary, salary range, job count, cost of living index
- **Issues**: Formatted salaries ($123,456), ranges with dashes, missing cost of living for some
- **Tools**: extractBatch, searchAndReplace, convertColumnType, fillMissingValues, createVisualization

### 13. **ESPN NBA Standings** (Sports - League Rankings)
- **URL**: `https://www.espn.com/nba/standings`
- **Data**: 30 NBA teams with wins, losses, win %, games behind, streak, last 10
- **Issues**: Percentage symbols, streak formats (W3/L2), "last 10" as text (7-3)
- **Tools**: extractBatch, searchAndReplace, convertColumnType, tableSort, createVisualization

### 14. **Olympic Medal Count** (Sports - Medal Rankings)
- **URL**: `https://olympics.com/en/olympic-games/paris-2024/medals`
- **Data**: 20 countries with gold, silver, bronze medals, total medals, rank
- **Issues**: Rank with "#" symbol, tied ranks, missing medals for some countries
- **Tools**: extractBatch, addComputedColumn (total medals), tableSort, createVisualization

### 15. **Yahoo Finance Stock Quotes** (Finance - Stock Market)
- **URL**: `https://finance.yahoo.com/quote/AAPL?p=AAPL`
- **Data**: 15 tech stocks with symbol, price, change, change %, volume, market cap
- **Issues**: Price formatting ($123.45), change with +/-, percentage with %, abbreviated market cap (1.2T)
- **Tools**: extractBatch, searchAndReplace, convertColumnType, tableSort, createVisualization

### 16. **Yelp Restaurant Listings** (Local - Restaurant Reviews)
- **URL**: `https://www.yelp.com/search?find_desc=restaurants&find_loc=Seattle,+WA`
- **Data**: 20 restaurants with name, rating, price range ($$), cuisine, review count, location
- **Issues**: Price symbols ($-$$$$), formatted review counts (1.2k), multiple cuisines
- **Tools**: extractBatch, tableFilter, tableSort, createVisualization

### 17. **Google Scholar Publications** (Academic - Research Papers)
- **URL**: `https://scholar.google.com/scholar?q=machine+learning`
- **Data**: 15 papers with title, authors, year, citations, venue, cited by count
- **Issues**: Multiple authors, formatted citations ([PDF] tags), missing venue for some
- **Tools**: extractBatch, searchAndReplace, fillMissingValues, tableSort, tableFilter

### 18. **Goodreads Best Books** (Books - Book Rankings)
- **URL**: `https://www.goodreads.com/list/show/1.Best_Books_Ever`
- **Data**: 20 books with title, author, avg rating, ratings count, published year, genre
- **Issues**: Formatted ratings (4.23), formatted rating counts (1.2M), multiple genres
- **Tools**: extractBatch, convertColumnType, tableFilter, tableSort, createVisualization

### 19. **Election Results 2024** (Politics - Vote Counts)
- **URL**: `https://www.politico.com/2024-election/results/`
- **Data**: 15 states with candidate votes, vote %, total votes, precincts reporting %
- **Issues**: Percentage symbols, formatted vote counts (1,234,567), incomplete reporting
- **Tools**: extractBatch, convertColumnType, addComputedColumn, tableSort, createVisualization

### 20. **Coinbase Crypto Prices** (Finance - Cryptocurrency)
- **URL**: `https://www.coinbase.com/explore`
- **Data**: 12 cryptocurrencies with name, price, 24h change, 24h volume, market cap, chart
- **Issues**: Price precision ($12,345.67), change with +/-, percentage, abbreviated volume (1.2B)
- **Tools**: extractBatch, searchAndReplace, convertColumnType, tableSort, createVisualization

## Cross-Page Task Opportunities
- **Amazon + eBay**: Price comparison for same products
- **LinkedIn + Indeed**: Job market analysis across platforms
- **Twitter + Reddit**: Social media trend correlation
- **Zillow + Census Data**: Housing market vs demographics
- **Yahoo Finance + Crypto**: Traditional vs digital assets
- **IMDb + Goodreads**: Entertainment preferences correlation
- **ESPN + Olympic**: Sports performance analysis
- **Wikipedia Countries + Election**: Demographics vs voting patterns

## Tool Coverage Analysis
- **Discovery** (openPage): 2 tasks using 20 pages
- **Extraction** (selectElements, extractBatch): All 20 pages
- **Wrangling** (inferSchema, updateInstance, addComputedColumn): 15+ pages
- **Sorting/Filtering** (tableSort, tableFilter): All 20 pages
- **Cleaning** (renameColumn, formatColumn, searchAndReplace, convertColumnType, fillMissingValues): All 20 pages
- **Visualization** (createVisualization): 15+ pages
- **Merging** (mergeInstances): 6+ cross-page task pairs
