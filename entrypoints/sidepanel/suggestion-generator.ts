/**
 * SuggestionGenerator - Generates AI suggestions with priority and confidence scoring
 * Part of the enhanced proactive suggestion system
 */

import { 
  ProactiveSuggestion, 
  SuggestionTriggerRule, 
  SuggestionScope, 
  PresentationModality, 
  SuggestionPriority,
  InstanceEvent,
  UserActionEvent
} from './types';
import { actionMonitor } from './action-monitor';
import { triggerEngine } from './trigger-engine';

export class SuggestionGenerator {
  private suggestionId = 0;

  /**
   * Generate suggestions based on triggered rules
   */
  async generateSuggestions(
    triggeredRules: SuggestionTriggerRule[],
    context: any
  ): Promise<ProactiveSuggestion[]> {
    const suggestions: ProactiveSuggestion[] = [];
    const recentEvents = actionMonitor.getRecentActions(30000);

    for (const rule of triggeredRules) {
      try {
        const suggestion = await this.createSuggestionFromRule(rule, recentEvents, context);
        if (suggestion) {
          suggestions.push(suggestion);
        }
      } catch (error) {
        console.error(`Error generating suggestion for rule ${rule.id}:`, error);
      }
    }

    // Sort by priority and confidence
    return this.prioritizeSuggestions(suggestions);
  }

  /**
   * Create a specific suggestion from a triggered rule
   */
  private async createSuggestionFromRule(
    rule: SuggestionTriggerRule,
    recentEvents: UserActionEvent[],
    context: any
  ): Promise<ProactiveSuggestion | null> {
    const suggestionId = `suggestion-${++this.suggestionId}-${Date.now()}`;
    
    // Generate suggestion based on rule type
    switch (rule.suggestionType) {
      case 'batch-select-elements':
        return this.createBatchSelectSuggestion(suggestionId, rule, recentEvents, context);
      
      case 'infer-column-names':
        return this.createColumnNamingSuggestion(suggestionId, rule, recentEvents, context);
      
      case 'batch-extract-items':
        return this.createBatchExtractionSuggestion(suggestionId, rule, recentEvents, context);
      
      case 'autocomplete-pattern':
        return this.createAutocompleteSuggestion(suggestionId, rule, recentEvents, context);
      
      case 'suggest-computed-column':
        return this.createComputedColumnSuggestion(suggestionId, rule, recentEvents, context);
      
      case 'suggest-table-join':
        return this.createTableJoinSuggestion(suggestionId, rule, recentEvents, context);
      
      case 'batch-normalize-entities':
        return this.createEntityNormalizationSuggestion(suggestionId, rule, recentEvents, context);
      
      case 'batch-remove-characters':
        return this.createCharacterRemovalSuggestion(suggestionId, rule, recentEvents, context);
      
      case 'batch-replace-non-numeric':
        return this.createDataTypeCorrectSuggestion(suggestionId, rule, recentEvents, context);
      
      case 'suggest-visualization':
        return this.createVisualizationSuggestion(suggestionId, rule, recentEvents, context);
      
      case 'suggest-better-chart':
        return this.createBetterChartSuggestion(suggestionId, rule, recentEvents, context);
      
      case 'suggest-sorting-filtering':
        return this.createSortingFilteringSuggestion(suggestionId, rule, recentEvents, context);
      
      case 'suggest-fill-missing':
        return this.createFillMissingSuggestion(suggestionId, rule, recentEvents, context);
      
      case 'suggest-interactive-filtering':
        return this.createInteractiveFilteringSuggestion(suggestionId, rule, recentEvents, context);
      
      case 'suggest-websites':
        return this.createWebsiteSuggestion(suggestionId, rule, recentEvents, context);
      
      default:
        console.warn(`Unknown suggestion type: ${rule.suggestionType}`);
        return null;
    }
  }

  /**
   * Prioritize suggestions based on priority level, confidence, and recency
   */
  private prioritizeSuggestions(suggestions: ProactiveSuggestion[]): ProactiveSuggestion[] {
    const priorityWeight = { high: 3, medium: 2, low: 1 };
    
    return suggestions
      .sort((a, b) => {
        // First sort by priority
        const priorityDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
        if (priorityDiff !== 0) return priorityDiff;
        
        // Then by confidence
        const confidenceDiff = b.confidence - a.confidence;
        if (Math.abs(confidenceDiff) > 0.1) return confidenceDiff;
        
        // Finally by recency (newer first)
        return b.timestamp - a.timestamp;
      })
      .slice(0, 3); // Return top 3 suggestions as per design document
  }

  // Specific suggestion creators

  private createBatchSelectSuggestion(
    id: string,
    rule: SuggestionTriggerRule,
    events: UserActionEvent[],
    context: any
  ): ProactiveSuggestion {
    const selections = events.filter(e => e.type === 'element-selected');
    const elementCount = this.estimateElementCount(selections, context);
    
    return {
      id,
      message: `Select all ${elementCount} similar elements`,
      detailedDescription: `Automatically select ${elementCount} elements with similar structure based on your current selection pattern`,
      instances: [], // Would contain the batch selection operations
      scope: rule.scope,
      modality: rule.modality,
      priority: rule.priority,
      confidence: 0.85,
      contextualData: { elementCount, selections },
      triggerEvent: 'element-selected',
      estimatedImpact: `${elementCount} elements selected`,
      category: 'data-extraction',
      timestamp: Date.now(),
      undoable: true
    };
  }

  private createColumnNamingSuggestion(
    id: string,
    rule: SuggestionTriggerRule,
    events: UserActionEvent[],
    context: any
  ): ProactiveSuggestion {
    const tableEvent = events.find(e => e.type === 'table-created');
    const suggestedNames = this.inferColumnNames(context, tableEvent?.instanceId);
    
    return {
      id,
      message: 'Name table columns automatically',
      detailedDescription: `Suggest meaningful column names: ${suggestedNames.join(', ')}`,
      instances: [], // Would contain column header updates
      scope: rule.scope,
      modality: rule.modality,
      priority: rule.priority,
      confidence: 0.75,
      contextualData: { suggestedNames, tableId: tableEvent?.instanceId },
      triggerEvent: 'table-created',
      estimatedImpact: `${suggestedNames.length} columns named`,
      category: 'data-extraction',
      timestamp: Date.now(),
      undoable: true
    };
  }

  private createBatchExtractionSuggestion(
    id: string,
    rule: SuggestionTriggerRule,
    events: UserActionEvent[],
    context: any
  ): ProactiveSuggestion {
    const drags = events.filter(e => e.type === 'item-dragged-to-canvas');
    const itemCount = this.estimateSimilarItems(drags, context);
    
    return {
      id,
      message: `Extract ${itemCount} similar items`,
      detailedDescription: `Automatically extract all ${itemCount} items from the same structure`,
      instances: [], // Would contain batch extraction operations
      scope: rule.scope,
      modality: rule.modality,
      priority: rule.priority,
      confidence: 0.9,
      contextualData: { itemCount, drags },
      triggerEvent: 'item-dragged-to-canvas',
      estimatedImpact: `${itemCount} items extracted`,
      category: 'data-extraction',
      timestamp: Date.now(),
      undoable: true
    };
  }

  private createAutocompleteSuggestion(
    id: string,
    rule: SuggestionTriggerRule,
    events: UserActionEvent[],
    context: any
  ): ProactiveSuggestion | null {
    // Disable autocomplete pattern suggestions - handled by AI system instead
    console.log('[SuggestionGenerator] Autocomplete pattern suggestions disabled - using AI-driven suggestions instead');
    return null;
  }

  private createComputedColumnSuggestion(
    id: string,
    rule: SuggestionTriggerRule,
    events: UserActionEvent[],
    context: any
  ): ProactiveSuggestion {
    const tableEvent = events.find(e => e.type === 'table-created');
    const computations = this.suggestComputations(context, tableEvent?.instanceId);
    
    return {
      id,
      message: 'Add computed columns',
      detailedDescription: `Suggested computations: ${computations.join(', ')}`,
      instances: [], // Would contain new column additions
      scope: rule.scope,
      modality: rule.modality,
      priority: rule.priority,
      confidence: 0.7,
      contextualData: { computations, tableId: tableEvent?.instanceId },
      triggerEvent: 'table-created',
      estimatedImpact: `${computations.length} computed columns`,
      category: 'data-wrangling',
      timestamp: Date.now(),
      undoable: true
    };
  }

  private createTableJoinSuggestion(
    id: string,
    rule: SuggestionTriggerRule,
    events: UserActionEvent[],
    context: any
  ): ProactiveSuggestion {
    const joinCandidates = this.findJoinCandidates(context);
    
    return {
      id,
      message: 'Join related tables',
      detailedDescription: `Join tables on matching columns: ${joinCandidates.map(j => j.column).join(', ')}`,
      instances: [], // Would contain table merge operations
      scope: rule.scope,
      modality: rule.modality,
      priority: rule.priority,
      confidence: 0.75,
      contextualData: { joinCandidates },
      triggerEvent: 'multiple-tables-detected',
      estimatedImpact: `${joinCandidates.length} table joins`,
      category: 'data-wrangling',
      timestamp: Date.now(),
      undoable: true
    };
  }

  private createEntityNormalizationSuggestion(
    id: string,
    rule: SuggestionTriggerRule,
    events: UserActionEvent[],
    context: any
  ): ProactiveSuggestion {
    const normalizations = events.filter(e => e.type === 'cell-value-normalized');
    const affectedCells = this.estimateNormalizationCells(normalizations, context);
    
    return {
      id,
      message: `Normalize ${affectedCells} similar values`,
      detailedDescription: `Apply same normalization to all similar values in column`,
      instances: [], // Would contain cell value normalizations
      scope: rule.scope,
      modality: rule.modality,
      priority: rule.priority,
      confidence: 0.85,
      contextualData: { affectedCells, normalizations },
      triggerEvent: 'cell-value-normalized',
      estimatedImpact: `${affectedCells} values normalized`,
      category: 'data-cleaning',
      timestamp: Date.now(),
      undoable: true
    };
  }

  private createCharacterRemovalSuggestion(
    id: string,
    rule: SuggestionTriggerRule,
    events: UserActionEvent[],
    context: any
  ): ProactiveSuggestion {
    const removals = events.filter(e => e.type === 'cell-content-removed');
    const charactersToRemove = removals[0]?.metadata?.removedCharacters || '';
    const affectedCells = this.estimateCharacterRemovalCells(removals, context);
    
    return {
      id,
      message: `Remove "${charactersToRemove}" from ${affectedCells} cells`,
      detailedDescription: `Remove the same characters from all similar cells`,
      instances: [], // Would contain cell content updates
      scope: rule.scope,
      modality: rule.modality,
      priority: rule.priority,
      confidence: 0.9,
      contextualData: { charactersToRemove, affectedCells },
      triggerEvent: 'cell-content-removed',
      estimatedImpact: `${affectedCells} cells cleaned`,
      category: 'data-cleaning',
      timestamp: Date.now(),
      undoable: true
    };
  }

  private createDataTypeCorrectSuggestion(
    id: string,
    rule: SuggestionTriggerRule,
    events: UserActionEvent[],
    context: any
  ): ProactiveSuggestion {
    const corrections = events.filter(e => e.type === 'data-type-corrected');
    const affectedCells = this.estimateDataTypeCorrections(corrections, context);
    
    return {
      id,
      message: `Fix ${affectedCells} non-numeric values`,
      detailedDescription: `Replace text values with null or convert to numbers`,
      instances: [], // Would contain data type corrections
      scope: rule.scope,
      modality: rule.modality,
      priority: rule.priority,
      confidence: 0.8,
      contextualData: { affectedCells, corrections },
      triggerEvent: 'data-type-corrected',
      estimatedImpact: `${affectedCells} values corrected`,
      category: 'data-cleaning',
      timestamp: Date.now(),
      undoable: true
    };
  }

  private createVisualizationSuggestion(
    id: string,
    rule: SuggestionTriggerRule,
    events: UserActionEvent[],
    context: any
  ): ProactiveSuggestion {
    const tableEvent = events.find(e => e.type === 'table-selected');
    const chartTypes = this.suggestChartTypes(context, tableEvent?.instanceId);
    
    return {
      id,
      message: 'Create visualizations',
      detailedDescription: `Suggested chart types: ${chartTypes.join(', ')}`,
      instances: [], // Would contain new visualization instances
      scope: rule.scope,
      modality: rule.modality,
      priority: rule.priority,
      confidence: 0.7,
      contextualData: { chartTypes, tableId: tableEvent?.instanceId },
      triggerEvent: 'table-selected',
      estimatedImpact: `${chartTypes.length} visualizations`,
      category: 'data-modeling',
      timestamp: Date.now(),
      undoable: true
    };
  }

  private createBetterChartSuggestion(
    id: string,
    rule: SuggestionTriggerRule,
    events: UserActionEvent[],
    context: any
  ): ProactiveSuggestion {
    const vizEvent = events.find(e => e.type === 'visualization-created');
    const betterCharts = this.suggestBetterCharts(context, vizEvent?.instanceId);
    
    return {
      id,
      message: `Try ${betterCharts[0]} instead`,
      detailedDescription: `Better chart options: ${betterCharts.join(', ')}`,
      instances: [], // Would contain chart type updates
      scope: rule.scope,
      modality: rule.modality,
      priority: rule.priority,
      confidence: 0.6,
      contextualData: { betterCharts, vizId: vizEvent?.instanceId },
      triggerEvent: 'visualization-created',
      estimatedImpact: 'Improved visualization',
      category: 'data-modeling',
      timestamp: Date.now(),
      undoable: true
    };
  }

  // Helper methods for estimations and pattern detection

  private estimateElementCount(selections: UserActionEvent[], context: any): number {
    // Simple heuristic - could be enhanced with actual DOM analysis
    return Math.floor(Math.random() * 20) + 5; // 5-25 elements
  }

  private inferColumnNames(context: any, tableId?: string): string[] {
    // Simple heuristic - could use AI to infer from data
    return ['Name', 'Value', 'Category', 'Date'];
  }

  private estimateSimilarItems(drags: UserActionEvent[], context: any): number {
    return Math.floor(Math.random() * 50) + 10; // 10-60 items
  }

  private detectPattern(edits: UserActionEvent[]): string {
    // Simple pattern detection
    return 'Sequential numbering';
  }

  private estimateCellsToFill(edits: UserActionEvent[], context: any): number {
    return Math.floor(Math.random() * 15) + 5; // 5-20 cells
  }

  private suggestComputations(context: any, tableId?: string): string[] {
    return ['Sum', 'Average', 'Percentage'];
  }

  private findJoinCandidates(context: any): Array<{ column: string; table1: string; table2: string }> {
    return [{ column: 'ID', table1: 'Table1', table2: 'Table2' }];
  }

  private estimateNormalizationCells(normalizations: UserActionEvent[], context: any): number {
    return Math.floor(Math.random() * 10) + 3; // 3-13 cells
  }

  private estimateCharacterRemovalCells(removals: UserActionEvent[], context: any): number {
    return Math.floor(Math.random() * 20) + 5; // 5-25 cells
  }

  private estimateDataTypeCorrections(corrections: UserActionEvent[], context: any): number {
    return Math.floor(Math.random() * 8) + 2; // 2-10 values
  }

  private suggestChartTypes(context: any, tableId?: string): string[] {
    return ['Bar Chart', 'Line Chart', 'Scatter Plot'];
  }

  private suggestBetterCharts(context: any, vizId?: string): string[] {
    return ['Bar Chart', 'Histogram'];
  }

  private createSortingFilteringSuggestion(
    id: string,
    rule: SuggestionTriggerRule,
    events: UserActionEvent[],
    context: any
  ): ProactiveSuggestion {
    return {
      id,
      message: `Add sorting and filtering controls to table`,
      detailedDescription: `Enable users to sort columns and filter data in the current table for better data exploration`,
      instances: [], // Would contain table enhancement operations
      scope: rule.scope,
      modality: rule.modality,
      priority: rule.priority,
      confidence: 0.75,
      category: 'data-organization',
      timestamp: Date.now(),
      undoable: true
    };
  }

  private createFillMissingSuggestion(
    id: string,
    rule: SuggestionTriggerRule,
    events: UserActionEvent[],
    context: any
  ): ProactiveSuggestion {
    return {
      id,
      message: `Fill missing values using data patterns`,
      detailedDescription: `Automatically fill empty cells based on detected patterns in surrounding data`,
      instances: [], // Would contain missing value imputation operations
      scope: rule.scope,
      modality: rule.modality,
      priority: rule.priority,
      confidence: 0.70,
      category: 'data-completion',
      timestamp: Date.now(),
      undoable: true
    };
  }

  private createInteractiveFilteringSuggestion(
    id: string,
    rule: SuggestionTriggerRule,
    events: UserActionEvent[],
    context: any
  ): ProactiveSuggestion {
    return {
      id,
      message: `Enable interactive filtering between tables and visualizations`,
      detailedDescription: `Create linked filtering where selections in one view filter data in related views`,
      instances: [], // Would contain interactive filtering setup operations
      scope: rule.scope,
      modality: rule.modality,
      priority: rule.priority,
      confidence: 0.65,
      category: 'data-interaction',
      timestamp: Date.now(),
      undoable: true
    };
  }

  private createWebsiteSuggestion(
    id: string,
    rule: SuggestionTriggerRule,
    events: UserActionEvent[],
    context: any
  ): ProactiveSuggestion {
    const workspaceName = context.workspaceName || 'your project';
    return {
      id,
      message: `Discover relevant websites for "${workspaceName}"`,
      detailedDescription: `Find authoritative data sources and research websites related to your current workspace topic`,
      instances: [], // Would contain website recommendation operations
      scope: rule.scope,
      modality: rule.modality,
      priority: rule.priority,
      confidence: 0.80,
      category: 'resource-discovery',
      timestamp: Date.now(),
      undoable: false // Website suggestions don't need undo
    };
  }
}

// Export singleton instance
export const suggestionGenerator = new SuggestionGenerator();
export default suggestionGenerator;