/**
 * UserActionMonitor - Captures and categorizes user interactions
 * Part of the enhanced proactive suggestion system
 */

import { UserActionEvent } from './types';

export class UserActionMonitor {
  private actionHistory: UserActionEvent[] = [];
  private listeners: ((event: UserActionEvent) => void)[] = [];
  private maxHistorySize: number = 100;

  constructor(maxHistorySize: number = 100) {
    this.maxHistorySize = maxHistorySize;
  }

  /**
   * Record a user action
   */
  recordAction(type: string, context: any, instanceId?: string, metadata?: any) {
    const event: UserActionEvent = {
      type,
      timestamp: Date.now(),
      context,
      instanceId,
      metadata
    };

    // Add to history
    this.actionHistory.push(event);
    
    // Trim history if needed
    if (this.actionHistory.length > this.maxHistorySize) {
      this.actionHistory = this.actionHistory.slice(-this.maxHistorySize);
    }

    // Notify listeners
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in action monitor listener:', error);
      }
    });
  }

  /**
   * Subscribe to action events
   */
  subscribe(listener: (event: UserActionEvent) => void): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Get recent actions within a time window
   */
  getRecentActions(windowMs: number = 10000): UserActionEvent[] {
    const cutoff = Date.now() - windowMs;
    return this.actionHistory.filter(action => action.timestamp >= cutoff);
  }

  /**
   * Get the last N actions by count
   */
  getLastNActions(count: number = 10): UserActionEvent[] {
    return this.actionHistory.slice(-count);
  }

  /**
   * Get actions by type
   */
  getActionsByType(type: string, windowMs?: number): UserActionEvent[] {
    const actions = windowMs ? this.getRecentActions(windowMs) : this.actionHistory;
    return actions.filter(action => action.type === type);
  }

  /**
   * Get all actions for a specific instance
   */
  getActionsForInstance(instanceId: string, windowMs?: number): UserActionEvent[] {
    const actions = windowMs ? this.getRecentActions(windowMs) : this.actionHistory;
    return actions.filter(action => action.instanceId === instanceId);
  }

  /**
   * Check if there's a pattern of similar actions
   */
  hasRepeatedPattern(type: string, minCount: number = 2, windowMs: number = 30000): boolean {
    const recentActions = this.getActionsByType(type, windowMs);
    return recentActions.length >= minCount;
  }

  /**
   * Get the last action of a specific type
   */
  getLastAction(type?: string): UserActionEvent | null {
    if (!type) {
      return this.actionHistory.length > 0 ? this.actionHistory[this.actionHistory.length - 1] : null;
    }
    
    for (let i = this.actionHistory.length - 1; i >= 0; i--) {
      if (this.actionHistory[i].type === type) {
        return this.actionHistory[i];
      }
    }
    return null;
  }

  /**
   * Clear action history
   */
  clearHistory() {
    this.actionHistory = [];
  }

  /**
   * Get full action history
   */
  getHistory(): UserActionEvent[] {
    return [...this.actionHistory];
  }

  // Predefined action types for consistency
  static readonly ActionTypes = {
    // Data extraction actions
    ELEMENT_SELECTED: 'element-selected',
    ELEMENT_BATCH_SELECTED: 'element-batch-selected',
    ITEM_DRAGGED_TO_CANVAS: 'item-dragged-to-canvas',
    
    // Table actions
    TABLE_CREATED: 'table-created',
    TABLE_SELECTED: 'table-selected',
    CELL_EDITED: 'cell-edited',
    COLUMN_ADDED: 'column-added',
    ROW_ADDED: 'row-added',
    COLUMN_HEADER_EDITED: 'column-header-edited',
    
    // Data cleaning actions
    CELL_VALUE_NORMALIZED: 'cell-value-normalized',
    CELL_CONTENT_REMOVED: 'cell-content-removed',
    DATA_TYPE_CORRECTED: 'data-type-corrected',
    
    // Visualization actions
    VISUALIZATION_CREATED: 'visualization-created',
    CHART_TYPE_CHANGED: 'chart-type-changed',
    
    // General workspace actions
    INSTANCE_CREATED: 'instance-created',
    INSTANCE_DELETED: 'instance-deleted',
    INSTANCE_MOVED: 'instance-moved',
    MULTIPLE_INSTANCES_SELECTED: 'multiple-instances-selected',
    
    // User interface actions
    TOOL_SWITCHED: 'tool-switched',
    VIEW_CHANGED: 'view-changed',
    WORKSPACE_TITLED: 'workspace-titled'
  } as const;
}

// Export singleton instance
export const actionMonitor = new UserActionMonitor();
export default actionMonitor;