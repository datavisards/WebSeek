/**
 * Macro Tool Executor - Handles the execution of macro suggestion tools
 * Integrates with WebSeek's existing instance management and functionality
 */

import { validateToolCall } from './macro-tools';
import { TableInstance, VisualizationInstance, Instance } from './types';
import { extractNumericalValue, getVisualizationThumbnail } from './utils';

export class MacroToolExecutor {
  
  /**
   * Execute a tool call from a macro suggestion
   */
  static async executeTool(
    toolCall: { function: string; parameters: any }, 
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
        
        case 'exportData':
          return await this.executeExportData(toolCall.parameters, currentInstances);
        
        case 'duplicateInstance':
          return await this.executeDuplicateInstance(toolCall.parameters, currentInstances, updateInstances);
        
        case 'searchAndReplace':
          return await this.executeSearchAndReplace(toolCall.parameters, currentInstances, updateInstances);
        
        case 'mergeInstances':
          return await this.executeMergeInstances(toolCall.parameters, currentInstances, updateInstances);
        
        case 'convertColumnType':
          return await this.executeConvertColumnType(toolCall.parameters, currentInstances, updateInstances);
        
        case 'renameColumn':
          return await this.executeRenameColumn(toolCall.parameters, currentInstances, updateInstances);
        
        default:
          return {
            success: false,
            message: `Unknown tool function: ${toolCall.function}`
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
        toolCall: { function: string; parameters: any };
      }>;
    },
    currentInstances: Instance[],
    updateInstances: (newInstances: Instance[]) => void
  ): Promise<{ success: boolean; message: string; result?: any }> {
    console.log(`🚀 Starting tool sequence execution: ${toolSequence.goal}`);
    console.log(`📋 Total steps: ${toolSequence.steps.length}`);
    
    const results: any[] = [];
    let instances = [...currentInstances];
    
    try {
      // Execute each step in sequence
      for (let i = 0; i < toolSequence.steps.length; i++) {
        const step = toolSequence.steps[i];
        
        console.log(`\n⚡ Step ${i + 1}/${toolSequence.steps.length}: ${step.description}`);
        console.log(`🔧 Tool: ${step.toolCall.function}`);
        console.log(`📄 Parameters:`, step.toolCall.parameters);
        
        // Create a temporary update function to track intermediate changes
        let stepInstances = instances;
        const stepUpdateInstances = (newInstances: Instance[]) => {
          console.log(`📊 Step ${i + 1} updated ${newInstances.length} instances`);
          stepInstances = newInstances;
        };
        
        // Execute the tool for this step
        const stepResult = await this.executeTool(
          step.toolCall,
          instances,
          stepUpdateInstances
        );
        
        console.log(`✅ Step ${i + 1} result:`, stepResult);
        
        if (!stepResult.success) {
          console.error(`❌ Step ${i + 1} failed: ${stepResult.message}`);
          return {
            success: false,
            message: `Step ${i + 1} failed: ${stepResult.message}. Goal: ${toolSequence.goal}`
          };
        }
        
        // Update instances for next step
        instances = stepInstances;
        results.push({
          step: i + 1,
          description: step.description,
          result: stepResult.result
        });
        
        console.log(`✨ Step ${i + 1} completed successfully`);
      }
      
      console.log(`🎉 All steps completed. Applying final changes to ${instances.length} instances`);
      
      // Apply final changes using the provided updateInstances function
      updateInstances(instances);
      
      return {
        success: true,
        message: `Successfully completed all ${toolSequence.steps.length} steps for: ${toolSequence.goal}`,
        result: {
          goal: toolSequence.goal,
          steps: results,
          totalSteps: toolSequence.steps.length
        }
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

      // Find column index by name
      const columnIndex = tableInstance.columnNames?.indexOf(params.columnName);
      if (columnIndex === undefined || columnIndex === -1) {
        console.error(`❌ Column '${params.columnName}' not found`);
        return {
          success: false,
          message: `Column '${params.columnName}' not found in table '${params.instanceId}'. Available columns: ${tableInstance.columnNames.join(', ')}`
        };
      }

      console.log(`📍 Sorting by column '${params.columnName}' at index ${columnIndex}`);

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

      // Find the column index
      const columnIndex = tableInstance.columnNames.indexOf(params.columnName);
      if (columnIndex === -1) {
        console.error(`❌ Column '${params.columnName}' not found`);
        return {
          success: false,
          message: `Column '${params.columnName}' not found in table '${params.instanceId}'. Available columns: ${tableInstance.columnNames.join(', ')}`
        };
      }

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

      // Find the column index
      const columnIndex = tableInstance.columnNames.indexOf(params.oldColumnName);
      if (columnIndex === -1) {
        console.error(`❌ Column '${params.oldColumnName}' not found`);
        return {
          success: false,
          message: `Column '${params.oldColumnName}' not found in table '${params.instanceId}'. Available columns: ${tableInstance.columnNames.join(', ')}`
        };
      }

      // Check if new column name already exists
      if (tableInstance.columnNames.includes(params.newColumnName)) {
        console.error(`❌ Column name '${params.newColumnName}' already exists`);
        return {
          success: false,
          message: `Column name '${params.newColumnName}' already exists in table '${params.instanceId}'`
        };
      }

      console.log(`📍 Column '${params.oldColumnName}' found at index ${columnIndex}, renaming to '${params.newColumnName}'`);

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
          const columnIndex = tableInstance.columnNames?.indexOf(condition.column);
          if (columnIndex === undefined || columnIndex === -1) return false;
          
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

      // Find column indices
      const xAxisIndex = tableInstance.columnNames?.indexOf(params.xAxis);
      const yAxisIndex = params.yAxis ? tableInstance.columnNames?.indexOf(params.yAxis) : undefined;
      
      if (xAxisIndex === undefined || xAxisIndex === -1) {
        return {
          success: false,
          message: `X-axis column '${params.xAxis}' not found in table`
        };
      }
      
      if (params.yAxis && (yAxisIndex === undefined || yAxisIndex === -1)) {
        return {
          success: false,
          message: `Y-axis column '${params.yAxis}' not found in table`
        };
      }

      // Convert table data to Vega-Lite format
      const data = tableInstance.cells.map(row => {
        const record: any = {};
        record[params.xAxis] = row[xAxisIndex] && row[xAxisIndex].type === 'text' ? row[xAxisIndex].content : '';
        if (params.yAxis && yAxisIndex !== undefined) {
          const yValue = row[yAxisIndex] && row[yAxisIndex].type === 'text' ? row[yAxisIndex].content : '';
          record[params.yAxis] = isNaN(Number(yValue)) ? yValue : Number(yValue);
        }
        return record;
      }).filter(record => record[params.xAxis] !== ''); // Remove empty rows

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
        const columnIndex = params.columnName ? 
          tableInstance.columnNames?.indexOf(params.columnName) : 
          undefined;
        
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

        const leftColIndex = leftTable.columnNames?.indexOf(leftColumn);
        const rightColIndex = rightTable.columnNames?.indexOf(rightColumn);
        
        if (leftColIndex === undefined || leftColIndex === -1) {
          return {
            success: false,
            message: `Join column '${leftColumn}' not found in left table '${params.sourceInstanceIds[0]}'. Available columns: ${leftTable.columnNames?.join(', ')}`
          };
        }
        
        if (rightColIndex === undefined || rightColIndex === -1) {
          return {
            success: false,
            message: `Join column '${rightColumn}' not found in right table '${params.sourceInstanceIds[1]}'. Available columns: ${rightTable.columnNames?.join(', ')}`
          };
        }

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
}

/**
 * Simple wrapper for external usage
 */
export const executeMacroTool = async (
  toolCall: { function: string; parameters: any },
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
    toolCall?: { function: string; parameters: any };
    toolSequence?: {
      goal: string;
      steps: Array<{
        description: string;
        toolCall: { function: string; parameters: any };
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
