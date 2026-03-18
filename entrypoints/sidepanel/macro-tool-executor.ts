/**
 * Macro Tool Executor - Handles the execution of macro suggestion tools
 * Integrates with WebSeek's existing instance management and functionality
 */

import { validateToolCall } from './macro-tools';
import { TableInstance, VisualizationInstance, Instance, ToolCall } from './types';
import { extractNumericalValue, getVisualizationThumbnail } from './utils';

export class MacroToolExecutor {
  
  /**
   * Defensive column name resolution - handles cases where LLM uses default column names
   * like "A", "B", "C" instead of actual column names
   */
  private static resolveColumnName(
    requestedColumnName: string, 
    tableInstance: TableInstance
  ): { columnIndex: number; actualColumnName: string } | null {
    // First, try exact match with actual column names
    const exactIndex = tableInstance.columnNames?.indexOf(requestedColumnName);
    if (exactIndex !== undefined && exactIndex !== -1) {
      return {
        columnIndex: exactIndex,
        actualColumnName: requestedColumnName
      };
    }

    // If exact match fails, check if it's a default column name pattern (A, B, C, etc.)
    const defaultColumnPattern = /^[A-Z]$/;
    if (defaultColumnPattern.test(requestedColumnName)) {
      // Convert letter to index (A=0, B=1, C=2, etc.)
      const defaultIndex = requestedColumnName.charCodeAt(0) - 'A'.charCodeAt(0);
      
      // Check if this index is valid for the table
      if (defaultIndex >= 0 && defaultIndex < (tableInstance.columnNames?.length || 0)) {
        const actualColumnName = tableInstance.columnNames![defaultIndex];
        console.log(`🔧 Defensive column resolution: LLM used '${requestedColumnName}' (default), mapped to actual column '${actualColumnName}' at index ${defaultIndex}`);
        
        return {
          columnIndex: defaultIndex,
          actualColumnName: actualColumnName
        };
      }
    }

    // Also try multi-letter patterns like "AA", "AB", etc. for larger tables
    const extendedColumnPattern = /^[A-Z]{1,2}$/;
    if (extendedColumnPattern.test(requestedColumnName)) {
      let extendedIndex = 0;
      
      if (requestedColumnName.length === 1) {
        // Single letter: A=0, B=1, ..., Z=25
        extendedIndex = requestedColumnName.charCodeAt(0) - 'A'.charCodeAt(0);
      } else if (requestedColumnName.length === 2) {
        // Double letter: AA=26, AB=27, ..., ZZ=701
        const firstChar = requestedColumnName.charCodeAt(0) - 'A'.charCodeAt(0);
        const secondChar = requestedColumnName.charCodeAt(1) - 'A'.charCodeAt(0);
        extendedIndex = (firstChar + 1) * 26 + secondChar;
      }
      
      // Check if this index is valid for the table
      if (extendedIndex >= 0 && extendedIndex < (tableInstance.columnNames?.length || 0)) {
        const actualColumnName = tableInstance.columnNames![extendedIndex];
        console.log(`🔧 Defensive column resolution: LLM used '${requestedColumnName}' (extended default), mapped to actual column '${actualColumnName}' at index ${extendedIndex}`);
        
        return {
          columnIndex: extendedIndex,
          actualColumnName: actualColumnName
        };
      }
    }

    return null;
  }
  
  /**
   * Execute a tool call from a macro suggestion
   */
  static async executeTool(
    toolCall: ToolCall,
    currentInstances: Instance[],
    updateInstances: (newInstances: Instance[]) => void
  ): Promise<{ success: boolean; message: string; result?: any }> {
    // Validate the tool call
    const validation = validateToolCall(toolCall);
    if (!validation.valid) {
      return {
        success: false,
        message: `Tool validation failed: ${validation.errors.join(', ')}`
      };
    }

    // Handle legacy tools not in the ToolCall union
    const fn = (toolCall as any).function as string;
    if (fn === 'exportData') {
      return await this.executeExportData((toolCall as any).parameters, currentInstances);
    }
    if (fn === 'duplicateInstance') {
      return await this.executeDuplicateInstance((toolCall as any).parameters, currentInstances, updateInstances);
    }
    if (fn === 'appendToTable') {
      return await this.executeAppendToTable((toolCall as any).parameters, currentInstances, updateInstances);
    }
    if (fn === 'addColumnToTable') {
      return await this.executeAddColumnToTable((toolCall as any).parameters, currentInstances, updateInstances);
    }
    if (fn === 'updateInstance') {
      return await this.executeUpdateInstance((toolCall as any).parameters, currentInstances, updateInstances);
    }
    if (fn === 'addComputedColumn') {
      return await this.executeAddComputedColumn((toolCall as any).parameters, currentInstances, updateInstances);
    }
    if (fn === 'formatColumn') {
      return await this.executeFormatColumn((toolCall as any).parameters, currentInstances, updateInstances);
    }

    try {
      switch (toolCall.function) {
        case 'openPage':
          return await this.executeOpenPage(toolCall.parameters);

        case 'tableSort':
          return await this.executeTableSort(toolCall.parameters, currentInstances, updateInstances);

        case 'tableFilter':
          return await this.executeTableFilter(toolCall.parameters, currentInstances, updateInstances);

        case 'createVisualization':
          return await this.executeCreateVisualization(toolCall.parameters, currentInstances, updateInstances);

        case 'searchAndReplace':
          return await this.executeSearchAndReplace(toolCall.parameters, currentInstances, updateInstances);

        case 'mergeInstances':
          return await this.executeMergeInstances(toolCall.parameters, currentInstances, updateInstances);

        case 'convertColumnType':
          return await this.executeConvertColumnType(toolCall.parameters, currentInstances, updateInstances);

        case 'renameColumn':
          return await this.executeRenameColumn(toolCall.parameters, currentInstances, updateInstances);

        case 'fillMissingValues':
          return await this.executeFillMissingValues(toolCall.parameters, currentInstances, updateInstances);

        default:
          return {
            success: false,
            message: `Unknown tool function: ${(toolCall as any).function}`
          };
      }
    } catch (error) {
      return {
        success: false,
        message: `Tool execution error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Execute a sequence of tool calls for composite suggestions
   */
  static async executeToolSequence(
    toolSequence: {
      goal: string;
      steps: Array<{
        description: string;
        toolCall: ToolCall;
      }>;
    },
    currentInstances: Instance[],
    updateInstances: (newInstances: Instance[]) => void
  ): Promise<{ success: boolean; message: string; result?: any }> {
    console.log(`🚀 Starting tool sequence execution: ${toolSequence.goal}`);
    console.log(`📋 Total steps: ${toolSequence.steps.length}`);
    
    const results: any[] = [];
    const skipped: Array<{ step: number; description: string; reason: string }> = [];
    let instances = [...currentInstances];

    // Errors that indicate a dependency (instance/table) doesn't exist yet —
    // these are "future" steps that require the user to collect more data first.
    const isMissingDependency = (msg: string) =>
      /not found|missing|Could not find/i.test(msg);

    try {
      // Execute each step in sequence
      for (let i = 0; i < toolSequence.steps.length; i++) {
        const step = toolSequence.steps[i];

        console.log(`\n⚡ Step ${i + 1}/${toolSequence.steps.length}: ${step.description}`);

        // Create a temporary update function to track intermediate changes
        let stepInstances = instances;
        const stepUpdateInstances = (newInstances: Instance[]) => {
          stepInstances = newInstances;
        };

        const stepResult = await this.executeTool(
          step.toolCall,
          instances,
          stepUpdateInstances
        );

        if (!stepResult.success) {
          if (isMissingDependency(stepResult.message)) {
            // This step depends on data that doesn't exist yet — skip gracefully
            console.warn(`⏭️ Step ${i + 1} skipped (dependency not yet available): ${stepResult.message}`);
            skipped.push({ step: i + 1, description: step.description, reason: stepResult.message });
            continue;
          }
          // Hard failure — stop the sequence
          console.error(`❌ Step ${i + 1} failed: ${stepResult.message}`);
          // Still apply changes from previously completed steps
          if (instances !== currentInstances) updateInstances(instances);
          return {
            success: false,
            message: `Step ${i + 1} failed: ${stepResult.message}`
          };
        }

        instances = stepInstances;
        results.push({ step: i + 1, description: step.description, result: stepResult.result });
        console.log(`✨ Step ${i + 1} completed`);
      }

      // Apply all successful step changes
      updateInstances(instances);

      const skippedNote = skipped.length > 0
        ? ` ${skipped.length} step(s) were skipped because they depend on data you haven't collected yet: ${skipped.map(s => `"${s.description}"`).join('; ')}`
        : '';

      return {
        success: results.length > 0,
        message: results.length > 0
          ? `Completed ${results.length} of ${toolSequence.steps.length} step(s) for: ${toolSequence.goal}.${skippedNote}`
          : `No steps could be executed — all required data is missing.${skippedNote}`,
        result: { goal: toolSequence.goal, steps: results, skipped, totalSteps: toolSequence.steps.length }
      };
      
    } catch (error) {
      console.error(`💥 Tool sequence execution error:`, error);
      return {
        success: false,
        message: `Tool sequence execution error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Open a webpage in a new tab
   */
  private static async executeOpenPage(params: { url: string; description?: string; openInBackground?: boolean }): Promise<{ success: boolean; message: string; result?: any }> {
    try {
      // Validate URL
      new URL(params.url);
      
      // Open the page using browser API
      if (typeof browser !== 'undefined' && browser.tabs) {
        await browser.tabs.create({
          url: params.url,
          active: !params.openInBackground
        });
      } else if (typeof chrome !== 'undefined' && chrome.tabs) {
        await chrome.tabs.create({
          url: params.url,
          active: !params.openInBackground
        });
      } else {
        // Fallback for development
        window.open(params.url, '_blank');
      }
      
      return {
        success: true,
        message: `Opened ${params.description || params.url} in a new tab`,
        result: { url: params.url }
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to open page: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Apply sorting to a table instance
   */
  private static async executeTableSort(
    params: { instanceId: string; columnName: string; order: string; secondarySort?: any }, 
    currentInstances: Instance[], 
    updateInstances: (newInstances: Instance[]) => void
  ): Promise<{ success: boolean; message: string; result?: any }> {
    console.log(`🔄 Sorting table:`, params);
    
    try {
      const tableInstance = currentInstances.find(inst => inst.id === params.instanceId && inst.type === 'table') as TableInstance;
      
      if (!tableInstance) {
        console.error(`❌ Table instance '${params.instanceId}' not found`);
        return {
          success: false,
          message: `Table instance '${params.instanceId}' not found`
        };
      }

      console.log(`📋 Found table with ${tableInstance.rows} rows, ${tableInstance.cols} columns`);
      console.log(`🔍 Column names:`, tableInstance.columnNames);
      console.log(`🏷️ Column types:`, tableInstance.columnTypes);

      // Use defensive column name resolution
      const columnResolution = this.resolveColumnName(params.columnName, tableInstance);
      if (!columnResolution) {
        console.error(`❌ Column '${params.columnName}' not found and couldn't be resolved to a default column pattern`);
        return {
          success: false,
          message: `Column '${params.columnName}' not found in table '${params.instanceId}'. Available columns: ${tableInstance.columnNames.join(', ')}`
        };
      }

      const { columnIndex, actualColumnName } = columnResolution;
      console.log(`📍 Sorting by column '${actualColumnName}' at index ${columnIndex}`);

      // Create sorted version of the table
      const sortedCells = [...tableInstance.cells];
      const columnType = tableInstance.columnTypes?.[columnIndex] || 'categorical';
      
      console.log(`🏷️ Column type: ${columnType}`);
      console.log(`📊 Sorting order: ${params.order}`);

      // Log first few values before sorting
      console.log(`🔍 Sample values before sorting:`, 
        sortedCells.slice(0, 3).map((row, i) => {
          const cell = row[columnIndex];
          const value = cell && cell.type === 'text' ? cell.content || '' : '';
          return `Row ${i}: "${value}"`;
        })
      );
      
      sortedCells.sort((rowA, rowB) => {
        const cellA = rowA[columnIndex];
        const cellB = rowB[columnIndex];
        
        let valA = cellA && cellA.type === 'text' ? cellA.content || '' : '';
        let valB = cellB && cellB.type === 'text' ? cellB.content || '' : '';
        
        // Handle empty values
        if (valA === '' && valB === '') return 0;
        if (valA === '') return params.order === 'asc' ? 1 : -1;
        if (valB === '') return params.order === 'asc' ? -1 : 1;
        
        let comparison = 0;
        if (columnType === 'numeral') {
          const numA = Number(valA);
          const numB = Number(valB);
          if (!isNaN(numA) && !isNaN(numB)) {
            comparison = numA - numB;
            console.log(`🔢 Comparing numbers: ${numA} vs ${numB} = ${comparison}`);
          } else {
            comparison = valA.localeCompare(valB);
            console.log(`📝 Comparing strings: "${valA}" vs "${valB}" = ${comparison}`);
          }
        } else {
          comparison = valA.localeCompare(valB);
          console.log(`📝 Comparing strings: "${valA}" vs "${valB}" = ${comparison}`);
        }
        
        return params.order === 'asc' ? comparison : -comparison;
      });

      // Preserve source information but mark cells as sorted (position changed)
      console.log(`🔄 Marking sorted cells with position-changed metadata`);
      const sortedCellsWithSourcePreserved = sortedCells.map(row => 
        row.map(cell => {
          if (cell && cell.source && cell.source.type === 'web') {
            // Preserve web source but add metadata indicating position changed due to sorting
            return {
              ...cell,
              source: {
                ...cell.source,
                sortingApplied: true, // Custom flag to indicate cell was moved by sorting
                originalPosition: true // Indicates source points to original, not current position
              } as any
            };
          }
          return cell;
        })
      );

      // Log first few values after sorting
      console.log(`✅ Sample values after sorting:`, 
        sortedCellsWithSourcePreserved.slice(0, 3).map((row, i) => {
          const cell = row[columnIndex];
          const value = cell && cell.type === 'text' ? cell.content || '' : '';
          return `Row ${i}: "${value}"`;
        })
      );

      // Create updated table instance (modify in place instead of creating new one)
      const sortedTable: TableInstance = {
        ...tableInstance,
        cells: sortedCellsWithSourcePreserved
      };

      console.log(`🔄 Updating original table instance in place`);

      // Update the original table instead of creating a new one
      const updatedInstances = currentInstances.map(inst => 
        inst.id === params.instanceId ? sortedTable : inst
      );
      updateInstances(updatedInstances);

      console.log(`🎉 Table sorting completed successfully`);

      return {
        success: true,
        message: `Sorted table '${params.instanceId}' by column '${params.columnName}' in ${params.order}ending order`,
        result: {
          action: 'tableSort',
          instanceId: params.instanceId,
          columnName: params.columnName,
          order: params.order,
          rowCount: sortedCellsWithSourcePreserved.length
        }
      };
    } catch (error) {
      console.error(`💥 Table sorting error:`, error);
      return {
        success: false,
        message: `Failed to sort table: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Convert a table column from one type to another
   */
  private static async executeConvertColumnType(
    params: { instanceId: string; columnName: string; targetType: 'numerical' | 'categorical'; cleaningPattern?: string; replaceWith?: string },
    currentInstances: Instance[],
    updateInstances: (newInstances: Instance[]) => void
  ): Promise<{ success: boolean; message: string; result?: any }> {
    console.log(`🔄 Converting column type:`, params);
    
    try {
      // Find the table instance
      const tableInstance = currentInstances.find(
        inst => inst.id === params.instanceId && inst.type === 'table'
      ) as TableInstance | undefined;

      if (!tableInstance) {
        console.error(`❌ Table instance '${params.instanceId}' not found`);
        return {
          success: false,
          message: `Table instance '${params.instanceId}' not found`
        };
      }

      console.log(`📋 Found table with ${tableInstance.rows} rows, ${tableInstance.cols} columns`);
      console.log(`🔍 Current column names:`, tableInstance.columnNames);
      console.log(`🏷️ Current column types:`, tableInstance.columnTypes);

      // Use defensive column name resolution
      const columnResolution = this.resolveColumnName(params.columnName, tableInstance);
      if (!columnResolution) {
        console.error(`❌ Column '${params.columnName}' not found and couldn't be resolved to a default column pattern`);
        return {
          success: false,
          message: `Column '${params.columnName}' not found in table '${params.instanceId}'. Available columns: ${tableInstance.columnNames.join(', ')}`
        };
      }

      const { columnIndex, actualColumnName } = columnResolution;

      console.log(`📍 Column '${params.columnName}' found at index ${columnIndex}`);

      // Prepare conversion
      const cleaningRegex = params.cleaningPattern ? new RegExp(params.cleaningPattern, 'g') : null;
      const replaceWith = params.replaceWith || '';
      
      console.log(`🧹 Cleaning pattern: ${params.cleaningPattern || 'none'}`);
      console.log(`🔄 Target type: ${params.targetType}`);
      
      let convertedCount = 0;
      let skippedCount = 0;
      
      // Create new cells with converted values
      const convertedCells = tableInstance.cells.map((row, rowIndex) => {
        if (row[columnIndex] && row[columnIndex].type === 'text') {
          let content = row[columnIndex].content as string;
          const originalContent = content;
          
          // Apply cleaning pattern if specified
          if (cleaningRegex) {
            content = content.replace(cleaningRegex, replaceWith);
            if (content !== originalContent) {
              console.log(`🧹 Row ${rowIndex}: "${originalContent}" → "${content}"`);
            }
          }
          
          // Convert based on target type
          if (params.targetType === 'numerical') {
            // Use the same logic as the UI for numerical conversion
            const numValue = extractNumericalValue(content);
            if (numValue !== 0 || content.trim() === '0' || content.trim() === '0.0') {
              console.log(`🔢 Row ${rowIndex}: "${content}" → ${numValue}`);
              convertedCount++;
              return row.map((cell, idx) => 
                idx === columnIndex && cell ? { ...cell, content: numValue.toString() } : cell
              );
            } else {
              console.log(`⚠️ Row ${rowIndex}: "${content}" → skipped (couldn't convert)`);
              skippedCount++;
            }
          }
          // For categorical or failed numerical conversion, keep as string
          return row.map((cell, idx) => 
            idx === columnIndex && cell ? { ...cell, content: content.trim() } : cell
          );
        }
        return row;
      });

      console.log(`📊 Conversion summary: ${convertedCount} converted, ${skippedCount} skipped`);

      // Update column type
      const updatedColumnTypes = [...tableInstance.columnTypes];
      updatedColumnTypes[columnIndex] = params.targetType === 'numerical' ? 'numeral' : 'categorical';

      console.log(`🏷️ Updated column types:`, updatedColumnTypes);

      // Create updated table instance (modify in place for this operation)
      const updatedTable: TableInstance = {
        ...tableInstance,
        cells: convertedCells,
        columnTypes: updatedColumnTypes
      };

      console.log(`✅ Table updated successfully`);

      // Update instances
      const updatedInstances = currentInstances.map(inst => 
        inst.id === params.instanceId ? updatedTable : inst
      );
      updateInstances(updatedInstances);

      console.log(`🎉 Column conversion completed successfully`);

      return {
        success: true,
        message: `Converted column '${params.columnName}' to ${params.targetType} type in table '${params.instanceId}' (${convertedCount} cells converted, ${skippedCount} skipped)`,
        result: {
          action: 'convertColumnType',
          instanceId: params.instanceId,
          columnName: params.columnName,
          targetType: params.targetType,
          cleaningPattern: params.cleaningPattern,
          convertedCount,
          skippedCount
        }
      };
    } catch (error) {
      console.error(`💥 Column conversion error:`, error);
      return {
        success: false,
        message: `Failed to convert column type: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Rename a column in a table instance
   */
  private static async executeRenameColumn(
    params: { instanceId: string; oldColumnName: string; newColumnName: string },
    currentInstances: Instance[],
    updateInstances: (newInstances: Instance[]) => void
  ): Promise<{ success: boolean; message: string; result?: any }> {
    console.log(`🏷️ Renaming column:`, params);
    
    try {
      // Find the table instance
      const tableInstance = currentInstances.find(
        inst => inst.id === params.instanceId && inst.type === 'table'
      ) as TableInstance | undefined;

      if (!tableInstance) {
        console.error(`❌ Table instance '${params.instanceId}' not found`);
        return {
          success: false,
          message: `Table instance '${params.instanceId}' not found`
        };
      }

      console.log(`📋 Found table with ${tableInstance.rows} rows, ${tableInstance.cols} columns`);
      console.log(`🔍 Current column names:`, tableInstance.columnNames);

      // Use defensive column name resolution
      const columnResolution = this.resolveColumnName(params.oldColumnName, tableInstance);
      if (!columnResolution) {
        console.error(`❌ Column '${params.oldColumnName}' not found and couldn't be resolved to a default column pattern`);
        return {
          success: false,
          message: `Column '${params.oldColumnName}' not found in table '${params.instanceId}'. Available columns: ${tableInstance.columnNames.join(', ')}`
        };
      }

      const { columnIndex, actualColumnName } = columnResolution;

      // Check if new column name already exists
      if (tableInstance.columnNames.includes(params.newColumnName)) {
        console.error(`❌ Column name '${params.newColumnName}' already exists`);
        return {
          success: false,
          message: `Column name '${params.newColumnName}' already exists in table '${params.instanceId}'`
        };
      }

      console.log(`📍 Column '${actualColumnName}' found at index ${columnIndex}, renaming to '${params.newColumnName}'`);

      // Update column names
      const updatedColumnNames = [...tableInstance.columnNames];
      updatedColumnNames[columnIndex] = params.newColumnName;

      console.log(`🏷️ Updated column names:`, updatedColumnNames);

      // Create updated table instance
      const updatedTable: TableInstance = {
        ...tableInstance,
        columnNames: updatedColumnNames
      };

      console.log(`✅ Table updated successfully`);

      // Update instances
      const updatedInstances = currentInstances.map(inst => 
        inst.id === params.instanceId ? updatedTable : inst
      );
      updateInstances(updatedInstances);

      console.log(`🎉 Column rename completed successfully`);

      return {
        success: true,
        message: `Renamed column '${params.oldColumnName}' to '${params.newColumnName}' in table '${params.instanceId}'`,
        result: {
          action: 'renameColumn',
          instanceId: params.instanceId,
          oldColumnName: params.oldColumnName,
          newColumnName: params.newColumnName
        }
      };
    } catch (error) {
      console.error(`💥 Column rename error:`, error);
      return {
        success: false,
        message: `Failed to rename column: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Apply filtering to a table instance
   */
  private static async executeTableFilter(
    params: { instanceId: string; conditions: any[]; operator?: string }, 
    currentInstances: Instance[], 
    updateInstances: (newInstances: Instance[]) => void
  ): Promise<{ success: boolean; message: string; result?: any }> {
    try {
      const tableInstance = currentInstances.find(inst => inst.id === params.instanceId && inst.type === 'table') as TableInstance;
      
      if (!tableInstance) {
        return {
          success: false,
          message: `Table instance '${params.instanceId}' not found`
        };
      }

      // Filter rows based on conditions
      const filteredCells = tableInstance.cells.filter(row => {
        const results = params.conditions.map(condition => {
          // Use defensive column name resolution
          const columnResolution = this.resolveColumnName(condition.column, tableInstance);
          if (!columnResolution) {
            console.warn(`⚠️ Column '${condition.column}' not found in filter condition, skipping`);
            return false;
          }
          
          const { columnIndex } = columnResolution;
          const cell = row[columnIndex];
          const cellValue = cell && cell.type === 'text' ? cell.content || '' : '';
          
          switch (condition.operator) {
            case 'equals':
              return cellValue === condition.value;
            case '!=':
            case 'not_equals':
              return cellValue !== condition.value;
            case '>':
              return Number(cellValue) > Number(condition.value);
            case '>=':
              return Number(cellValue) >= Number(condition.value);
            case '<':
              return Number(cellValue) < Number(condition.value);
            case '<=':
              return Number(cellValue) <= Number(condition.value);
            case 'contains':
              return cellValue.toLowerCase().includes(String(condition.value).toLowerCase());
            case 'starts_with':
              return cellValue.toLowerCase().startsWith(String(condition.value).toLowerCase());
            case 'ends_with':
              return cellValue.toLowerCase().endsWith(String(condition.value).toLowerCase());
            default:
              return false;
          }
        });
        
        // Apply operator (AND/OR)
        return params.operator === 'OR' ? 
          results.some(r => r) : 
          results.every(r => r);
      });

      // Create new filtered table instance
      const filteredTableId = `${params.instanceId}_filtered_${Date.now()}`;
      const filteredTable: TableInstance = {
        ...tableInstance,
        id: filteredTableId,
        cells: filteredCells,
        rows: filteredCells.length,
        x: (tableInstance.x || 0) + 50,
        y: (tableInstance.y || 0) + 50
      };

      // Add to context
      updateInstances([...currentInstances, filteredTable]);

      return {
        success: true,
        message: `Created filtered table '${filteredTableId}' with ${filteredCells.length} rows matching ${params.conditions.length} condition(s)`,
        result: {
          action: 'tableFilter',
          originalInstanceId: params.instanceId,
          newInstanceId: filteredTableId,
          conditions: params.conditions,
          operator: params.operator || 'AND',
          resultRows: filteredCells.length
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to filter table: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Create a visualization from table data
   */
  private static async executeCreateVisualization(
    params: { sourceInstanceId: string; chartType: string; xAxis: string; yAxis?: string; title?: string }, 
    currentInstances: Instance[], 
    updateInstances: (newInstances: Instance[]) => void
  ): Promise<{ success: boolean; message: string; result?: any }> {
    try {
      const tableInstance = currentInstances.find(inst => inst.id === params.sourceInstanceId && inst.type === 'table') as TableInstance;
      
      if (!tableInstance) {
        return {
          success: false,
          message: `Source table instance '${params.sourceInstanceId}' not found`
        };
      }

      // Use defensive column name resolution for axes
      const xAxisResolution = this.resolveColumnName(params.xAxis, tableInstance);
      if (!xAxisResolution) {
        return {
          success: false,
          message: `X-axis column '${params.xAxis}' not found in table and couldn't be resolved to default column pattern`
        };
      }
      
      const { columnIndex: xAxisIndex, actualColumnName: actualXAxis } = xAxisResolution;
      
      let yAxisIndex: number | undefined;
      let actualYAxis: string | undefined;
      
      if (params.yAxis) {
        const yAxisResolution = this.resolveColumnName(params.yAxis, tableInstance);
        if (!yAxisResolution) {
          return {
            success: false,
            message: `Y-axis column '${params.yAxis}' not found in table and couldn't be resolved to default column pattern`
          };
        }
        yAxisIndex = yAxisResolution.columnIndex;
        actualYAxis = yAxisResolution.actualColumnName;
      }

      // Convert table data to Vega-Lite format
      const data = tableInstance.cells.map(row => {
        const record: any = {};
        const xCell = row[xAxisIndex];
        record[actualXAxis] = xCell && xCell.type === 'text' ? (xCell as any).content || '' : '';
        if (actualYAxis && yAxisIndex !== undefined) {
          const yCell = row[yAxisIndex];
          const yValue = yCell && yCell.type === 'text' ? (yCell as any).content || '' : '';
          record[actualYAxis] = isNaN(Number(yValue)) ? yValue : Number(yValue);
        }
        return record;
      }).filter(record => record[actualXAxis] !== ''); // Remove empty rows

      // Create Vega-Lite specification
      let vegaSpec: any = {
        "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
        "title": params.title || `${params.chartType} chart`,
        "data": { "values": data },
        "mark": params.chartType
      };

      // Configure encoding based on chart type
      switch (params.chartType) {
        case 'bar':
        case 'line':
        case 'area':
          vegaSpec.encoding = {
            "x": { "field": params.xAxis, "type": "nominal" },
            "y": { "field": params.yAxis, "type": "quantitative" }
          };
          break;
        case 'scatter':
          vegaSpec.encoding = {
            "x": { "field": params.xAxis, "type": "quantitative" },
            "y": { "field": params.yAxis, "type": "quantitative" }
          };
          break;
        case 'pie':
          vegaSpec.mark = "arc";
          vegaSpec.encoding = {
            "theta": { "field": params.yAxis || params.xAxis, "type": "quantitative" },
            "color": { "field": params.xAxis, "type": "nominal" }
          };
          break;
        case 'histogram':
          vegaSpec.mark = "bar";
          vegaSpec.encoding = {
            "x": { "field": params.xAxis, "type": "quantitative", "bin": true },
            "y": { "aggregate": "count", "type": "quantitative" }
          };
          break;
        default:
          vegaSpec.encoding = {
            "x": { "field": params.xAxis, "type": "nominal" },
            "y": { "field": params.yAxis, "type": "quantitative" }
          };
      }

      // Generate thumbnail for the visualization
      let thumbnail = '';
      try {
        thumbnail = await getVisualizationThumbnail(vegaSpec);
      } catch (error) {
        console.warn('[MacroToolExecutor] Failed to generate thumbnail for visualization:', error);
        // Continue without thumbnail - the visualization will still be created
      }

      // Create new visualization instance
      const vizId = `${params.sourceInstanceId}_viz_${Date.now()}`;
      const xPos = (tableInstance.x || 0) + (tableInstance.width || 400) + 20;
      const yPos = tableInstance.y || 0;
      
      console.log('[MacroToolExecutor] Creating visualization at position:', { x: xPos, y: yPos });
      console.log('[MacroToolExecutor] Source table position:', { x: tableInstance.x, y: tableInstance.y, width: tableInstance.width, height: tableInstance.height });
      
      const visualization: VisualizationInstance = {
        id: vizId,
        type: 'visualization',
        source: { type: 'manual' },
        spec: vegaSpec,
        thumbnail: thumbnail, // Add the generated thumbnail (or empty string if failed)
        x: xPos,
        y: yPos,
        width: 400,
        height: 300
      };

      // Add to context
      console.log('[MacroToolExecutor] Adding visualization to instances:', visualization.id);
      console.log('[MacroToolExecutor] Current instances count:', currentInstances.length);
      const newInstances = [...currentInstances, visualization];
      console.log('[MacroToolExecutor] New instances count:', newInstances.length);
      updateInstances(newInstances);

      return {
        success: true,
        message: `Created ${params.chartType} visualization '${vizId}' from table '${params.sourceInstanceId}'`,
        result: {
          action: 'createVisualization',
          sourceInstanceId: params.sourceInstanceId,
          newInstanceId: vizId,
          chartType: params.chartType,
          title: params.title,
          newVisualizationSpec: vegaSpec
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create visualization: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Export instance data
   */
  private static async executeExportData(
    params: { instanceId: string; format: string; filename?: string; includeHeaders?: boolean }, 
    currentInstances: Instance[]
  ): Promise<{ success: boolean; message: string; result?: any }> {
    try {
      const instance = currentInstances.find(inst => inst.id === params.instanceId);
      
      if (!instance) {
        return {
          success: false,
          message: `Instance '${params.instanceId}' not found`
        };
      }

      const filename = params.filename || `${params.instanceId}.${params.format}`;
      let exportData: string;
      let mimeType: string;

      if (instance.type === 'table') {
        const tableInstance = instance as TableInstance;
        
        switch (params.format) {
          case 'csv':
            mimeType = 'text/csv';
            const csvRows: string[] = [];
            
            // Add headers if requested
            if (params.includeHeaders !== false && tableInstance.columnNames) {
              csvRows.push(tableInstance.columnNames.map(name => `"${name.replace(/"/g, '""')}"`).join(','));
            }
            
            // Add data rows
            tableInstance.cells.forEach(row => {
              const csvRow = row.map(cell => {
                const content = cell && cell.type === 'text' ? cell.content || '' : '';
                return `"${content.replace(/"/g, '""')}"`;
              }).join(',');
              csvRows.push(csvRow);
            });
            
            exportData = csvRows.join('\n');
            break;
            
          case 'json':
            mimeType = 'application/json';
            const jsonData = tableInstance.cells.map(row => {
              const record: any = {};
              row.forEach((cell, index) => {
                const columnName = tableInstance.columnNames?.[index] || `col_${index}`;
                record[columnName] = cell && cell.type === 'text' ? cell.content || '' : '';
              });
              return record;
            });
            exportData = JSON.stringify(jsonData, null, 2);
            break;
            
          default:
            return {
              success: false,
              message: `Unsupported export format '${params.format}' for table instances`
            };
        }
      } else if (instance.type === 'visualization') {
        const vizInstance = instance as VisualizationInstance;
        
        switch (params.format) {
          case 'json':
            mimeType = 'application/json';
            exportData = JSON.stringify(vizInstance.spec, null, 2);
            break;
            
          default:
            return {
              success: false,
              message: `Unsupported export format '${params.format}' for visualization instances`
            };
        }
      } else {
        return {
          success: false,
          message: `Export not supported for instance type '${instance.type}'`
        };
      }

      // Create and trigger download
      const blob = new Blob([exportData], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      return {
        success: true,
        message: `Exported '${params.instanceId}' as ${params.format.toUpperCase()} file: ${filename}`,
        result: {
          action: 'exportData',
          instanceId: params.instanceId,
          format: params.format,
          filename: filename
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to export data: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Duplicate an instance
   */
  private static async executeDuplicateInstance(
    params: { sourceInstanceId: string; newName?: string; modifications?: any }, 
    currentInstances: Instance[], 
    updateInstances: (newInstances: Instance[]) => void
  ): Promise<{ success: boolean; message: string; result?: any }> {
    try {
      const sourceInstance = currentInstances.find(inst => inst.id === params.sourceInstanceId);
      
      if (!sourceInstance) {
        return {
          success: false,
          message: `Source instance '${params.sourceInstanceId}' not found`
        };
      }

      // Create new instance ID
      const newId = params.newName || `${params.sourceInstanceId}_copy_${Date.now()}`;
      
      // Deep clone the instance
      const duplicatedInstance: Instance = JSON.parse(JSON.stringify(sourceInstance));
      duplicatedInstance.id = newId;
      
      // Apply offset positioning
      if ('x' in duplicatedInstance && 'y' in duplicatedInstance) {
        duplicatedInstance.x = (duplicatedInstance.x || 0) + 50;
        duplicatedInstance.y = (duplicatedInstance.y || 0) + 50;
      }
      
      // Apply any modifications
      if (params.modifications) {
        Object.assign(duplicatedInstance, params.modifications);
      }

      // Add to context
      updateInstances([...currentInstances, duplicatedInstance]);

      return {
        success: true,
        message: `Duplicated instance '${params.sourceInstanceId}' as '${newId}'`,
        result: {
          action: 'duplicateInstance',
          sourceInstanceId: params.sourceInstanceId,
          newInstanceId: newId
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to duplicate instance: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Perform search and replace
   */
  private static async executeSearchAndReplace(
    params: { instanceId: string; searchPattern: string; replaceWith: string; useRegex?: boolean; columnName?: string }, 
    currentInstances: Instance[], 
    updateInstances: (newInstances: Instance[]) => void
  ): Promise<{ success: boolean; message: string; result?: any }> {
    try {
      const instance = currentInstances.find(inst => inst.id === params.instanceId);
      
      if (!instance) {
        return {
          success: false,
          message: `Instance '${params.instanceId}' not found`
        };
      }

      let replacementCount = 0;
      let pattern: RegExp | string;
      
      if (params.useRegex) {
        try {
          pattern = new RegExp(params.searchPattern, 'g');
        } catch (error) {
          return {
            success: false,
            message: `Invalid regex pattern: ${params.searchPattern}`
          };
        }
      } else {
        pattern = params.searchPattern;
      }

      if (instance.type === 'table') {
        const tableInstance = instance as TableInstance;
        let columnIndex: number | undefined;
        
        if (params.columnName) {
          const columnResolution = this.resolveColumnName(params.columnName, tableInstance);
          if (!columnResolution) {
            console.warn(`⚠️ Column '${params.columnName}' not found for search and replace, will search all columns`);
            columnIndex = undefined;
          } else {
            columnIndex = columnResolution.columnIndex;
          }
        }
        
        // Create updated cells
        const updatedCells = tableInstance.cells.map(row => 
          row.map((cell, index) => {
            // Skip if targeting specific column and this isn't it
            if (columnIndex !== undefined && index !== columnIndex) {
              return cell;
            }
            
            if (cell && cell.type === 'text' && cell.content) {
              let newContent: string;
              if (params.useRegex) {
                newContent = cell.content.replace(pattern as RegExp, params.replaceWith);
              } else {
                newContent = cell.content.split(pattern as string).join(params.replaceWith);
              }
              
              if (newContent !== cell.content) {
                replacementCount++;
                return { ...cell, content: newContent };
              }
            }
            return cell;
          })
        );
        
        // Update the instance
        const updatedInstances = currentInstances.map(inst => 
          inst.id === params.instanceId ? { ...inst, cells: updatedCells } : inst
        );
        updateInstances(updatedInstances);
        
      } else if (instance.type === 'text') {
        // Handle text instances
        const textInstance = instance as any;
        if (textInstance.content) {
          let newContent: string;
          if (params.useRegex) {
            newContent = textInstance.content.replace(pattern as RegExp, params.replaceWith);
          } else {
            newContent = textInstance.content.split(pattern as string).join(params.replaceWith);
          }
          
          if (newContent !== textInstance.content) {
            replacementCount++;
            const updatedInstances = currentInstances.map(inst => {
              if (inst.id === params.instanceId && inst.type === 'text') {
                return { ...inst, content: newContent };
              }
              return inst;
            });
            updateInstances(updatedInstances);
          }
        }
      } else {
        return {
          success: false,
          message: `Search and replace not supported for instance type '${instance.type}'`
        };
      }

      return {
        success: true,
        message: `Replaced ${replacementCount} occurrence(s) of "${params.searchPattern}" with "${params.replaceWith}" in instance '${params.instanceId}'${params.columnName ? ` (column: ${params.columnName})` : ''}`,
        result: {
          action: 'searchAndReplace',
          instanceId: params.instanceId,
          searchPattern: params.searchPattern,
          replaceWith: params.replaceWith,
          replacementCount: replacementCount
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to perform search and replace: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Merge multiple instances using table join functionality
   */
  private static async executeMergeInstances(
    params: { 
      sourceInstanceIds: string[]; 
      mergeStrategy: string; 
      joinColumns?: { leftColumn: string; rightColumn: string }; 
      newInstanceName?: string 
    }, 
    currentInstances: Instance[], 
    updateInstances: (newInstances: Instance[]) => void
  ): Promise<{ success: boolean; message: string; result?: any }> {
    console.log(`🔗 Merging instances:`, params);
    
    try {
      if (params.sourceInstanceIds.length !== 2) {
        return {
          success: false,
          message: `Exactly 2 table instances required for merging. Received ${params.sourceInstanceIds.length} instances.`
        };
      }

      const leftTable = currentInstances.find(inst => 
        inst.id === params.sourceInstanceIds[0] && inst.type === 'table'
      ) as TableInstance | undefined;
      
      const rightTable = currentInstances.find(inst => 
        inst.id === params.sourceInstanceIds[1] && inst.type === 'table'
      ) as TableInstance | undefined;
      
      if (!leftTable || !rightTable) {
        return {
          success: false,
          message: `Could not find both source tables. Left: ${leftTable ? 'found' : 'missing'}, Right: ${rightTable ? 'found' : 'missing'}`
        };
      }

      console.log(`📊 Left table: ${leftTable.rows} rows, ${leftTable.cols} columns`);
      console.log(`📊 Right table: ${rightTable.rows} rows, ${rightTable.cols} columns`);
      console.log(`🏷️ Left columns: ${leftTable.columnNames?.join(', ')}`);
      console.log(`🏷️ Right columns: ${rightTable.columnNames?.join(', ')}`);

      let mergedTable: TableInstance;
      const mergedTableId = params.newInstanceName || `merged_${Date.now()}`;

      if (params.mergeStrategy === 'append' || params.mergeStrategy === 'union') {
        // Union: combine all rows (assuming compatible structure)
        console.log(`🔄 Performing ${params.mergeStrategy} operation`);
        
        const leftNames = leftTable.columnNames || Array.from({ length: leftTable.cols }, (_, i) => `L${i + 1}`);
        
        // For union, use left table column structure
        const mergedCells = [...leftTable.cells, ...rightTable.cells];
        
        mergedTable = {
          id: mergedTableId,
          type: 'table',
          source: { type: 'manual' },
          rows: mergedCells.length,
          cols: leftTable.cols,
          cells: mergedCells,
          columnNames: leftNames,
          columnTypes: leftTable.columnTypes,
          x: Math.max((leftTable.x || 0), (rightTable.x || 0)) + 50,
          y: Math.max((leftTable.y || 0), (rightTable.y || 0)) + 50,
          width: Math.max((leftTable.width || 400), 400),
          height: Math.max((leftTable.height || 300), 300)
        };
        
        console.log(`✅ ${params.mergeStrategy} completed: ${mergedTable.rows} total rows`);
        
      } else if (params.mergeStrategy.includes('join')) {
        // Join operations
        if (!params.joinColumns) {
          return {
            success: false,
            message: `Join columns are required for '${params.mergeStrategy}' strategy. Specify both leftColumn and rightColumn.`
          };
        }

        const { leftColumn, rightColumn } = params.joinColumns;
        
        console.log(`🔄 Performing ${params.mergeStrategy} on ${leftColumn} = ${rightColumn}`);

        // Use defensive column name resolution for join columns
        const leftColumnResolution = this.resolveColumnName(leftColumn, leftTable);
        if (!leftColumnResolution) {
          return {
            success: false,
            message: `Join column '${leftColumn}' not found in left table '${params.sourceInstanceIds[0]}' and couldn't be resolved to default column pattern. Available columns: ${leftTable.columnNames?.join(', ')}`
          };
        }
        
        const rightColumnResolution = this.resolveColumnName(rightColumn, rightTable);
        if (!rightColumnResolution) {
          return {
            success: false,
            message: `Join column '${rightColumn}' not found in right table '${params.sourceInstanceIds[1]}' and couldn't be resolved to default column pattern. Available columns: ${rightTable.columnNames?.join(', ')}`
          };
        }

        const leftColIndex = leftColumnResolution.columnIndex;
        const rightColIndex = rightColumnResolution.columnIndex;

        // Perform join based on strategy
        const joinedRows: any[][] = [];
        const leftNames = leftTable.columnNames || Array.from({ length: leftTable.cols }, (_, i) => `L${i + 1}`);
        const rightNames = rightTable.columnNames || Array.from({ length: rightTable.cols }, (_, i) => `R${i + 1}`);
        
        // Combined column names (rename right join column to avoid conflict)
        const rightNamesAdjusted = rightNames.map((name, index) => 
          index === rightColIndex ? `${rightTable.id}_${name}` : name
        );
        const mergedColumnNames = [...leftNames, ...rightNamesAdjusted];
        
        // Build lookup map for right table for efficient joining
        const rightTableLookup = new Map<string, any[][]>();
        for (let rightRow = 0; rightRow < rightTable.rows; rightRow++) {
          const rightRowData = rightTable.cells[rightRow] || [];
          const rightKeyCell = rightRowData[rightColIndex];
          const rightKey = rightKeyCell && rightKeyCell.type === 'text' ? String(rightKeyCell.content).trim() : '';
          
          if (rightKey) {
            if (!rightTableLookup.has(rightKey)) {
              rightTableLookup.set(rightKey, []);
            }
            rightTableLookup.get(rightKey)!.push(rightRowData);
          }
        }
        
        console.log(`🔍 Built lookup table with ${rightTableLookup.size} unique keys`);
        
        let matchedRows = 0;
        
        for (let leftRow = 0; leftRow < leftTable.rows; leftRow++) {
          const leftRowData = leftTable.cells[leftRow] || [];
          const leftKeyCell = leftRowData[leftColIndex];
          const leftKey = leftKeyCell && leftKeyCell.type === 'text' ? String(leftKeyCell.content).trim() : '';
          
          const rightMatches = rightTableLookup.get(leftKey) || [];
          
          if (rightMatches.length > 0) {
            // Found matches
            matchedRows++;
            for (const rightRowData of rightMatches) {
              const combinedRow = [...leftRowData, ...rightRowData];
              joinedRows.push(combinedRow);
            }
          } else if (params.mergeStrategy === 'left_join') {
            // Left join: include left row even without match, pad with nulls
            const paddedRightRow = new Array(rightTable.cols).fill({ type: 'text', content: '' });
            const combinedRow = [...leftRowData, ...paddedRightRow];
            joinedRows.push(combinedRow);
          }
          // For inner_join, we skip unmatched left rows
        }
        
        // For right_join, add unmatched right rows
        if (params.mergeStrategy === 'right_join') {
          const usedRightKeys = new Set<string>();
          
          // Mark all right keys that were matched
          for (let leftRow = 0; leftRow < leftTable.rows; leftRow++) {
            const leftRowData = leftTable.cells[leftRow] || [];
            const leftKeyCell = leftRowData[leftColIndex];
            const leftKey = leftKeyCell && leftKeyCell.type === 'text' ? String(leftKeyCell.content).trim() : '';
            if (rightTableLookup.has(leftKey)) {
              usedRightKeys.add(leftKey);
            }
          }
          
          // Add unmatched right rows
          for (const [rightKey, rightRows] of rightTableLookup.entries()) {
            if (!usedRightKeys.has(rightKey)) {
              for (const rightRowData of rightRows) {
                const paddedLeftRow = new Array(leftTable.cols).fill({ type: 'text', content: '' });
                const combinedRow = [...paddedLeftRow, ...rightRowData];
                joinedRows.push(combinedRow);
              }
            }
          }
        }
        
        if (joinedRows.length === 0 && params.mergeStrategy === 'inner_join') {
          return {
            success: false,
            message: `No matching rows found for ${params.mergeStrategy} on '${leftColumn}' = '${rightColumn}'`
          };
        }
        
        console.log(`✅ ${params.mergeStrategy} completed: ${matchedRows} left rows matched, ${joinedRows.length} result rows`);
        
        mergedTable = {
          id: mergedTableId,
          type: 'table',
          source: { type: 'manual' },
          rows: joinedRows.length,
          cols: mergedColumnNames.length,
          cells: joinedRows,
          columnNames: mergedColumnNames,
          columnTypes: [...(leftTable.columnTypes || []), ...(rightTable.columnTypes || [])],
          x: Math.max((leftTable.x || 0), (rightTable.x || 0)) + 50,
          y: Math.max((leftTable.y || 0), (rightTable.y || 0)) + 50,
          width: Math.max((leftTable.width || 400), 500),
          height: Math.max((leftTable.height || 300), 400)
        };
        
      } else {
        return {
          success: false,
          message: `Unsupported merge strategy: ${params.mergeStrategy}. Supported strategies: append, union, inner_join, left_join, right_join`
        };
      }

      // Add merged table to context
      updateInstances([...currentInstances, mergedTable]);

      console.log(`🎉 Merge operation completed successfully`);

      return {
        success: true,
        message: `Merged tables '${params.sourceInstanceIds[0]}' and '${params.sourceInstanceIds[1]}' using '${params.mergeStrategy}' strategy. Created table '${mergedTableId}' with ${mergedTable.rows} rows and ${mergedTable.cols} columns.`,
        result: {
          action: 'mergeInstances',
          sourceInstanceIds: params.sourceInstanceIds,
          newInstanceId: mergedTableId,
          mergeStrategy: params.mergeStrategy,
          joinColumns: params.joinColumns,
          resultRows: mergedTable.rows,
          resultCols: mergedTable.cols
        }
      };
    } catch (error) {
      console.error(`💥 Merge instances error:`, error);
      return {
        success: false,
        message: `Failed to merge instances: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Execute fillMissingValues tool - fills missing values in table columns
   */
  private static async executeFillMissingValues(
    params: {
      instanceId: string;
      columnName: string;
      strategy: string;
      constantValue?: string;
      missingIndicators?: string[];
    },
    currentInstances: Instance[],
    updateInstances: (newInstances: Instance[]) => void
  ): Promise<{ success: boolean; message: string; result?: any }> {
    try {
      const { instanceId, columnName, strategy, constantValue, missingIndicators = ["", "N/A", "null", "NULL", "-"] } = params;
      
      // Find the target table instance
      const tableInstance = currentInstances.find(inst => inst.id === instanceId && inst.type === 'table') as TableInstance;
      if (!tableInstance) {
        return {
          success: false,
          message: `Table instance '${instanceId}' not found`
        };
      }

      // Resolve column name and get index
      const columnInfo = this.resolveColumnName(columnName, tableInstance);
      if (!columnInfo) {
        return {
          success: false,
          message: `Column '${columnName}' not found in table '${instanceId}'`
        };
      }

      const { columnIndex } = columnInfo;
      
      // Extract column values
      const columnValues: (string | null)[] = tableInstance.cells.map(row => {
        const cell = row[columnIndex];
        if (!cell || !('content' in cell) || !cell.content || missingIndicators.includes(cell.content.trim())) {
          return null; // Missing value
        }
        return cell.content;
      });

      // Calculate statistics for imputation
      const validValues = columnValues.filter(val => val !== null) as string[];
      const missingCount = columnValues.length - validValues.length;
      const missingPercentage = (missingCount / columnValues.length) * 100;

      if (missingCount === 0) {
        return {
          success: false,
          message: `No missing values found in column '${columnName}'`
        };
      }

      if (missingPercentage > 80) {
        return {
          success: false,
          message: `Too many missing values (${missingPercentage.toFixed(1)}%). Cannot reliably impute column '${columnName}'`
        };
      }

      // Calculate imputation value based on strategy
      let imputeValue: string;
      
      switch (strategy) {
        case 'mean': {
          const numericalValues = validValues.map(val => parseFloat(val)).filter(val => !isNaN(val));
          if (numericalValues.length === 0) {
            return {
              success: false,
              message: `Cannot calculate mean for non-numerical column '${columnName}'`
            };
          }
          const mean = numericalValues.reduce((sum, val) => sum + val, 0) / numericalValues.length;
          imputeValue = mean.toString();
          break;
        }
        
        case 'median': {
          const numericalValues = validValues.map(val => parseFloat(val)).filter(val => !isNaN(val));
          if (numericalValues.length === 0) {
            return {
              success: false,
              message: `Cannot calculate median for non-numerical column '${columnName}'`
            };
          }
          numericalValues.sort((a, b) => a - b);
          const mid = Math.floor(numericalValues.length / 2);
          const median = numericalValues.length % 2 === 0 
            ? (numericalValues[mid - 1] + numericalValues[mid]) / 2
            : numericalValues[mid];
          imputeValue = median.toString();
          break;
        }
        
        case 'mode': {
          const valueCounts: { [key: string]: number } = {};
          validValues.forEach(val => {
            valueCounts[val] = (valueCounts[val] || 0) + 1;
          });
          const mode = Object.entries(valueCounts).reduce((a, b) => valueCounts[a[0]] > valueCounts[b[0]] ? a : b)[0];
          imputeValue = mode;
          break;
        }
        
        case 'constant': {
          if (!constantValue) {
            return {
              success: false,
              message: `Constant value required for 'constant' strategy`
            };
          }
          imputeValue = constantValue;
          break;
        }
        
        case 'forward_fill': {
          // Will be handled row by row below
          imputeValue = '';
          break;
        }
        
        case 'backward_fill': {
          // Will be handled row by row below
          imputeValue = '';
          break;
        }
        
        case 'interpolate': {
          const numericalValues = validValues.map(val => parseFloat(val)).filter(val => !isNaN(val));
          if (numericalValues.length === 0) {
            return {
              success: false,
              message: `Cannot interpolate non-numerical column '${columnName}'`
            };
          }
          // Will be handled row by row below
          imputeValue = '';
          break;
        }
        
        default:
          return {
            success: false,
            message: `Unknown imputation strategy: ${strategy}`
          };
      }

      // Create new cells with imputed values
      const newCells = tableInstance.cells.map((row, rowIndex) => {
        const newRow = [...row];
        const cell = newRow[columnIndex];
        
        if (!cell || !('content' in cell) || !cell.content || missingIndicators.includes(cell.content.trim())) {
          // This is a missing value, fill it
          let fillValue = imputeValue;
          
          // Special handling for forward/backward fill and interpolation
          if (strategy === 'forward_fill') {
            // Find the last valid value before this row
            for (let i = rowIndex - 1; i >= 0; i--) {
              const prevCell = tableInstance.cells[i][columnIndex];
              if (prevCell && 'content' in prevCell && prevCell.content && !missingIndicators.includes(prevCell.content.trim())) {
                fillValue = prevCell.content;
                break;
              }
            }
            if (!fillValue && validValues.length > 0) {
              fillValue = validValues[0]; // Fallback to first valid value
            }
          } else if (strategy === 'backward_fill') {
            // Find the next valid value after this row
            for (let i = rowIndex + 1; i < tableInstance.cells.length; i++) {
              const nextCell = tableInstance.cells[i][columnIndex];
              if (nextCell && 'content' in nextCell && nextCell.content && !missingIndicators.includes(nextCell.content.trim())) {
                fillValue = nextCell.content;
                break;
              }
            }
            if (!fillValue && validValues.length > 0) {
              fillValue = validValues[validValues.length - 1]; // Fallback to last valid value
            }
          } else if (strategy === 'interpolate') {
            // Simple linear interpolation between nearest valid values
            let prevValue: number | null = null;
            let nextValue: number | null = null;
            let prevIndex = -1;
            let nextIndex = -1;
            
            // Find previous valid numerical value
            for (let i = rowIndex - 1; i >= 0; i--) {
              const prevCell = tableInstance.cells[i][columnIndex];
              if (prevCell && 'content' in prevCell && prevCell.content && !missingIndicators.includes(prevCell.content.trim())) {
                const val = parseFloat(prevCell.content);
                if (!isNaN(val)) {
                  prevValue = val;
                  prevIndex = i;
                  break;
                }
              }
            }
            
            // Find next valid numerical value
            for (let i = rowIndex + 1; i < tableInstance.cells.length; i++) {
              const nextCell = tableInstance.cells[i][columnIndex];
              if (nextCell && 'content' in nextCell && nextCell.content && !missingIndicators.includes(nextCell.content.trim())) {
                const val = parseFloat(nextCell.content);
                if (!isNaN(val)) {
                  nextValue = val;
                  nextIndex = i;
                  break;
                }
              }
            }
            
            if (prevValue !== null && nextValue !== null) {
              // Linear interpolation
              const ratio = (rowIndex - prevIndex) / (nextIndex - prevIndex);
              fillValue = (prevValue + ratio * (nextValue - prevValue)).toString();
            } else if (prevValue !== null) {
              fillValue = prevValue.toString();
            } else if (nextValue !== null) {
              fillValue = nextValue.toString();
            } else {
              // Fallback to mean if no valid values found for interpolation
              const numericalValues = validValues.map(val => parseFloat(val)).filter(val => !isNaN(val));
              if (numericalValues.length > 0) {
                const mean = numericalValues.reduce((sum, val) => sum + val, 0) / numericalValues.length;
                fillValue = mean.toString();
              } else {
                fillValue = '0'; // Ultimate fallback
              }
            }
          }
          
          newRow[columnIndex] = {
            type: 'text',
            id: `filled_${rowIndex}_${columnIndex}`,
            content: fillValue,
            source: { type: 'manual' }
          };
        }
        
        return newRow;
      });

      // Update instances
      const updatedInstances = currentInstances.map(inst => {
        if (inst.id === instanceId && inst.type === 'table') {
          return { ...inst, cells: newCells };
        }
        return inst;
      });

      updateInstances(updatedInstances);

      return {
        success: true,
        message: `Filled ${missingCount} missing values in column '${columnName}' using ${strategy} strategy`,
        result: {
          filledCount: missingCount,
          strategy: strategy,
          columnName: columnName,
          missingPercentage: missingPercentage.toFixed(1)
        }
      };

    } catch (error) {
      return {
        success: false,
        message: `Error filling missing values: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Append one or more rows to an existing table instance
   */
  private static async executeAppendToTable(
    params: { instanceId: string; rows: Record<string, string>[] },
    currentInstances: Instance[],
    updateInstances: (newInstances: Instance[]) => void
  ): Promise<{ success: boolean; message: string; result?: any }> {
    const tableInstance = currentInstances.find(
      inst => inst.id === params.instanceId && inst.type === 'table'
    ) as TableInstance | undefined;

    if (!tableInstance) {
      return { success: false, message: `Table '${params.instanceId}' not found` };
    }
    if (!Array.isArray(params.rows) || params.rows.length === 0) {
      return { success: false, message: 'No rows provided to append' };
    }

    const newCells: (import('./types').EmbeddedInstance | null)[][] = params.rows.map(rowObj => {
      return (tableInstance.columnNames || []).map(colName => {
        const val = rowObj[colName] ?? '';
        if (!val) return null;
        return { id: `cell-${Math.random().toString(36).slice(2)}`, type: 'text', content: String(val), source: { type: 'manual' } } as import('./types').EmbeddedInstance;
      });
    });

    const updatedTable: TableInstance = {
      ...tableInstance,
      rows: tableInstance.rows + newCells.length,
      cells: [...tableInstance.cells, ...newCells]
    };

    updateInstances(currentInstances.map(inst => inst.id === params.instanceId ? updatedTable : inst));
    return { success: true, message: `Appended ${newCells.length} row(s) to table '${params.instanceId}'` };
  }

  /**
   * Add a new empty column to an existing table instance
   */
  private static async executeAddColumnToTable(
    params: { instanceId: string; columnName: string; columnType?: 'categorical' | 'numeral' },
    currentInstances: Instance[],
    updateInstances: (newInstances: Instance[]) => void
  ): Promise<{ success: boolean; message: string; result?: any }> {
    const tableInstance = currentInstances.find(
      inst => inst.id === params.instanceId && inst.type === 'table'
    ) as TableInstance | undefined;

    if (!tableInstance) {
      return { success: false, message: `Table '${params.instanceId}' not found` };
    }
    if (tableInstance.columnNames?.includes(params.columnName)) {
      return { success: false, message: `Column '${params.columnName}' already exists` };
    }

    const updatedTable: TableInstance = {
      ...tableInstance,
      cols: tableInstance.cols + 1,
      columnNames: [...(tableInstance.columnNames || []), params.columnName],
      columnTypes: [...(tableInstance.columnTypes || []), params.columnType ?? 'categorical'],
      cells: tableInstance.cells.map(row => [...row, null])
    };

    updateInstances(currentInstances.map(inst => inst.id === params.instanceId ? updatedTable : inst));
    return { success: true, message: `Added column '${params.columnName}' to table '${params.instanceId}'` };
  }

  /** Replace an existing instance with a new version */
  private static async executeUpdateInstance(
    params: { instanceId: string; newInstance: any },
    currentInstances: Instance[],
    updateInstances: (newInstances: Instance[]) => void
  ): Promise<{ success: boolean; message: string }> {
    const idx = currentInstances.findIndex(i => i.id === params.instanceId);
    if (idx === -1) return { success: false, message: `Instance '${params.instanceId}' not found` };
    const updated = currentInstances.map(i => i.id === params.instanceId ? { ...i, ...params.newInstance, id: params.instanceId } : i);
    updateInstances(updated);
    return { success: true, message: `Updated instance '${params.instanceId}'` };
  }

  /** Add a computed column to a table using a simple column-reference formula */
  private static async executeAddComputedColumn(
    params: { instanceId: string; formula: string; newColumnName: string },
    currentInstances: Instance[],
    updateInstances: (newInstances: Instance[]) => void
  ): Promise<{ success: boolean; message: string }> {
    const table = currentInstances.find(i => i.id === params.instanceId && i.type === 'table') as TableInstance | undefined;
    if (!table) return { success: false, message: `Table '${params.instanceId}' not found` };
    if (table.columnNames?.includes(params.newColumnName)) return { success: false, message: `Column '${params.newColumnName}' already exists` };

    // Evaluate formula per row: replace column names with their numeric values
    const newCells = table.cells.map(row => {
      try {
        let expr = params.formula;
        (table.columnNames || []).forEach((colName, idx) => {
          const cell = row[idx];
          const val = cell?.type === 'text' ? parseFloat((cell as any).content) || 0 : 0;
          expr = expr.replace(new RegExp(`\\b${colName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), String(val));
        });
        // eslint-disable-next-line no-new-func
        const result = Function(`"use strict"; return (${expr})`)();
        const content = isFinite(result) ? String(result) : '';
        return content ? { id: `cell-${Math.random().toString(36).slice(2)}`, type: 'text' as const, content, source: { type: 'manual' as const } } : null;
      } catch { return null; }
    });

    const updatedTable: TableInstance = {
      ...table,
      cols: table.cols + 1,
      columnNames: [...(table.columnNames || []), params.newColumnName],
      columnTypes: [...(table.columnTypes || []), 'numeral' as const],
      cells: table.cells.map((row, i) => [...row, newCells[i]])
    };
    updateInstances(currentInstances.map(inst => inst.id === params.instanceId ? updatedTable : inst));
    return { success: true, message: `Added computed column '${params.newColumnName}' to table '${params.instanceId}'` };
  }

  /** Apply a text format transformation to all cells in a column */
  private static async executeFormatColumn(
    params: { instanceId: string; columnName: string; formatPattern: string },
    currentInstances: Instance[],
    updateInstances: (newInstances: Instance[]) => void
  ): Promise<{ success: boolean; message: string }> {
    const table = currentInstances.find(i => i.id === params.instanceId && i.type === 'table') as TableInstance | undefined;
    if (!table) return { success: false, message: `Table '${params.instanceId}' not found` };

    const resolved = MacroToolExecutor.resolveColumnName(params.columnName, table);
    if (!resolved) return { success: false, message: `Column '${params.columnName}' not found in table '${params.instanceId}'` };
    const { columnIndex } = resolved;

    const applyFormat = (text: string, pattern: string): string => {
      switch (pattern.toLowerCase()) {
        case 'uppercase': return text.toUpperCase();
        case 'lowercase': return text.toLowerCase();
        case 'titlecase': return text.replace(/\b\w/g, c => c.toUpperCase());
        case 'trim': return text.trim();
        default: return text; // unknown patterns are a no-op
      }
    };

    const updatedCells = table.cells.map(row =>
      row.map((cell, idx) => {
        if (idx !== columnIndex || !cell || cell.type !== 'text') return cell;
        const formatted = applyFormat((cell as any).content || '', params.formatPattern);
        return { ...cell, content: formatted };
      })
    );

    const updatedTable: TableInstance = { ...table, cells: updatedCells };
    updateInstances(currentInstances.map(inst => inst.id === params.instanceId ? updatedTable : inst));
    return { success: true, message: `Formatted column '${params.columnName}' in table '${params.instanceId}' using '${params.formatPattern}'` };
  }
}

/**
 * Simple wrapper for external usage
 */
export const executeMacroTool = async (
  toolCall: ToolCall,
  currentInstances: Instance[],
  updateInstances: (newInstances: Instance[]) => void
) => {
  return await MacroToolExecutor.executeTool(toolCall, currentInstances, updateInstances);
};

/**
 * Execute a composite macro suggestion (supports both single tools and tool sequences)
 */
export const executeCompositeSuggestion = async (
  suggestion: {
    toolCall?: ToolCall;
    toolSequence?: {
      goal: string;
      steps: Array<{
        description: string;
        toolCall: ToolCall;
      }>;
    };
  },
  currentInstances: Instance[],
  updateInstances: (newInstances: Instance[]) => void
): Promise<{ success: boolean; message: string; result?: any }> => {
  if (suggestion.toolSequence) {
    // Execute as a composite suggestion
    return await MacroToolExecutor.executeToolSequence(
      suggestion.toolSequence,
      currentInstances,
      updateInstances
    );
  } else if (suggestion.toolCall) {
    // Execute as a single tool call
    return await MacroToolExecutor.executeTool(
      suggestion.toolCall,
      currentInstances,
      updateInstances
    );
    } else {
      return {
        success: false,
        message: "Suggestion must contain either toolCall or toolSequence"
      };
    }
  };
