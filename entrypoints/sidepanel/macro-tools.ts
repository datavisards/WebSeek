/**
 * Macro Suggestion Tools for WebSeek
 * 
 * This file defines the available tools that can be used to apply macro suggestions.
 * Each tool has a specific purpose and detailed parameters for execution.
 */

export interface MacroTool {
  name: string;
  description: string;
  parameters: MacroToolParameter[];
  examples: string[];
  constraints?: string[];
}

export interface MacroToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  options?: string[];
  defaultValue?: any;
}

/**
 * Available macro tools for suggestion application
 * Aligned with Table 3 in the paper
 */
export const MACRO_TOOLS: MacroTool[] = [
  // === DISCOVERY ===
  {
    name: "openPage",
    description: "Opens a webpage in a new browser tab for suggesting useful data sources related to the user's current work.",
    parameters: [
      {
        name: "url",
        type: "string",
        description: "The complete URL to open (must include http:// or https://)",
        required: true
      },
      {
        name: "description",
        type: "string", 
        description: "A brief description of what the page contains and why it's relevant",
        required: true
      },
      {
        name: "openInBackground",
        type: "boolean",
        description: "Whether to open the page in background tab (default: false)",
        required: false,
        defaultValue: false
      }
    ],
    examples: [
      'openPage("https://www.kaggle.com/datasets", "Browse datasets relevant to your data analysis project", false)',
      'openPage("https://pandas.pydata.org/docs/", "Pandas documentation for data manipulation techniques", true)'
    ],
    constraints: [
      "URL must be a valid, accessible website",
      "Description should explain relevance to current workspace context",
      "Avoid opening multiple tabs to the same domain simultaneously"
    ]
  },
  
  // === DATA EXTRACTION & WRANGLING ===
  {
    name: "selectElements",
    description: "Automatically identifies and selects relevant DOM elements on webpages for data extraction.",
    parameters: [
      {
        name: "selector",
        type: "string",
        description: "CSS selector or pattern to identify elements",
        required: true
      },
      {
        name: "pageUrl",
        type: "string",
        description: "URL of the page to select elements from",
        required: true
      }
    ],
    examples: [
      'selectElements(".product-card", "https://amazon.com/s?k=camera")',
      'selectElements("[data-testid=\'product-item\']", "https://ebay.com/search")'
    ],
    constraints: [
      "Page must be currently loaded or accessible",
      "Selector should match multiple similar elements"
    ]
  },
  {
    name: "inferSchema",
    description: "Analyzes webpage structure and infers data schema for structured extraction from tables and lists.",
    parameters: [
      {
        name: "pageUrl",
        type: "string",
        description: "URL of the page to analyze",
        required: true
      },
      {
        name: "targetElement",
        type: "string",
        description: "Selector for the target table or list element",
        required: true
      }
    ],
    examples: [
      'inferSchema("https://wikipedia.org/wiki/List_of_countries", "table.wikitable")',
      'inferSchema("https://amazon.com/s?k=laptop", ".s-result-list")'
    ],
    constraints: [
      "Target element should contain structured data",
      "Schema inference works best with tables and consistent lists"
    ]
  },
  {
    name: "extractBatch",
    description: "Extracts multiple similar data entries from web pages in batch operations using pattern recognition.",
    parameters: [
      {
        name: "pageUrl",
        type: "string",
        description: "URL of the page to extract from",
        required: true
      },
      {
        name: "pattern",
        type: "string",
        description: "Pattern or selector to identify similar items",
        required: true
      },
      {
        name: "maxItems",
        type: "number",
        description: "Maximum number of items to extract",
        required: false,
        defaultValue: 50
      }
    ],
    examples: [
      'extractBatch("https://amazon.com/s?k=camera", ".s-result-item", 20)',
      'extractBatch("https://wikipedia.org/wiki/List_of_cities", "table tr", 100)'
    ],
    constraints: [
      "Pattern should match multiple similar elements",
      "Extraction preserves data relationships and structure"
    ]
  },
  {
    name: "updateInstance",
    description: "Updates the specified instance with new values. Used for row/column autocomplete.",
    parameters: [
      {
        name: "instanceId",
        type: "string",
        description: "The ID of the instance to update",
        required: true
      },
      {
        name: "newInstance",
        type: "object",
        description: "The new instance data (complete Instance object)",
        required: true
      }
    ],
    examples: [
      'updateInstance("Table1", {...updatedTableData})'
    ],
    constraints: [
      "Instance must exist in the workspace",
      "New instance must be valid for the instance type"
    ]
  },
  {
    name: "addComputedColumn",
    description: "Creates new columns based on formulas or calculations derived from existing columns.",
    parameters: [
      {
        name: "instanceId",
        type: "string",
        description: "The ID of the table instance",
        required: true
      },
      {
        name: "formula",
        type: "string",
        description: "Formula or expression to compute new column values (e.g., 'A + B', 'A * 0.1')",
        required: true
      },
      {
        name: "newColumnName",
        type: "string",
        description: "Name for the new computed column",
        required: true
      }
    ],
    examples: [
      'addComputedColumn("Table1", "B * C", "Total Price")',
      'addComputedColumn("Table1", "A * 0.1", "Tax Amount")'
    ],
    constraints: [
      "Formula must reference valid column names",
      "Computation must be valid for the data types"
    ]
  },
  {
    name: "tableSort",
    description: "Applies sorting to organize data in table instances.",
    parameters: [
      {
        name: "instanceId",
        type: "string",
        description: "The ID of the table instance to sort",
        required: true
      },
      {
        name: "columnName",
        type: "string",
        description: "The EXACT column name from table's columnNames array, or column letter (A, B, C, etc.). MUST exist in the target table.",
        required: true
      },
      {
        name: "order",
        type: "string",
        description: "Sort order: 'asc' for ascending, 'desc' for descending",
        required: true,
        options: ["asc", "desc"]
      },
      {
        name: "secondarySort",
        type: "object",
        description: "Optional secondary sort criteria for handling ties",
        required: false
      }
    ],
    examples: [
      'tableSort("Table1", "A", "desc")',
      'tableSort("Table2", "B", "asc", {"column": "C", "order": "asc"})'
    ],
    constraints: [
      "Table instance must exist in the workspace",
      "Column name must match EXACTLY with table's columnNames array or use column letter (A, B, C, etc.)",
      "NEVER reference non-existent columns - validate column exists before suggesting",
      "Table must NOT already be sorted by the suggested column in the suggested order (avoid redundant sorting)",
      "Sort operation should provide meaningful data organization"
    ]
  },
  {
    name: "tableFilter",
    description: "Applies filtering to show/hide rows based on criteria for data refinement and interactive exploration.",
    parameters: [
      {
        name: "instanceId",
        type: "string", 
        description: "The ID of the table instance to filter",
        required: true
      },
      {
        name: "conditions",
        type: "array",
        description: "Array of filter conditions to apply",
        required: true
      },
      {
        name: "operator",
        type: "string",
        description: "How to combine multiple conditions: 'AND' or 'OR'",
        required: false,
        options: ["AND", "OR"],
        defaultValue: "AND"
      }
    ],
    examples: [
      'tableFilter("Table1", [{"column": "B", "operator": ">", "value": 100}])',
      'tableFilter("Table2", [{"column": "A", "operator": "equals", "value": "electronics"}, {"column": "C", "operator": ">=", "value": 4}], "AND")'
    ],
    constraints: [
      "Table instance must exist in the workspace",
      "All referenced columns must match EXACTLY with table's columnNames array or use column letters (A, B, C, etc.)",
      "NEVER reference non-existent columns - validate all column names before suggesting",
      "Filter conditions should result in meaningful subset of data"
    ]
  },
  
  // === DATA PROFILING & CLEANING ===
  {
    name: "renameColumn",
    description: "Renames columns for entity resolution and normalization. Standardizes entity names across datasets.",
    parameters: [
      {
        name: "instanceId",
        type: "string",
        description: "The ID of the table instance containing the column to rename",
        required: true
      },
      {
        name: "oldColumnName",
        type: "string",
        description: "The current name of the column to rename",
        required: true
      },
      {
        name: "newColumnName",
        type: "string",
        description: "The new name for the column",
        required: true
      }
    ],
    examples: [
      'renameColumn("Table1", "A", "Product Name")',
      'renameColumn("Table2", "B", "Price")'
    ],
    constraints: [
      "Instance must exist and be a table type",
      "Old column name must exist in the specified table",
      "New column name should be descriptive and unique within the table"
    ]
  },
  {
    name: "formatColumn",
    description: "Formats column values for entity resolution and normalization. Standardizes data formats across datasets.",
    parameters: [
      {
        name: "instanceId",
        type: "string",
        description: "The ID of the table instance",
        required: true
      },
      {
        name: "columnName",
        type: "string",
        description: "The name of the column to format",
        required: true
      },
      {
        name: "formatPattern",
        type: "string",
        description: "Format pattern to apply (e.g., 'uppercase', 'lowercase', 'titlecase', 'date:YYYY-MM-DD')",
        required: true
      }
    ],
    examples: [
      'formatColumn("Table1", "A", "uppercase")',
      'formatColumn("Table2", "Date", "date:YYYY-MM-DD")'
    ],
    constraints: [
      "Instance must exist and be a table type",
      "Column name must exist in the specified table",
      "Format pattern must be valid"
    ]
  },
  {
    name: "searchAndReplace",
    description: "Removes extraneous characters. Performs find and replace operations with support for regex patterns for advanced text manipulation.",
    parameters: [
      {
        name: "instanceId",
        type: "string",
        description: "The ID of the instance to modify (table or text type)",
        required: true
      },
      {
        name: "searchPattern",
        type: "string",
        description: "Text or regex pattern to search for",
        required: true
      },
      {
        name: "replaceWith",
        type: "string",
        description: "Text to replace matches with",
        required: true
      },
      {
        name: "useRegex",
        type: "boolean",
        description: "Whether to treat searchPattern as regex",
        required: false,
        defaultValue: false
      },
      {
        name: "columnName",
        type: "string",
        description: "Specific column name for table instances (optional - if not specified, searches all columns)",
        required: false
      }
    ],
    examples: [
      'searchAndReplace("Table1", "N/A", "", false, "A")',
      'searchAndReplace("Table2", "\\\\d{3}-\\\\d{3}-\\\\d{4}", "XXX-XXX-XXXX", true, "B")',
      'searchAndReplace("Text1", "old_value", "new_value", false)'
    ],
    constraints: [
      "Instance must exist and be text-based (table or text type)",
      "Regex patterns must be valid if useRegex is true",
      "Column name must exist if specified for table instances",
      "Search and replace modifies the original instance data"
    ]
  },
  {
    name: "mergeInstances",
    description: "Joins tables. Combines multiple table instances using union, inner join, left join, or right join operations with flexible column mapping.",
    parameters: [
      {
        name: "sourceInstanceIds",
        type: "array",
        description: "Array of exactly 2 table instance IDs to merge. First table is the 'left' table, second is the 'right' table.",
        required: true
      },
      {
        name: "mergeStrategy",
        type: "string",
        description: "How to combine the tables",
        required: true,
        options: ["append", "union", "inner_join", "left_join", "right_join"]
      },
      {
        name: "joinColumns",
        type: "object",
        description: "For join operations: specify which columns to join on. Format: {\"leftColumn\": \"actual_column_name_in_left_table\", \"rightColumn\": \"actual_column_name_in_right_table\"}",
        required: false
      },
      {
        name: "newInstanceName",
        type: "string",
        description: "Name for the merged table instance",
        required: false
      }
    ],
    examples: [
      'mergeInstances(["Table1", "Table2"], "inner_join", {"leftColumn": "Customer ID", "rightColumn": "ID"}, "Customer Orders")',
      'mergeInstances(["Sales_Data", "Product_Info"], "left_join", {"leftColumn": "ProductCode", "rightColumn": "Code"}, "Sales with Products")',
      'mergeInstances(["Table3", "Table4"], "union", null, "Combined Dataset")',
      'mergeInstances(["Q1_Sales", "Q2_Sales"], "append", null, "H1_Sales")'
    ],
    constraints: [
      "Exactly 2 source instances required",
      "All source instances must exist and be table type",
      "For join strategies: joinColumns must specify both leftColumn and rightColumn with actual column names from the respective tables",
      "For union/append strategies: tables should have compatible column structures",
      "Column names in joinColumns must exist in their respective tables"
    ]
  },
  {
    name: "convertColumnType",
    description: "Data type correction. Converts table columns between data types (e.g., converting currency strings to numbers) with optional cleaning patterns.",
    parameters: [
      {
        name: "instanceId",
        type: "string",
        description: "The ID of the table instance containing the column to convert",
        required: true
      },
      {
        name: "columnName",
        type: "string",
        description: "The name of the column to convert (must be exact column name like 'A', 'B', 'C')",
        required: true
      },
      {
        name: "targetType",
        type: "string",
        description: "The target data type to convert to",
        required: true,
        options: ["numerical", "categorical"]
      },
      {
        name: "cleaningPattern",
        type: "string",
        description: "Optional regex pattern to clean values before conversion (e.g., '[\\$,]' to remove $ and commas from currency)",
        required: false
      },
      {
        name: "replaceWith",
        type: "string",
        description: "What to replace the cleaning pattern with (default: empty string)",
        required: false,
        defaultValue: ""
      }
    ],
    examples: [
      'convertColumnType("Table1", "B", "numerical", "[\\$,]", "")',  // Convert "$99.99" to 99.99
      'convertColumnType("Table1", "A", "categorical")',             // Convert numbers to text categories
      'convertColumnType("Table1", "C", "numerical", "[^0-9.]", "")' // Extract numbers from mixed text
    ],
    constraints: [
      "Instance must exist and be a table type",
      "Column name must exist in the specified table",
      "Conversion should be logically valid (e.g., don't convert text to numerical if no numbers present)",
      "Cleaning pattern must be a valid regex if specified"
    ]
  },
  {
    name: "fillMissingValues",
    description: "Fills missing or empty cells using strategies like mean, median, mode, interpolation, or constant values.",
    parameters: [
      {
        name: "instanceId",
        type: "string",
        description: "The ID of the table instance containing missing values",
        required: true
      },
      {
        name: "columnName",
        type: "string",
        description: "The name of the column to fill missing values in (must be exact column name like 'A', 'B', 'C')",
        required: true
      },
      {
        name: "strategy",
        type: "string",
        description: "The imputation strategy to use",
        required: true,
        options: ["mean", "median", "mode", "forward_fill", "backward_fill", "constant", "interpolate"]
      },
      {
        name: "constantValue",
        type: "string",
        description: "The constant value to use when strategy is 'constant'",
        required: false
      },
      {
        name: "missingIndicators",
        type: "array",
        description: "Array of values to treat as missing (default: empty string, 'N/A', 'null', 'NULL', '-')",
        required: false,
        defaultValue: ["", "N/A", "null", "NULL", "-"]
      }
    ],
    examples: [
      'fillMissingValues("Table1", "B", "mean")',                                    // Fill with column mean
      'fillMissingValues("Table1", "A", "mode")',                                    // Fill with most frequent value
      'fillMissingValues("Table1", "C", "constant", "Unknown")',                     // Fill with constant value
      'fillMissingValues("Table1", "D", "forward_fill")',                           // Fill with previous valid value
      'fillMissingValues("Table1", "E", "interpolate")',                            // Linear interpolation for numbers
      'fillMissingValues("Table1", "F", "median", null, ["", "N/A", "missing"])'   // Custom missing indicators
    ],
    constraints: [
      "Instance must exist and be a table type",
      "Column name must exist in the specified table",
      "Strategy 'mean', 'median', and 'interpolate' only work with numerical columns",
      "Strategy 'constant' requires constantValue parameter",
      "At least 10% of column values should be non-missing for reliable imputation",
      "Missing value percentage should be between 10%-80% for meaningful imputation"
    ]
  },
  
  // === DATA MODELING & VISUALIZATION ===
  {
    name: "createVisualization",
    description: "Creates new visualization instances (bar, line, scatterplot, and histograms). Auto-generates or suggests alternative charts.",
    parameters: [
      {
        name: "sourceInstanceId",
        type: "string",
        description: "The ID of the table instance to visualize",
        required: true
      },
      {
        name: "chartType",
        type: "string",
        description: "Type of visualization to create",
        required: true,
        options: ["bar", "line", "scatter", "histogram"]
      },
      {
        name: "xAxis",
        type: "string",
        description: "Column name for X-axis",
        required: true
      },
      {
        name: "yAxis",
        type: "string",
        description: "Column name for Y-axis (not required for histograms)",
        required: false
      },
      {
        name: "title",
        type: "string",
        description: "Title for the visualization",
        required: false
      }
    ],
    examples: [
      'createVisualization("Table1", "bar", "A", "B", "Sales by Region")',
      'createVisualization("Table2", "scatter", "B", "C", "Price vs Rating")',
      'createVisualization("Table3", "histogram", "A", null, "Distribution")'
    ],
    constraints: [
      "Source table must exist and contain data",
      "Specified columns must exist in the source table",
      "Chart type should be appropriate for the data types"
    ]
  }
];

/**
 * Generate tool documentation string for LLM prompts
 */
export function generateToolDocumentation(): string {
  return `
**AVAILABLE MACRO SUGGESTION TOOLS:**

When creating macro suggestions, you can specify which tool should be used to apply the suggestion. Include a "toolCall" field in your suggestion with the function name and parameters.

${MACRO_TOOLS.map(tool => `
**${tool.name}**
${tool.description}

Parameters:
${tool.parameters.map(param => 
  `- ${param.name} (${param.type}${param.required ? ', required' : ', optional'}): ${param.description}${param.options ? ` Options: ${param.options.join(', ')}` : ''}${param.defaultValue !== undefined ? ` Default: ${param.defaultValue}` : ''}`
).join('\n')}

Examples:
${tool.examples.map(example => `- ${example}`).join('\n')}

${tool.constraints ? `Constraints:\n${tool.constraints.map(constraint => `- ${constraint}`).join('\n')}` : ''}
`).join('\n')}

**TOOL CALL FORMAT:**
When suggesting a macro action, include a "toolCall" field in your suggestion:

{
  "message": "Your suggestion description",
  "scope": "macro",
  "modality": "peripheral", 
  "priority": "high|medium|low",
  "confidence": number,
  "category": "rule-id",
  "ruleIds": ["rule-id"],
  "toolCall": {
    "function": "toolName",
    "parameters": {
      "param1": "value1",
      "param2": "value2"
    }
  }
}

**TOOL SELECTION GUIDELINES:**
- Use "openPage" for suggesting external websites, documentation, or online resources
- Use "tableSort" for suggesting data organization improvements
- Use "tableFilter" for suggesting data refinement and subset creation
- Use "createVisualization" for suggesting data exploration through charts
- Use "exportData" for suggesting data sharing or backup workflows
- Use "duplicateInstance" for suggesting experimentation or version control
- Use "searchAndReplace" for suggesting data cleaning operations
- Use "mergeInstances" for suggesting data consolidation workflows (supports different join column names and multiple join types)
- Use "convertColumnType" for suggesting data type conversions (text to numbers, etc.)
- Use "renameColumn" for suggesting column header standardization and clarity improvements

**IMPORTANT:** Always ensure the tool call parameters match the exact specifications above and that the suggested action provides genuine value to the user's workflow.
`;
}

/**
 * Validate a tool call against the tool definitions
 */
export function validateToolCall(toolCall: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!toolCall.function) {
    errors.push("Missing 'function' field in toolCall");
    return { valid: false, errors };
  }
  
  const tool = MACRO_TOOLS.find(t => t.name === toolCall.function);
  if (!tool) {
    errors.push(`Unknown tool function: ${toolCall.function}`);
    return { valid: false, errors };
  }
  
  const params = toolCall.parameters || {};
  
  // Check required parameters
  for (const param of tool.parameters.filter(p => p.required)) {
    if (!(param.name in params)) {
      errors.push(`Missing required parameter '${param.name}' for tool '${tool.name}'`);
    }
  }
  
  // Check parameter types and options
  for (const [paramName, paramValue] of Object.entries(params)) {
    const paramDef = tool.parameters.find(p => p.name === paramName);
    if (!paramDef) {
      errors.push(`Unknown parameter '${paramName}' for tool '${tool.name}'`);
      continue;
    }
    
    // Type checking (basic)
    if (paramDef.type === 'string' && typeof paramValue !== 'string') {
      errors.push(`Parameter '${paramName}' should be a string`);
    } else if (paramDef.type === 'number' && typeof paramValue !== 'number') {
      errors.push(`Parameter '${paramName}' should be a number`);
    } else if (paramDef.type === 'boolean' && typeof paramValue !== 'boolean') {
      errors.push(`Parameter '${paramName}' should be a boolean`);
    } else if (paramDef.type === 'array' && !Array.isArray(paramValue)) {
      errors.push(`Parameter '${paramName}' should be an array`);
    }
    
    // Options checking
    if (paramDef.options && !paramDef.options.includes(paramValue as string)) {
      errors.push(`Parameter '${paramName}' must be one of: ${paramDef.options.join(', ')}`);
    }
  }
  
  return { valid: errors.length === 0, errors };
}
