/**
 * TriggerEngine - Contains heuristic rules and decides when to generate suggestions
 * Part of the enhanced proactive suggestion system
 */

import { UserActionEvent, SuggestionTriggerRule } from './types';
import { actionMonitor, UserActionMonitor } from './action-monitor';

export class TriggerEngine {
  private rules: SuggestionTriggerRule[] = [];
  private pendingTriggers: Map<string, NodeJS.Timeout> = new Map();
  private onDebouncedRuleTrigger?: (rule: SuggestionTriggerRule) => void;

  constructor() {
    this.initializeDefaultRules();
  }

  /**
   * Initialize the default trigger rules based on the design document
   */
  private initializeDefaultRules() {
    // Data Extraction & Wrangling Rules
    this.addRule({
      id: 'element-selection-batch',
      name: 'Batch Element Selection',
      description: 'Suggest selecting all similar elements after user selects second element',
      pattern: (events: UserActionEvent[]) => {
        const selections = events.filter(e => e.type === UserActionMonitor.ActionTypes.ELEMENT_SELECTED);
        console.log('[TriggerEngine] Element selection pattern check:', {
          totalEvents: events.length,
          elementSelections: selections.length,
          selections: selections.map(s => ({ type: s.type, context: s.context }))
        });
        const hasEnoughSelections = selections.length >= 2;
        const areElementsSimilar = hasEnoughSelections && this.areElementsSimilar(selections);
        console.log('[TriggerEngine] Pattern result:', { hasEnoughSelections, areElementsSimilar });
        return hasEnoughSelections && areElementsSimilar;
      },
      suggestionType: 'batch-select-elements',
      scope: 'micro',
      modality: 'in-situ',
      priority: 'high',
      debounceMs: 1000
    });

    this.addRule({
      id: 'schema-inference',
      name: 'Schema Inference',
      description: 'Auto-name columns when table has blank headers',
      pattern: (events: UserActionEvent[], context: any): boolean => {
        const tableCreated = events.find(e => e.type === UserActionMonitor.ActionTypes.TABLE_CREATED);
        if (tableCreated) {
          return this.hasBlankHeaders(context, tableCreated.instanceId);
        }
        return false;
      },
      suggestionType: 'infer-column-names',
      scope: 'micro',
      modality: 'in-situ',
      priority: 'medium',
      debounceMs: 2000
    });

    this.addRule({
      id: 'batch-extraction',
      name: 'Batch List/Table Extraction',
      description: 'Extract all similar items when user drags second similar item',
      pattern: (events: UserActionEvent[]) => {
        const drags = events.filter(e => e.type === UserActionMonitor.ActionTypes.ITEM_DRAGGED_TO_CANVAS);
        return drags.length >= 2 && this.areItemsFromSameStructure(drags);
      },
      suggestionType: 'batch-extract-items',
      scope: 'micro',
      modality: 'in-situ',
      priority: 'high',
      debounceMs: 500
    });

    this.addRule({
      id: 'column-autocomplete',
      name: 'Row/Column Autocomplete',
      description: 'Suggest pattern completion when user fills at least two cells',
      pattern: (events: UserActionEvent[]) => {
        const edits = events.filter(e => e.type === UserActionMonitor.ActionTypes.CELL_EDITED);
        return edits.length >= 2 && this.isPatternEstablished(edits);
      },
      suggestionType: 'autocomplete-pattern',
      scope: 'micro',
      modality: 'in-situ',
      priority: 'high',
      debounceMs: 1500
    });

    this.addRule({
      id: 'table-cell-completion',
      name: 'Table Cell Completion Assistance',
      description: 'Suggest completing table when user adds content to multiple cells',
      pattern: (events: UserActionEvent[]) => {
        // Look for various types of cell editing actions
        const cellEdits = events.filter(e => 
          e.type === UserActionMonitor.ActionTypes.CELL_EDITED ||
          e.type === 'cell-edited' ||
          e.type === 'cell-content-added' ||
          e.type === 'text-appended' ||
          e.type === 'image-added' ||
          (e.context && (e.context.tableId || e.context.cellId)) ||
          (e.metadata && (e.metadata.column !== undefined || e.metadata.row !== undefined))
        );
        
        console.log('[TriggerEngine] Table cell completion check:', {
          totalEvents: events.length,
          cellEdits: cellEdits.length,
          recentEvents: events.slice(-10).map(e => ({ 
            type: e.type, 
            editType: e.metadata?.editType,
            column: e.metadata?.column,
            row: e.metadata?.row,
            tableId: e.context?.tableId,
            cellId: e.context?.cellId
          })),
          cellEditEvents: cellEdits.map(e => ({ 
            type: e.type, 
            editType: e.metadata?.editType,
            column: e.metadata?.column,
            row: e.metadata?.row,
            tableId: e.context?.tableId 
          }))
        });
        
        // Trigger after user has edited at least 2 cells in a table
        const hasEnoughEdits = cellEdits.length >= 2;
        const hasTableContext = cellEdits.some(edit => 
          edit.context?.tableId || 
          edit.context?.cellId ||
          edit.metadata?.column !== undefined ||
          edit.metadata?.row !== undefined
        );
        
        console.log('[TriggerEngine] Table completion pattern result:', { 
          hasEnoughEdits, 
          hasTableContext,
          shouldTrigger: hasEnoughEdits && hasTableContext
        });
        
        return hasEnoughEdits && hasTableContext;
      },
      suggestionType: 'autocomplete-pattern',
      scope: 'micro',
      modality: 'in-situ',
      priority: 'high',
      debounceMs: 1000
    });

    this.addRule({
      id: 'computed-columns',
      name: 'Computed/Derived Columns',
      description: 'Suggest computed columns when mathematical relationships exist',
      pattern: (events: UserActionEvent[], context: any): boolean => {
        const tableCreated = events.find(e => e.type === UserActionMonitor.ActionTypes.TABLE_CREATED);
        if (tableCreated) {
          return this.hasMathematicalRelationship(context, tableCreated.instanceId);
        }
        return false;
      },
      suggestionType: 'suggest-computed-column',
      scope: 'macro',
      modality: 'peripheral',
      priority: 'medium',
      debounceMs: 3000
    });

    this.addRule({
      id: 'table-joining',
      name: 'Joining Tables',
      description: 'Suggest joining tables when matching columns are detected',
      pattern: (_events: UserActionEvent[], context: any) => {
        return this.hasMultipleTablesWithMatchingColumns(context);
      },
      suggestionType: 'suggest-table-join',
      scope: 'macro',
      modality: 'peripheral',
      priority: 'medium',
      debounceMs: 2000
    });

    // Data Cleaning Rules
    this.addRule({
      id: 'entity-normalization',
      name: 'Entity Resolution & Normalization',
      description: 'Suggest batch normalization when user edits cells to be consistent',
      pattern: (events: UserActionEvent[]) => {
        const edits = events.filter(e => e.type === UserActionMonitor.ActionTypes.CELL_VALUE_NORMALIZED);
        return edits.length >= 2 && this.isSameColumnNormalization(edits);
      },
      suggestionType: 'batch-normalize-entities',
      scope: 'micro',
      modality: 'in-situ',
      priority: 'medium',
      debounceMs: 2000
    });

    this.addRule({
      id: 'remove-extraneous-chars',
      name: 'Remove Extraneous Characters',
      description: 'Suggest removing same characters from all cells when user removes from two cells',
      pattern: (events: UserActionEvent[]) => {
        const removals = events.filter(e => e.type === UserActionMonitor.ActionTypes.CELL_CONTENT_REMOVED);
        return removals.length >= 2 && this.isSameCharacterRemoval(removals);
      },
      suggestionType: 'batch-remove-characters',
      scope: 'micro',
      modality: 'in-situ',
      priority: 'high',
      debounceMs: 1500
    });

    this.addRule({
      id: 'data-type-correction',
      name: 'Data Type Correction',
      description: 'Suggest batch replacement when user deletes text values in numeric columns',
      pattern: (events: UserActionEvent[], context: any) => {
        const deletions = events.filter(e => e.type === UserActionMonitor.ActionTypes.DATA_TYPE_CORRECTED);
        return deletions.length >= 1 && this.isNumericColumnWithTextValues(context, deletions[0]);
      },
      suggestionType: 'batch-replace-non-numeric',
      scope: 'micro',
      modality: 'in-situ',
      priority: 'medium',
      debounceMs: 2000
    });

    // Data Modeling & Visualization Rules
    this.addRule({
      id: 'auto-generate-viz',
      name: 'Auto-generate Visualizations',
      description: 'Suggest visualizations when table has categorical and numerical columns',
      pattern: (events: UserActionEvent[], context: any): boolean => {
        const tableSelected = events.find(e => e.type === UserActionMonitor.ActionTypes.TABLE_SELECTED);
        if (tableSelected) {
          return this.hasVisualizableData(context, tableSelected.instanceId);
        }
        return false;
      },
      suggestionType: 'suggest-visualization',
      scope: 'macro',
      modality: 'peripheral',
      priority: 'low',
      debounceMs: 3000
    });

    this.addRule({
      id: 'suggest-alternative-charts',
      name: 'Suggest Alternative Charts',
      description: 'Suggest better chart types when user creates suboptimal visualizations',
      pattern: (events: UserActionEvent[], context: any): boolean => {
        const vizCreated = events.find(e => e.type === UserActionMonitor.ActionTypes.VISUALIZATION_CREATED);
        if (vizCreated) {
          return this.isSuboptimalVisualization(context, vizCreated.instanceId);
        }
        return false;
      },
      suggestionType: 'suggest-better-chart',
      scope: 'macro',
      modality: 'peripheral',
      priority: 'low',
      debounceMs: 5000
    });

    // New features implementation
    this.addRule({
      id: 'table-sorting-filtering',
      name: 'Table Sorting and Filtering',
      description: 'Suggest sorting or filtering operations when table has suitable data',
      pattern: (events: UserActionEvent[], context: any): boolean => {
        const tableInteraction = events.find(e => 
          e.type === UserActionMonitor.ActionTypes.TABLE_SELECTED || 
          e.type === UserActionMonitor.ActionTypes.CELL_EDITED
        );
        if (tableInteraction) {
          return this.hasFilterableOrSortableData(context, tableInteraction.instanceId);
        }
        return false;
      },
      suggestionType: 'suggest-sorting-filtering',
      scope: 'macro',
      modality: 'peripheral',
      priority: 'medium',
      debounceMs: 2000
    });

    this.addRule({
      id: 'fill-missing-values',
      name: 'Fill Missing Values',
      description: 'Suggest filling missing values when empty cells are detected in data patterns',
      pattern: (events: UserActionEvent[], context: any): boolean => {
        const tableEdited = events.find(e => e.type === UserActionMonitor.ActionTypes.CELL_EDITED);
        if (tableEdited) {
          return this.hasMissingValuesInPattern(context, tableEdited.instanceId);
        }
        return false;
      },
      suggestionType: 'suggest-fill-missing',
      scope: 'macro',
      modality: 'peripheral',
      priority: 'medium',
      debounceMs: 3000
    });

    this.addRule({
      id: 'interactive-filtering-highlighting',
      name: 'Interactive Filtering and Highlighting',
      description: 'Suggest interactive filtering when user selects data in visualizations',
      pattern: (events: UserActionEvent[], context: any): boolean => {
        const vizInteraction = events.find(e => 
          e.type === UserActionMonitor.ActionTypes.VISUALIZATION_CREATED ||
          e.type === UserActionMonitor.ActionTypes.TABLE_SELECTED
        );
        if (vizInteraction) {
          return this.hasLinkedDataForFiltering(context, vizInteraction.instanceId);
        }
        return false;
      },
      suggestionType: 'suggest-interactive-filtering',
      scope: 'macro',
      modality: 'peripheral',
      priority: 'low',
      debounceMs: 2000
    });

    this.addRule({
      id: 'suggest-useful-websites',
      name: 'Suggest Useful Websites',
      description: 'Suggest relevant websites when user creates or renames workspace',
      pattern: (events: UserActionEvent[], context: any): boolean => {
        // Only trigger if the VERY LATEST interaction is workspace creation/naming
        // Don't trigger if user has moved on to other tasks like table editing
        const recentEvents = events.slice(-3); // Check only last 3 events for stricter recency
        const latestEvent = recentEvents[recentEvents.length - 1]; // Most recent event
        
        const isLatestEventWorkspaceRelated = latestEvent && (
          latestEvent.type === 'workspace-titled' || 
          latestEvent.type === 'workspace-renamed' || 
          latestEvent.type === 'workspace-created'
        );
        
        // Must have a workspace name to suggest relevant websites
        const hasWorkspaceName = context.workspaceName && context.workspaceName.trim().length > 0;
        
        console.log('[TriggerEngine] Website suggestion check:', {
          latestEvent: latestEvent?.type,
          isLatestEventWorkspaceRelated,
          hasWorkspaceName,
          workspaceName: context.workspaceName,
          recentEventTypes: recentEvents.map(e => e.type)
        });
        
        // Only trigger when LATEST interaction is workspace-related AND we have a name
        return isLatestEventWorkspaceRelated && hasWorkspaceName;
      },
      suggestionType: 'suggest-websites',
      scope: 'macro',
      modality: 'peripheral',
      priority: 'medium',
      debounceMs: 3000
    });
  }

  /**
   * Add a new trigger rule
   */
  addRule(rule: SuggestionTriggerRule) {
    this.rules.push(rule);
  }

  /**
   * Remove a trigger rule
   */
  removeRule(ruleId: string) {
    this.rules = this.rules.filter(rule => rule.id !== ruleId);
  }

  /**
   * Check if any rules are triggered by recent events
   */
  checkTriggers(context: any): SuggestionTriggerRule[] {
    const recentEvents = actionMonitor.getLastNActions(10); // Look at last 10 user interactions
    const triggeredRules: SuggestionTriggerRule[] = [];

    console.log('[TriggerEngine] Checking', this.rules.length, 'rules against', recentEvents.length, 'recent events:', recentEvents);

    for (const rule of this.rules) {
      try {
        // console.log('[TriggerEngine] Checking rule:', rule.id);
        if (rule.pattern(recentEvents, context)) {
          console.log('[TriggerEngine] Rule triggered:', rule.id);
          
          // Handle debouncing - but return immediately triggered rules for high priority suggestions
          if (rule.debounceMs && rule.priority !== 'high') {
            const existingTimeout = this.pendingTriggers.get(rule.id);
            if (existingTimeout) {
              clearTimeout(existingTimeout);
            }

            // For debounced rules, trigger callback after delay
            const timeout = setTimeout(() => {
              this.pendingTriggers.delete(rule.id);
              // Trigger suggestion generation via callback
              this.onDebouncedRuleTrigger?.(rule);
            }, rule.debounceMs);

            this.pendingTriggers.set(rule.id, timeout);
            console.log('[TriggerEngine] Rule debounced for', rule.debounceMs, 'ms');
          } else {
            // Return immediately for high priority or non-debounced rules
            triggeredRules.push(rule);
            console.log('[TriggerEngine] Rule added immediately (high priority or no debounce)');
          }
        }
      } catch (error) {
        console.error(`Error checking trigger rule ${rule.id}:`, error);
      }
    }

    console.log('[TriggerEngine] Returning', triggeredRules.length, 'triggered rules');
    return triggeredRules;
  }

  /**
   * Get all available rules
   */
  getAllRules(): SuggestionTriggerRule[] {
    return [...this.rules];
  }

  // Helper methods for pattern matching
  private areElementsSimilar(selections: UserActionEvent[]): boolean {
    // Check if selected elements have similar selectors or are structural siblings
    if (selections.length < 2) {
      console.log('[TriggerEngine] Not enough selections for similarity check:', selections.length);
      return false;
    }
    
    const first = selections[selections.length - 2];
    const second = selections[selections.length - 1];
    
    console.log('[TriggerEngine] Checking similarity between:', {
      first: { pageId: first.context?.pageId, selector: first.context?.selector },
      second: { pageId: second.context?.pageId, selector: second.context?.selector }
    });
    
    // Simple heuristic: check if elements are from the same page and have similar structure
    const isSimilar = first.context?.pageId === second.context?.pageId &&
                     first.context?.selector?.split(' ').length === second.context?.selector?.split(' ').length;
    
    console.log('[TriggerEngine] Elements similar?', isSimilar);
    return isSimilar;
  }

  private hasBlankHeaders(context: any, tableId?: string): boolean {
    if (!tableId || !context.instances) return false;
    
    const table = context.instances.find((i: any) => i.id === tableId && i.type === 'table');
    if (!table) return false;
    
    return !table.columnNames || table.columnNames.every((name: string) => !name || name.startsWith('Column '));
  }

  private areItemsFromSameStructure(drags: UserActionEvent[]): boolean {
    if (drags.length < 2) return false;
    
    const first = drags[drags.length - 2];
    const second = drags[drags.length - 1];
    
    // Check if items are from the same list or table structure
    return first.context?.parentSelector === second.context?.parentSelector;
  }

  private isPatternEstablished(edits: UserActionEvent[]): boolean {
    if (edits.length < 2) return false;
    
    // Check if edits are in the same column and establish a pattern
    const recentEdits = edits.slice(-3); // Look at last 3 edits
    const sameColumn = recentEdits.every(edit => 
      edit.metadata?.column === recentEdits[0].metadata?.column
    );
    
    return sameColumn && this.detectEditPattern(recentEdits);
  }

  private detectEditPattern(edits: UserActionEvent[]): boolean {
    // Simple pattern detection - could be enhanced
    return edits.length >= 2 && edits[0].context?.value !== edits[1].context?.value;
  }

  private hasMathematicalRelationship(context: any, tableId?: string): boolean {
    if (!tableId || !context.instances) return false;
    
    const table = context.instances.find((i: any) => i.id === tableId && i.type === 'table');
    if (!table || !table.columnTypes) return false;
    
    const numericalColumns = table.columnTypes.filter((type: string) => type === 'numeral').length;
    return numericalColumns >= 2;
  }

  private hasMultipleTablesWithMatchingColumns(context: any): boolean {
    if (!context.instances) return false;
    
    const tables = context.instances.filter((i: any) => i.type === 'table');
    if (tables.length < 2) return false;
    
    // Simple heuristic: check if any two tables have columns with similar names
    for (let i = 0; i < tables.length; i++) {
      for (let j = i + 1; j < tables.length; j++) {
        if (this.tablesHaveMatchingColumns(tables[i], tables[j])) {
          return true;
        }
      }
    }
    
    return false;
  }

  private tablesHaveMatchingColumns(table1: any, table2: any): boolean {
    if (!table1.columnNames || !table2.columnNames) return false;
    
    const names1 = table1.columnNames.map((n: string) => n.toLowerCase());
    const names2 = table2.columnNames.map((n: string) => n.toLowerCase());
    
    return names1.some((name: string) => names2.includes(name));
  }

  private isSameColumnNormalization(edits: UserActionEvent[]): boolean {
    if (edits.length < 2) return false;
    
    return edits.every(edit => 
      edit.metadata?.column === edits[0].metadata?.column &&
      edit.metadata?.normalizationType === edits[0].metadata?.normalizationType
    );
  }

  private isSameCharacterRemoval(removals: UserActionEvent[]): boolean {
    if (removals.length < 2) return false;
    
    const removedChars1 = removals[removals.length - 2].metadata?.removedCharacters;
    const removedChars2 = removals[removals.length - 1].metadata?.removedCharacters;
    
    return removedChars1 === removedChars2 && removedChars1;
  }

  private isNumericColumnWithTextValues(context: any, deletion: UserActionEvent): boolean {
    const tableId = deletion.context?.tableId;
    const column = deletion.metadata?.column;
    
    if (!tableId || column === undefined || !context.instances) return false;
    
    const table = context.instances.find((i: any) => i.id === tableId && i.type === 'table');
    if (!table) return false;
    
    return table.columnTypes?.[column] === 'numeral';
  }

  private hasVisualizableData(context: any, tableId?: string): boolean {
    if (!tableId || !context.instances) return false;
    
    const table = context.instances.find((i: any) => i.id === tableId && i.type === 'table');
    if (!table || !table.columnTypes) return false;
    
    const hasCategorical = table.columnTypes.includes('categorical');
    const hasNumerical = table.columnTypes.includes('numeral');
    
    return hasCategorical && hasNumerical;
  }

  private isSuboptimalVisualization(context: any, vizId?: string): boolean {
    if (!vizId || !context.instances) return false;
    
    const viz = context.instances.find((i: any) => i.id === vizId && i.type === 'visualization');
    if (!viz) return false;
    
    // Simple heuristic: pie charts with too many slices are suboptimal
    return viz.chartType === 'pie' && viz.dataPoints > 10;
  }

  private hasFilterableOrSortableData(context: any, tableId?: string): boolean {
    if (!tableId || !context.instances) return false;
    
    const table = context.instances.find((i: any) => i.id === tableId && i.type === 'table');
    if (!table || !table.cells) return false;
    
    // Check if table has enough data and mixed content types for sorting/filtering
    const rowCount = table.cells.length;
    const hasEnoughData = rowCount > 3;
    const hasVariedContent = this.hasVariedColumnContent(table);
    
    return hasEnoughData && hasVariedContent;
  }

  private hasVariedColumnContent(table: any): boolean {
    if (!table.cells || table.cells.length < 2) return false;
    
    // Check each column for variety in values
    for (let col = 0; col < table.cols; col++) {
      const columnValues = new Set();
      for (let row = 0; row < table.rows; row++) {
        const cell = table.cells[row]?.[col];
        if (cell && cell.content) {
          columnValues.add(cell.content.toLowerCase().trim());
        }
      }
      // If any column has variety (more than 1 unique value), it's filterable/sortable
      if (columnValues.size > 1) {
        return true;
      }
    }
    return false;
  }

  private hasMissingValuesInPattern(context: any, tableId?: string): boolean {
    if (!tableId || !context.instances) return false;
    
    const table = context.instances.find((i: any) => i.id === tableId && i.type === 'table');
    if (!table || !table.cells) return false;
    
    // Check for empty cells that could be filled based on patterns
    let emptyCount = 0;
    let totalCells = 0;
    
    for (let row = 0; row < table.rows; row++) {
      for (let col = 0; col < table.cols; col++) {
        totalCells++;
        const cell = table.cells[row]?.[col];
        if (!cell || !cell.content || cell.content.trim() === '') {
          emptyCount++;
        }
      }
    }
    
    // Suggest filling missing values if there's a reasonable amount of missing data
    const missingPercentage = emptyCount / totalCells;
    return missingPercentage > 0.1 && missingPercentage < 0.8; // Between 10% and 80% missing
  }

  private hasLinkedDataForFiltering(context: any, instanceId?: string): boolean {
    if (!instanceId || !context.instances) return false;
    
    const instances = context.instances;
    const tables = instances.filter((i: any) => i.type === 'table');
    const visualizations = instances.filter((i: any) => i.type === 'visualization');
    
    // Suggest interactive filtering if we have both tables and visualizations
    return tables.length > 0 && visualizations.length > 0;
  }

  /**
   * Cleanup pending triggers
   */
  destroy() {
    for (const timeout of this.pendingTriggers.values()) {
      clearTimeout(timeout);
    }
    this.pendingTriggers.clear();
  }
}

// Export singleton instance
export const triggerEngine = new TriggerEngine();
export default triggerEngine;