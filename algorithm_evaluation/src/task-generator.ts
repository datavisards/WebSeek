/**
 * Task Generation Prompt for GPT-4
 * 
 * This prompt is used to automatically generate benchmark tasks for WebSeek evaluation.
 * The generated tasks will then be reviewed and refined by human experts.
 */

import { MACRO_TOOLS } from '../../entrypoints/sidepanel/macro-tools';

export const TASK_GENERATION_PROMPT = `
You are an HCI researcher creating a benchmark to evaluate WebSeek, an AI-powered browser extension for web data analysis and decision-making.

**TASK**: Generate realistic, diverse benchmark tasks for technical evaluation.

## WebSeek Overview

WebSeek helps users with data-driven decision-making on the web by:
1. Extracting data from webpages into structured instances (tables, text, images)
2. Providing AI-driven proactive guidance for data manipulation
3. Supporting data cleaning, transformation, joining, and visualization

**Available Tools**: WebSeek provides 11 macro tools:

${MACRO_TOOLS.map(tool => `
**${tool.name}**
${tool.description}
Parameters: ${tool.parameters.map(p => `${p.name} (${p.type}${p.required ? ', required' : ''})`).join(', ')}
Examples: ${tool.examples.join('; ')}
`).join('\n')}

## Task Generation Requirements

Generate **${20}** benchmark tasks with the following specifications:

### Task Categories & Distribution
1. **Discovery** (2 tasks): Finding and opening relevant websites/resources
2. **Extraction & Wrangling** (6 tasks): Extracting data from webpages, table operations
3. **Profiling & Cleaning** (5 tasks): Data type conversion, cleaning, normalization
4. **Modeling & Visualization** (3 tasks): Creating charts and visualizations
5. **Composite** (4 tasks): Multi-step workflows combining multiple categories

### Difficulty Distribution
- **Easy** (6 tasks): 1-2 tool calls, single-step operations
- **Medium** (9 tasks): 3-4 tool calls, tool sequences with dependencies
- **Hard** (5 tasks): 5+ tool calls, complex multi-instance operations

### Task Characteristics
Each task must include:

1. **Realistic Scenario**: Based on actual user needs (comparison shopping, research, etc.)
2. **Public Website**: Use real, accessible URLs (Amazon, Wikipedia, news sites, etc.)
3. **Clear Goal**: Specific, measurable objective
4. **Simulated Context**: 
   - HTML content with data-aid-id attributes
   - Existing instances on canvas (some tasks start with empty canvas)
   - Recent user actions (logs)
5. **Golden Tool Sequence**: Expert-validated correct solution using WebSeek's 11 tools
6. **Solvable**: Must be achievable with the available tools

### Example Task (DO NOT COPY, USE AS REFERENCE):

\`\`\`json
{
  "task_id": "TASK_001",
  "task_category": "Extraction & Wrangling",
  "difficulty": "Medium",
  "goal_description": "Extract all digital camera products from this Amazon search page, clean the price column to remove dollar signs and commas, then sort by price from lowest to highest.",
  
  "starting_url": "https://www.amazon.com/s?k=digital+camera",
  
  "html_context": "<div class='s-result-list'><div class='s-result-item' data-asin='B09WPVBSHP' data-aid-id='aid-001'><h2 data-aid-id='aid-002'>Canon EOS R50 Mirrorless Camera</h2><span class='a-price' data-aid-id='aid-003'><span class='a-offscreen'>$679.00</span></span><div class='a-row' data-aid-id='aid-004'><span class='a-icon-star' data-aid-id='aid-005'>4.6 out of 5 stars</span></div></div><div class='s-result-item' data-asin='B0BQRWZ9H8' data-aid-id='aid-006'><h2 data-aid-id='aid-007'>Sony Alpha a6400 Mirrorless Camera</h2><span class='a-price' data-aid-id='aid-008'><span class='a-offscreen'>$898.00</span></span><div class='a-row' data-aid-id='aid-009'><span class='a-icon-star' data-aid-id='aid-010'>4.7 out of 5 stars</span></div></div>... [15 more products]</div>",
  
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
- Ensure golden sequences use ONLY the 11 available tools
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

Return ONLY a valid JSON array of ${20} tasks following the structure shown in the example.
Each task must have all required fields and conform to the specifications above.

\`\`\`json
[
  {
    "task_id": "TASK_001",
    ...
  },
  {
    "task_id": "TASK_002",
    ...
  },
  ...
]
\`\`\`

**BEGIN GENERATION NOW**: Generate ${20} diverse, realistic benchmark tasks.
`.trim();

/**
 * Generate tasks using GPT-4
 */
export async function generateBenchmarkTasks(
  apiKey: string,
  batchSize: number = 20,
  batches: number = 5
): Promise<any[]> {
  const allTasks: any[] = [];
  
  for (let i = 0; i < batches; i++) {
    console.log(`Generating batch ${i + 1}/${batches}...`);
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert HCI researcher creating benchmark datasets for AI system evaluation.'
          },
          {
            role: 'user',
            content: TASK_GENERATION_PROMPT
          }
        ],
        temperature: 0.8, // Some creativity for diversity
        max_tokens: 16000
      })
    });
    
    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Extract JSON array from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const tasks = JSON.parse(jsonMatch[0]);
      allTasks.push(...tasks);
    } else {
      console.error(`Failed to parse batch ${i + 1}`);
    }
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  return allTasks;
}
