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
 */
export const MACRO_TOOLS: MacroTool[] = [
  {
    name: "openPage",
    description: "Opens a webpage in a new browser tab. Use this for suggesting useful websites, documentation, or resources related to the user's current work.",
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
  {
    name: "tableSort",
    description: "Applies sorting to one or more table instances in the workspace. Use this for suggesting data organization improvements.",
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
        description: "The name of the column to sort by",
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
      "Column name must exist in the target table",
      "Sort operation should provide meaningful data organization"
    ]
  },
  {
    name: "tableFilter",
    description: "Applies filtering to table instances to show/hide rows based on criteria. Use this for suggesting data refinement.",
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
      "All referenced columns must exist in the target table",
      "Filter conditions should result in meaningful subset of data"
    ]
  },
  {
    name: "createVisualization",
    description: "Creates a new visualization instance based on existing table data. Use this for suggesting data exploration improvements.",
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
        options: ["bar", "line", "scatter", "pie", "histogram", "heatmap"]
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
        description: "Column name for Y-axis (not required for pie charts)",
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
      'createVisualization("Table1", "bar", "A", "B", "Data Analysis")',
      'createVisualization("Table2", "scatter", "B", "C", "Correlation Analysis")'
    ],
    constraints: [
      "Source table must exist and contain data",
      "Specified columns must exist in the source table",
      "Chart type should be appropriate for the data types"
    ]
  },
  {
    name: "exportData",
    description: "Exports table or visualization data in various formats. Use this for suggesting data sharing and backup.",
    parameters: [
      {
        name: "instanceId",
        type: "string",
        description: "The ID of the instance to export",
        required: true
      },
      {
        name: "format",
        type: "string",
        description: "Export format",
        required: true,
        options: ["csv", "json", "xlsx", "png", "svg"]
      },
      {
        name: "filename",
        type: "string",
        description: "Desired filename (without extension)",
        required: false
      },
      {
        name: "includeHeaders",
        type: "boolean",
        description: "Whether to include column headers (for table exports)",
        required: false,
        defaultValue: true
      }
    ],
    examples: [
      'exportData("Table1", "csv", "exported_data")',
      'exportData("chart_456", "png", "sales_visualization")'
    ],
    constraints: [
      "Instance must exist in the workspace",
      "Export format should be appropriate for the instance type",
      "Filename should be valid for the target file system"
    ]
  },
  {
    name: "duplicateInstance",
    description: "Creates a copy of an existing instance for experimentation or backup. Use this for suggesting workflow improvements.",
    parameters: [
      {
        name: "sourceInstanceId",
        type: "string",
        description: "The ID of the instance to duplicate",
        required: true
      },
      {
        name: "newName",
        type: "string",
        description: "Name for the new instance",
        required: false
      },
      {
        name: "modifications",
        type: "object",
        description: "Optional modifications to apply to the duplicate",
        required: false
      }
    ],
    examples: [
      'duplicateInstance("Table1", "Backup of Table1")',
      'duplicateInstance("chart_456", "Modified Analysis", {"title": "Updated Chart Title"})'
    ],
    constraints: [
      "Source instance must exist in the workspace",
      "New name should be descriptive and unique",
      "Modifications should be valid for the instance type"
    ]
  },
  {
    name: "searchAndReplace",
    description: "Performs find and replace operations across text-based instances. Supports both literal text replacement and regex patterns for advanced text manipulation.",
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
    description: "Combines multiple table instances into one. Supports union (append rows) and join operations with specified join columns.",
    parameters: [
      {
        name: "sourceInstanceIds",
        type: "array",
        description: "Array of table instance IDs to merge (at least 2 required)",
        required: true
      },
      {
        name: "mergeStrategy",
        type: "string",
        description: "How to combine the tables",
        required: true,
        options: ["append", "union", "join"]
      },
      {
        name: "joinColumn",
        type: "string",
        description: "Column name to join on (required for 'join' strategy, must exist in both tables)",
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
      'mergeInstances(["Table1", "Table2"], "join", "A", "Combined Table")',
      'mergeInstances(["Table3", "Table4"], "union", null, "Full Dataset")',
      'mergeInstances(["Table1", "Table2"], "join", "B", "Merged Analysis")'
    ],
    constraints: [
      "All source instances must exist and be table type",
      "For 'join' strategy: joinColumn must exist in all source tables",
      "For 'union'/'append' strategy: tables should have compatible column structures",
      "At least 2 source instances required for merging"
    ]
  },
  {
    name: "convertColumnType",
    description: "Converts a table column from one data type to another. Essential for enabling operations like sorting or filtering on incorrectly typed data (e.g., converting '$99.99' strings to numbers).",
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
- Use "mergeInstances" for suggesting data consolidation workflows

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
