/**
 * Macro Tool Executor - Handles the execution of macro suggestion tools
 * Integrates with WebSeek's existing instance management and functionality
 */

import { validateToolCall } from './macro-tools';
import { TableInstance, VisualizationInstance, Instance } from './types';

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
    try {
      const tableInstance = currentInstances.find(inst => inst.id === params.instanceId && inst.type === 'table') as TableInstance;
      
      if (!tableInstance) {
        return {
          success: false,
          message: `Table instance '${params.instanceId}' not found`
        };
      }

      // Find column index by name
      const columnIndex = tableInstance.columnNames?.indexOf(params.columnName);
      if (columnIndex === undefined || columnIndex === -1) {
        return {
          success: false,
          message: `Column '${params.columnName}' not found in table '${params.instanceId}'`
        };
      }

      // Create sorted version of the table
      const sortedCells = [...tableInstance.cells];
      const columnType = tableInstance.columnTypes?.[columnIndex] || 'categorical';
      
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
          } else {
            comparison = valA.localeCompare(valB);
          }
        } else {
          comparison = valA.localeCompare(valB);
        }
        
        return params.order === 'asc' ? comparison : -comparison;
      });

      // Create new sorted table instance
      const sortedTableId = `${params.instanceId}_sorted_${Date.now()}`;
      const sortedTable: TableInstance = {
        ...tableInstance,
        id: sortedTableId,
        cells: sortedCells,
        x: (tableInstance.x || 0) + 50,
        y: (tableInstance.y || 0) + 50
      };

      // Add to context
      updateInstances([...currentInstances, sortedTable]);

      return {
        success: true,
        message: `Created sorted table '${sortedTableId}' sorted by '${params.columnName}' (${params.order})`,
        result: {
          action: 'tableSort',
          originalInstanceId: params.instanceId,
          newInstanceId: sortedTableId,
          columnName: params.columnName,
          order: params.order
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to sort table: ${error instanceof Error ? error.message : String(error)}`
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

      // Create new visualization instance
      const vizId = `${params.sourceInstanceId}_viz_${Date.now()}`;
      const visualization: VisualizationInstance = {
        id: vizId,
        type: 'visualization',
        source: { type: 'manual' },
        spec: vegaSpec,
        x: (tableInstance.x || 0) + (tableInstance.width || 400) + 20,
        y: tableInstance.y || 0,
        width: 400,
        height: 300
      };

      // Add to context
      updateInstances([...currentInstances, visualization]);

      return {
        success: true,
        message: `Created ${params.chartType} visualization '${vizId}' from table '${params.sourceInstanceId}'`,
        result: {
          action: 'createVisualization',
          sourceInstanceId: params.sourceInstanceId,
          newInstanceId: vizId,
          chartType: params.chartType,
          title: params.title
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
    params: { sourceInstanceIds: string[]; mergeStrategy: string; joinColumn?: string; newInstanceName?: string }, 
    currentInstances: Instance[], 
    updateInstances: (newInstances: Instance[]) => void
  ): Promise<{ success: boolean; message: string; result?: any }> {
    try {
      const sourceInstances = params.sourceInstanceIds.map(id => 
        currentInstances.find(inst => inst.id === id && inst.type === 'table')
      ).filter(inst => inst !== undefined) as TableInstance[];
      
      if (sourceInstances.length < 2) {
        return {
          success: false,
          message: `Need at least 2 table instances for merging. Found ${sourceInstances.length} valid tables.`
        };
      }

      const leftTable = sourceInstances[0];
      const rightTable = sourceInstances[1];
      
      let mergedTable: TableInstance;
      const mergedTableId = params.newInstanceName || `merged_${Date.now()}`;

      if (params.mergeStrategy === 'append' || params.mergeStrategy === 'union') {
        // Union: combine all rows (assuming compatible structure)
        const leftNames = leftTable.columnNames || Array.from({ length: leftTable.cols }, (_, i) => `L${i + 1}`);
        const rightNames = rightTable.columnNames || Array.from({ length: rightTable.cols }, (_, i) => `R${i + 1}`);
        
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
        
      } else if (params.mergeStrategy === 'join') {
        // Inner join using specified column
        if (!params.joinColumn) {
          return {
            success: false,
            message: `Join column is required for 'join' merge strategy`
          };
        }

        const leftColIndex = leftTable.columnNames?.indexOf(params.joinColumn);
        const rightColIndex = rightTable.columnNames?.indexOf(params.joinColumn);
        
        if (leftColIndex === undefined || leftColIndex === -1) {
          return {
            success: false,
            message: `Join column '${params.joinColumn}' not found in left table`
          };
        }
        
        if (rightColIndex === undefined || rightColIndex === -1) {
          return {
            success: false,
            message: `Join column '${params.joinColumn}' not found in right table`
          };
        }

        // Perform inner join
        const joinedRows: any[][] = [];
        const leftNames = leftTable.columnNames || Array.from({ length: leftTable.cols }, (_, i) => `L${i + 1}`);
        const rightNames = rightTable.columnNames || Array.from({ length: rightTable.cols }, (_, i) => `R${i + 1}`);
        
        // Combined column names (exclude right join column to avoid duplication)
        const rightNamesExcludingJoinCol = rightNames.filter((_, index) => index !== rightColIndex);
        const mergedColumnNames = [...leftNames, ...rightNamesExcludingJoinCol];
        
        for (let leftRow = 0; leftRow < leftTable.rows; leftRow++) {
          const leftRowData = leftTable.cells[leftRow] || [];
          const leftKeyCell = leftRowData[leftColIndex];
          const leftKey = leftKeyCell && leftKeyCell.type === 'text' ? leftKeyCell.content : '';
          
          if (!leftKey) continue;
          
          for (let rightRow = 0; rightRow < rightTable.rows; rightRow++) {
            const rightRowData = rightTable.cells[rightRow] || [];
            const rightKeyCell = rightRowData[rightColIndex];
            const rightKey = rightKeyCell && rightKeyCell.type === 'text' ? rightKeyCell.content : '';
            
            if (leftKey === rightKey) {
              // Match found - combine rows (exclude right join column)
              const rightRowExcludingJoinCol = rightRowData.filter((_, index) => index !== rightColIndex);
              const combinedRow = [...leftRowData, ...rightRowExcludingJoinCol];
              joinedRows.push(combinedRow);
            }
          }
        }
        
        if (joinedRows.length === 0) {
          return {
            success: false,
            message: `No matching rows found for join on column '${params.joinColumn}'`
          };
        }
        
        mergedTable = {
          id: mergedTableId,
          type: 'table',
          source: { type: 'manual' },
          rows: joinedRows.length,
          cols: mergedColumnNames.length,
          cells: joinedRows,
          columnNames: mergedColumnNames,
          columnTypes: [...(leftTable.columnTypes || []), ...(rightTable.columnTypes || []).filter((_, index) => index !== rightColIndex)],
          x: Math.max((leftTable.x || 0), (rightTable.x || 0)) + 50,
          y: Math.max((leftTable.y || 0), (rightTable.y || 0)) + 50,
          width: Math.max((leftTable.width || 400), 400),
          height: Math.max((leftTable.height || 300), 300)
        };
        
      } else {
        return {
          success: false,
          message: `Unsupported merge strategy: ${params.mergeStrategy}. Supported strategies: append, union, join`
        };
      }

      // Add merged table to context
      updateInstances([...currentInstances, mergedTable]);

      return {
        success: true,
        message: `Merged ${sourceInstances.length} tables using '${params.mergeStrategy}' strategy. Created table '${mergedTableId}' with ${mergedTable.rows} rows.`,
        result: {
          action: 'mergeInstances',
          sourceInstanceIds: params.sourceInstanceIds,
          newInstanceId: mergedTableId,
          mergeStrategy: params.mergeStrategy,
          resultRows: mergedTable.rows,
          resultCols: mergedTable.cols
        }
      };
    } catch (error) {
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
