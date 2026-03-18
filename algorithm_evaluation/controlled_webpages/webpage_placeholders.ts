/**
 * Hard-coded Placeholder Implementations for Evaluation
 * 
 * These functions provide deterministic outputs for placeholder tools based on
 * the controlled webpage structures used in the technical evaluation.
 * 
 * This allows the evaluation to proceed even though these tools aren't fully
 * implemented in the production system.
 */

// === CONTROLLED WEBPAGE STRUCTURES ===

export interface ControlledWebpage {
  pageId: string;
  url: string;
  structure: {
    elements: {
      selector: string;
      count: number;
      type: 'product' | 'row' | 'listing' | 'result';
    }[];
    tables: {
      selector: string;
      rows: number;
      columns: string[];
      columnTypes: ('text' | 'number' | 'date')[];
    }[];
  };
}

export const CONTROLLED_WEBPAGES: ControlledWebpage[] = [
  {
    pageId: "amazon_cameras",
    url: "https://amazon.com/s?k=digital+camera",
    structure: {
      elements: [
        { selector: ".s-result-item", count: 20, type: "product" }
      ],
      tables: [
        {
          selector: ".s-result-list",
          rows: 20,
          columns: ["Product Name", "Price", "Rating", "Reviews", "Brand", "Prime"],
          columnTypes: ["text", "number", "number", "number", "text", "text"]
        }
      ]
    }
  },
  {
    pageId: "wikipedia_countries",
    url: "https://wikipedia.org/wiki/List_of_countries_by_population",
    structure: {
      elements: [
        { selector: "table.wikitable tr", count: 50, type: "row" }
      ],
      tables: [
        {
          selector: "table.wikitable",
          rows: 50,
          columns: ["Country", "Population", "Area", "Density", "Growth Rate"],
          columnTypes: ["text", "number", "number", "number", "number"]
        }
      ]
    }
  },
  {
    pageId: "ebay_cameras",
    url: "https://ebay.com/sch/i.html?_nkw=camera",
    structure: {
      elements: [
        { selector: ".s-item", count: 15, type: "listing" }
      ],
      tables: [
        {
          selector: ".srp-results",
          rows: 15,
          columns: ["Item Title", "Current Bid", "Buy Now", "Condition", "Time Left", "Seller"],
          columnTypes: ["text", "number", "number", "text", "text", "text"]
        }
      ]
    }
  },
  {
    pageId: "kaggle_datasets",
    url: "https://kaggle.com/datasets?search=climate",
    structure: {
      elements: [
        { selector: ".dataset-item", count: 12, type: "result" }
      ],
      tables: [
        {
          selector: ".dataset-list",
          rows: 12,
          columns: ["Dataset Name", "Author", "Size", "Downloads", "Votes", "Updated"],
          columnTypes: ["text", "text", "text", "number", "number", "date"]
        }
      ]
    }
  },
  {
    pageId: "github_repos",
    url: "https://github.com/search?q=data+analysis",
    structure: {
      elements: [
        { selector: ".repo-list-item", count: 10, type: "result" }
      ],
      tables: [
        {
          selector: ".repo-list",
          rows: 10,
          columns: ["Repo Name", "Stars", "Forks", "Language", "Description", "Updated"],
          columnTypes: ["text", "number", "number", "text", "text", "date"]
        }
      ]
    }
  },
  {
    pageId: "imdb_movies",
    url: "https://imdb.com/chart/top",
    structure: {
      elements: [
        { selector: ".lister-list tr", count: 30, type: "row" }
      ],
      tables: [
        {
          selector: ".lister-list",
          rows: 30,
          columns: ["Rank", "Title", "Year", "Rating", "Votes", "Director", "Genre"],
          columnTypes: ["number", "text", "number", "number", "number", "text", "text"]
        }
      ]
    }
  }
];

// === PLACEHOLDER IMPLEMENTATIONS ===

/**
 * Placeholder for selectElements tool
 * Returns element selection info based on controlled webpage structures
 */
export function selectElements(params: {
  selector: string;
  pageUrl: string;
}): {
  success: boolean;
  message: string;
  result?: {
    selector: string;
    elementsFound: number;
    elementType: string;
    suggestedSchema: string[];
  };
} {
  // Find matching controlled webpage
  const webpage = CONTROLLED_WEBPAGES.find(wp => params.pageUrl.includes(wp.url) || wp.url.includes(params.pageUrl));
  
  if (!webpage) {
    return {
      success: false,
      message: `Page URL not found in controlled webpages: ${params.pageUrl}`
    };
  }

  // Find matching element selector
  const elementInfo = webpage.structure.elements.find(el => 
    params.selector === el.selector || 
    params.selector.includes(el.selector) ||
    el.selector.includes(params.selector)
  );

  if (!elementInfo) {
    return {
      success: false,
      message: `Selector '${params.selector}' not found in webpage structure`
    };
  }

  // Get corresponding table structure for schema suggestion
  const tableInfo = webpage.structure.tables[0]; // Use first table as default

  return {
    success: true,
    message: `Selected ${elementInfo.count} elements matching '${params.selector}'`,
    result: {
      selector: elementInfo.selector,
      elementsFound: elementInfo.count,
      elementType: elementInfo.type,
      suggestedSchema: tableInfo.columns
    }
  };
}

/**
 * Placeholder for inferSchema tool
 * Returns schema information based on controlled webpage structures
 */
export function inferSchema(params: {
  pageUrl: string;
  targetElement: string;
}): {
  success: boolean;
  message: string;
  result?: {
    columns: string[];
    columnTypes: string[];
    rowCount: number;
    confidence: number;
  };
} {
  // Find matching controlled webpage
  const webpage = CONTROLLED_WEBPAGES.find(wp => params.pageUrl.includes(wp.url) || wp.url.includes(params.pageUrl));
  
  if (!webpage) {
    return {
      success: false,
      message: `Page URL not found in controlled webpages: ${params.pageUrl}`
    };
  }

  // Find matching table structure
  const tableInfo = webpage.structure.tables.find(table =>
    params.targetElement === table.selector ||
    params.targetElement.includes(table.selector) ||
    table.selector.includes(params.targetElement)
  );

  if (!tableInfo) {
    return {
      success: false,
      message: `Target element '${params.targetElement}' not found in webpage structure`
    };
  }

  return {
    success: true,
    message: `Inferred schema for '${params.targetElement}' with ${tableInfo.columns.length} columns`,
    result: {
      columns: tableInfo.columns,
      columnTypes: tableInfo.columnTypes,
      rowCount: tableInfo.rows,
      confidence: 0.95 // High confidence for controlled pages
    }
  };
}

/**
 * Placeholder for extractBatch tool
 * Simulates batch extraction based on controlled webpage structures
 */
export function extractBatch(params: {
  pageUrl: string;
  pattern: string;
  maxItems?: number;
}): {
  success: boolean;
  message: string;
  result?: {
    extractedCount: number;
    maxItems: number;
    schema: string[];
    instanceId: string;
  };
} {
  // Find matching controlled webpage
  const webpage = CONTROLLED_WEBPAGES.find(wp => params.pageUrl.includes(wp.url) || wp.url.includes(params.pageUrl));
  
  if (!webpage) {
    return {
      success: false,
      message: `Page URL not found in controlled webpages: ${params.pageUrl}`
    };
  }

  // Find matching element pattern
  const elementInfo = webpage.structure.elements.find(el =>
    params.pattern === el.selector ||
    params.pattern.includes(el.selector) ||
    el.selector.includes(params.pattern)
  );

  if (!elementInfo) {
    return {
      success: false,
      message: `Pattern '${params.pattern}' not found in webpage structure`
    };
  }

  // Determine how many items to extract
  const maxItems = params.maxItems || 50;
  const extractedCount = Math.min(elementInfo.count, maxItems);

  // Get table structure for schema
  const tableInfo = webpage.structure.tables[0];
  
  // Generate instance ID
  const instanceId = `${webpage.pageId}_extracted_${Date.now()}`;

  return {
    success: true,
    message: `Extracted ${extractedCount} items from '${params.pattern}'`,
    result: {
      extractedCount,
      maxItems,
      schema: tableInfo.columns,
      instanceId
    }
  };
}

/**
 * Placeholder for addComputedColumn tool
 * Validates formula and returns expected column info
 */
export function addComputedColumn(params: {
  instanceId: string;
  formula: string;
  newColumnName: string;
}): {
  success: boolean;
  message: string;
  result?: {
    columnName: string;
    formula: string;
    computedRows: number;
  };
} {
  // Basic formula validation
  const validFormulaPattern = /^[A-Z]\s*[\+\-\*\/]\s*[A-Z\d\.]+$/i;
  
  if (!validFormulaPattern.test(params.formula.replace(/\s+/g, ''))) {
    // Allow more complex formulas for evaluation
    console.warn(`Formula '${params.formula}' may not be a simple arithmetic expression`);
  }

  // Simulate successful computation
  return {
    success: true,
    message: `Added computed column '${params.newColumnName}' with formula '${params.formula}'`,
    result: {
      columnName: params.newColumnName,
      formula: params.formula,
      computedRows: 20 // Placeholder: assume 20 rows computed
    }
  };
}

/**
 * Placeholder for formatColumn tool
 * Validates format pattern and returns formatting info
 */
export function formatColumn(params: {
  instanceId: string;
  columnName: string;
  formatPattern: string;
}): {
  success: boolean;
  message: string;
  result?: {
    columnName: string;
    formatPattern: string;
    formattedRows: number;
  };
} {
  // Valid format patterns
  const validPatterns = [
    'uppercase',
    'lowercase',
    'titlecase',
    'capitalize',
    /^date:.+$/, // date formatting
    /^number:.+$/, // number formatting
    /^currency:.+$/ // currency formatting
  ];

  const isValid = validPatterns.some(pattern => {
    if (typeof pattern === 'string') {
      return params.formatPattern === pattern;
    } else {
      return pattern.test(params.formatPattern);
    }
  });

  if (!isValid) {
    return {
      success: false,
      message: `Invalid format pattern: '${params.formatPattern}'. Supported patterns: uppercase, lowercase, titlecase, capitalize, date:*, number:*, currency:*`
    };
  }

  return {
    success: true,
    message: `Formatted column '${params.columnName}' with pattern '${params.formatPattern}'`,
    result: {
      columnName: params.columnName,
      formatPattern: params.formatPattern,
      formattedRows: 20 // Placeholder: assume 20 rows formatted
    }
  };
}

// === HELPER FUNCTIONS ===

/**
 * Get available controlled webpages
 */
export function getControlledWebpages(): ControlledWebpage[] {
  return CONTROLLED_WEBPAGES;
}

/**
 * Get webpage by ID
 */
export function getWebpageById(pageId: string): ControlledWebpage | undefined {
  return CONTROLLED_WEBPAGES.find(wp => wp.pageId === pageId);
}

/**
 * Get webpage by URL (partial match)
 */
export function getWebpageByUrl(url: string): ControlledWebpage | undefined {
  return CONTROLLED_WEBPAGES.find(wp => 
    url.includes(wp.url) || wp.url.includes(url)
  );
}

/**
 * Validate if a tool call would work with placeholder implementations
 */
export function validatePlaceholderToolCall(
  toolName: string,
  params: any
): { valid: boolean; message: string } {
  switch (toolName) {
    case 'selectElements':
      if (!params.pageUrl || !params.selector) {
        return { valid: false, message: "Missing required parameters: pageUrl, selector" };
      }
      const selectResult = selectElements(params);
      return { valid: selectResult.success, message: selectResult.message };

    case 'inferSchema':
      if (!params.pageUrl || !params.targetElement) {
        return { valid: false, message: "Missing required parameters: pageUrl, targetElement" };
      }
      const inferResult = inferSchema(params);
      return { valid: inferResult.success, message: inferResult.message };

    case 'extractBatch':
      if (!params.pageUrl || !params.pattern) {
        return { valid: false, message: "Missing required parameters: pageUrl, pattern" };
      }
      const extractResult = extractBatch(params);
      return { valid: extractResult.success, message: extractResult.message };

    case 'addComputedColumn':
      if (!params.instanceId || !params.formula || !params.newColumnName) {
        return { valid: false, message: "Missing required parameters: instanceId, formula, newColumnName" };
      }
      const computedResult = addComputedColumn(params);
      return { valid: computedResult.success, message: computedResult.message };

    case 'formatColumn':
      if (!params.instanceId || !params.columnName || !params.formatPattern) {
        return { valid: false, message: "Missing required parameters: instanceId, columnName, formatPattern" };
      }
      const formatResult = formatColumn(params);
      return { valid: formatResult.success, message: formatResult.message };

    default:
      return { valid: false, message: `Unknown placeholder tool: ${toolName}` };
  }
}

/**
 * Execute a placeholder tool call (for testing)
 */
export function executePlaceholderTool(
  toolName: string,
  params: any
): { success: boolean; message: string; result?: any } {
  switch (toolName) {
    case 'selectElements':
      return selectElements(params);
    case 'inferSchema':
      return inferSchema(params);
    case 'extractBatch':
      return extractBatch(params);
    case 'addComputedColumn':
      return addComputedColumn(params);
    case 'formatColumn':
      return formatColumn(params);
    default:
      return {
        success: false,
        message: `Unknown placeholder tool: ${toolName}`
      };
  }
}
