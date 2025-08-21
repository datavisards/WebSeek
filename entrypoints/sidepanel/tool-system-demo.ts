/**
 * Tool System Demo and Testing
 * 
 * This file demonstrates how the new macro suggestion tool system works
 * and provides examples of tool usage.
 */

import { MACRO_TOOLS, validateToolCall } from './macro-tools';
import { executeMacroTool } from './macro-tool-executor';

// Example tool calls for testing with real WebSeek functionality
const exampleToolCalls = [
  {
    function: "openPage",
    parameters: {
      url: "https://www.kaggle.com/datasets",
      description: "Browse machine learning datasets for your research project",
      openInBackground: false
    }
  },
  {
    function: "tableSort",
    parameters: {
      instanceId: "products_table",
      columnName: "price",
      order: "desc"
    }
  },
  {
    function: "tableFilter",
    parameters: {
      instanceId: "products_table",
      conditions: [
        { column: "category", operator: "equals", value: "electronics" },
        { column: "rating", operator: ">=", value: 4.0 }
      ],
      operator: "AND"
    }
  },
  {
    function: "createVisualization",
    parameters: {
      sourceInstanceId: "sales_data_table",
      chartType: "bar",
      xAxis: "month",
      yAxis: "revenue",
      title: "Monthly Revenue Analysis"
    }
  },
  {
    function: "mergeInstances",
    parameters: {
      sourceInstanceIds: ["customers_table", "orders_table"],
      mergeStrategy: "join",
      joinColumn: "customer_id",
      newInstanceName: "Customer Orders Analysis"
    }
  },
  {
    function: "searchAndReplace",
    parameters: {
      instanceId: "customer_data",
      searchPattern: "N/A",
      replaceWith: "",
      useRegex: false,
      columnName: "phone"
    }
  },
  {
    function: "exportData",
    parameters: {
      instanceId: "final_analysis_table",
      format: "csv",
      filename: "analysis_results",
      includeHeaders: true
    }
  },
  {
    function: "duplicateInstance",
    parameters: {
      sourceInstanceId: "main_dataset",
      newName: "backup_dataset",
      modifications: { x: 100, y: 100 }
    }
  }
];

// Example macro suggestion with tool call
const exampleMacroSuggestion = {
  id: "demo-suggestion-1",
  message: "Open Kaggle datasets page to find additional data for your machine learning project",
  detailedDescription: "Kaggle offers a vast collection of high-quality datasets across various domains including business, science, and technology. This resource can help you find complementary data to enhance your current analysis.",
  instances: [], // Macro suggestions don't modify instances
  scope: "macro",
  modality: "peripheral",
  priority: "medium",
  confidence: 0.85,
  category: "suggest-useful-websites",
  timestamp: Date.now(),
  undoable: false,
  toolCall: {
    function: "openPage",
    parameters: {
      url: "https://www.kaggle.com/datasets",
      description: "Browse machine learning datasets for your research project",
      openInBackground: false
    }
  }
};

// Example AI response that would include tool calls
const exampleAIResponse = {
  success: true,
  message: "Generated useful suggestions for your data analysis workflow",
  instances: [],
  suggestions: [
    {
      message: "Sort your product table by price to identify pricing patterns",
      scope: "macro",
      modality: "peripheral",
      priority: "high",
      confidence: 0.9,
      category: "table-sorting-filtering",
      ruleIds: ["table-sorting-filtering"],
      toolCall: {
        function: "tableSort",
        parameters: {
          instanceId: "products_table_123",
          columnName: "price", 
          order: "desc"
        }
      }
    },
    {
      message: "Visit Kaggle to explore additional datasets for your analysis",
      scope: "macro",
      modality: "peripheral", 
      priority: "medium",
      confidence: 0.8,
      category: "suggest-useful-websites",
      ruleIds: ["suggest-useful-websites"],
      toolCall: {
        function: "openPage",
        parameters: {
          url: "https://www.kaggle.com/datasets",
          description: "Explore machine learning datasets",
          openInBackground: true
        }
      }
    }
  ]
};

/**
 * Test function to validate tool calls
 */
export function testToolValidation() {
  console.log('=== Tool Validation Tests ===');
  
  exampleToolCalls.forEach((toolCall, index) => {
    const validation = validateToolCall(toolCall);
    console.log(`Test ${index + 1} (${toolCall.function}):`, {
      valid: validation.valid,
      errors: validation.errors
    });
  });
}

/**
 * Test function to execute tools (simulation)
 */
export async function testToolExecution() {
  console.log('=== Tool Execution Tests ===');
  
  for (const toolCall of exampleToolCalls) {
    try {
      const result = await executeMacroTool(toolCall);
      console.log(`Executed ${toolCall.function}:`, {
        success: result.success,
        message: result.message,
        result: result.result
      });
    } catch (error) {
      console.error(`Error executing ${toolCall.function}:`, error);
    }
  }
}

/**
 * Test function to show available tools
 */
export function showAvailableTools() {
  console.log('=== Available Macro Tools ===');
  
  MACRO_TOOLS.forEach(tool => {
    console.log(`${tool.name}:`, {
      description: tool.description,
      parameters: tool.parameters.map(p => `${p.name} (${p.type}${p.required ? ', required' : ', optional'})`),
      examples: tool.examples
    });
  });
}

/**
 * Demo the complete workflow
 */
export async function demonstrateToolSystem() {
  console.log('🚀 Macro Suggestion Tool System Demo');
  console.log('=====================================');
  
  // Show available tools
  showAvailableTools();
  
  // Test validation
  testToolValidation();
  
  // Test execution
  await testToolExecution();
  
  // Show example AI response
  console.log('=== Example AI Response with Tools ===');
  console.log(JSON.stringify(exampleAIResponse, null, 2));
  
  // Show example suggestion
  console.log('=== Example Macro Suggestion with Tool ===');
  console.log(JSON.stringify(exampleMacroSuggestion, null, 2));
  
  console.log('✅ Demo completed successfully!');
}

// For testing in console
if (typeof window !== 'undefined') {
  (window as any).demoToolSystem = demonstrateToolSystem;
  (window as any).testTools = {
    validate: testToolValidation,
    execute: testToolExecution,
    show: showAvailableTools
  };
}
