/**
 * SuggestionUndoManager - Manages undo/redo functionality for AI suggestions
 * Part of the enhanced proactive suggestion system
 */

import { ProactiveSuggestion, InstanceEvent, Instance } from './types';

interface UndoableAction {
  id: string;
  suggestionId: string;
  type: 'suggestion-applied';
  timestamp: number;
  description: string;
  forwardOperations: InstanceEvent[]; // Operations that were applied
  reverseOperations: InstanceEvent[]; // Operations to undo the changes
  context: any; // Additional context for the action
}

export class SuggestionUndoManager {
  private undoStack: UndoableAction[] = [];
  private redoStack: UndoableAction[] = [];
  private maxStackSize: number = 50;
  private actionId: number = 0;

  /**
   * Record a suggestion application as an undoable action
   */
  recordSuggestionApplication(
    suggestion: ProactiveSuggestion,
    appliedOperations: InstanceEvent[],
    previousState: Instance[],
    currentState: Instance[]
  ): string {
    if (!suggestion.undoable) {
      console.warn(`Suggestion ${suggestion.id} is marked as non-undoable`);
      return '';
    }

    const actionId = `undo-${++this.actionId}-${Date.now()}`;
    
    // Calculate reverse operations by comparing states
    const reverseOperations = this.calculateReverseOperations(
      previousState,
      currentState,
      appliedOperations
    );

    const action: UndoableAction = {
      id: actionId,
      suggestionId: suggestion.id,
      type: 'suggestion-applied',
      timestamp: Date.now(),
      description: `Applied: ${suggestion.message}`,
      forwardOperations: [...appliedOperations],
      reverseOperations,
      context: {
        category: suggestion.category,
        scope: suggestion.scope,
        modality: suggestion.modality,
        estimatedImpact: suggestion.estimatedImpact
      }
    };

    // Add to undo stack
    this.undoStack.push(action);
    
    // Clear redo stack (new action invalidates redo history)
    this.redoStack = [];
    
    // Trim stack if needed
    if (this.undoStack.length > this.maxStackSize) {
      this.undoStack = this.undoStack.slice(-this.maxStackSize);
    }

    // Dispatch event for UI updates
    this.dispatchUndoStackChanged();

    return actionId;
  }

  /**
   * Undo the last action
   */
  undo(): UndoableAction | null {
    if (this.undoStack.length === 0) {
      return null;
    }

    const action = this.undoStack.pop()!;
    
    // Apply reverse operations
    try {
      this.applyOperations(action.reverseOperations);
      
      // Move to redo stack
      this.redoStack.push(action);
      
      // Dispatch events
      this.dispatchUndoStackChanged();
      this.dispatchActionUndone(action);
      
      return action;
    } catch (error) {
      // If undo fails, put the action back
      this.undoStack.push(action);
      console.error('Failed to undo action:', error);
      throw error;
    }
  }

  /**
   * Redo the last undone action
   */
  redo(): UndoableAction | null {
    if (this.redoStack.length === 0) {
      return null;
    }

    const action = this.redoStack.pop()!;
    
    // Apply forward operations
    try {
      this.applyOperations(action.forwardOperations);
      
      // Move back to undo stack
      this.undoStack.push(action);
      
      // Dispatch events
      this.dispatchUndoStackChanged();
      this.dispatchActionRedone(action);
      
      return action;
    } catch (error) {
      // If redo fails, put the action back
      this.redoStack.push(action);
      console.error('Failed to redo action:', error);
      throw error;
    }
  }

  /**
   * Check if undo is possible
   */
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /**
   * Check if redo is possible
   */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Get the description of the next undoable action
   */
  getUndoDescription(): string | null {
    if (this.undoStack.length === 0) {
      return null;
    }
    
    return this.undoStack[this.undoStack.length - 1].description;
  }

  /**
   * Get the description of the next redoable action
   */
  getRedoDescription(): string | null {
    if (this.redoStack.length === 0) {
      return null;
    }
    
    return this.redoStack[this.redoStack.length - 1].description;
  }

  /**
   * Get undo stack history
   */
  getUndoHistory(): Array<{ id: string; description: string; timestamp: number }> {
    return this.undoStack.map(action => ({
      id: action.id,
      description: action.description,
      timestamp: action.timestamp
    }));
  }

  /**
   * Get redo stack history
   */
  getRedoHistory(): Array<{ id: string; description: string; timestamp: number }> {
    return this.redoStack.map(action => ({
      id: action.id,
      description: action.description,
      timestamp: action.timestamp
    }));
  }

  /**
   * Undo to a specific action (undo multiple actions at once)
   */
  undoTo(actionId: string): boolean {
    const actionIndex = this.undoStack.findIndex(action => action.id === actionId);
    
    if (actionIndex === -1) {
      return false;
    }

    // Undo actions from the top of the stack down to the target action
    const actionsToUndo = this.undoStack.slice(actionIndex);
    
    try {
      // Apply reverse operations in reverse order
      for (let i = actionsToUndo.length - 1; i >= 0; i--) {
        this.applyOperations(actionsToUndo[i].reverseOperations);
      }
      
      // Move actions to redo stack
      this.redoStack.push(...actionsToUndo.reverse());
      this.undoStack = this.undoStack.slice(0, actionIndex);
      
      this.dispatchUndoStackChanged();
      
      return true;
    } catch (error) {
      console.error('Failed to undo to action:', error);
      return false;
    }
  }

  /**
   * Clear all undo/redo history
   */
  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.dispatchUndoStackChanged();
  }

  /**
   * Remove a specific action from the undo stack
   */
  removeAction(actionId: string): boolean {
    const undoIndex = this.undoStack.findIndex(action => action.id === actionId);
    const redoIndex = this.redoStack.findIndex(action => action.id === actionId);
    
    let removed = false;
    
    if (undoIndex !== -1) {
      this.undoStack.splice(undoIndex, 1);
      removed = true;
    }
    
    if (redoIndex !== -1) {
      this.redoStack.splice(redoIndex, 1);
      removed = true;
    }
    
    if (removed) {
      this.dispatchUndoStackChanged();
    }
    
    return removed;
  }

  /**
   * Calculate reverse operations to undo the applied changes
   */
  private calculateReverseOperations(
    previousState: Instance[],
    currentState: Instance[],
    appliedOperations: InstanceEvent[]
  ): InstanceEvent[] {
    const reverseOps: InstanceEvent[] = [];
    
    // Process applied operations in reverse order
    for (let i = appliedOperations.length - 1; i >= 0; i--) {
      const operation = appliedOperations[i];
      
      switch (operation.action) {
        case 'add':
          // Reverse of add is remove
          if (operation.instance) {
            reverseOps.push({
              action: 'remove',
              targetId: operation.instance.id
            });
          }
          break;
          
        case 'remove':
          // Reverse of remove is add (restore from previous state)
          if (operation.targetId) {
            const originalInstance = previousState.find(inst => inst.id === operation.targetId);
            if (originalInstance) {
              reverseOps.push({
                action: 'add',
                instance: originalInstance
              });
            }
          }
          break;
          
        case 'update':
          // Reverse of update is update with previous values
          if (operation.targetId) {
            const originalInstance = previousState.find(inst => inst.id === operation.targetId);
            if (originalInstance) {
              reverseOps.push({
                action: 'update',
                targetId: operation.targetId,
                instance: originalInstance
              });
            }
          }
          break;
      }
    }
    
    return reverseOps;
  }

  /**
   * Apply operations (used for undo/redo)
   */
  private applyOperations(operations: InstanceEvent[]) {
    // Dispatch event for the application to handle the operations
    const event = new CustomEvent('applyInstanceOperations', {
      detail: { operations }
    });
    document.dispatchEvent(event);
  }

  /**
   * Dispatch undo stack changed event
   */
  private dispatchUndoStackChanged() {
    const event = new CustomEvent('undoStackChanged', {
      detail: {
        canUndo: this.canUndo(),
        canRedo: this.canRedo(),
        undoDescription: this.getUndoDescription(),
        redoDescription: this.getRedoDescription(),
        undoCount: this.undoStack.length,
        redoCount: this.redoStack.length
      }
    });
    document.dispatchEvent(event);
  }

  /**
   * Dispatch action undone event
   */
  private dispatchActionUndone(action: UndoableAction) {
    const event = new CustomEvent('suggestionActionUndone', {
      detail: { action }
    });
    document.dispatchEvent(event);
  }

  /**
   * Dispatch action redone event
   */
  private dispatchActionRedone(action: UndoableAction) {
    const event = new CustomEvent('suggestionActionRedone', {
      detail: { action }
    });
    document.dispatchEvent(event);
  }

  /**
   * Create a keyboard handler for undo/redo shortcuts
   */
  createKeyboardHandler(): (event: KeyboardEvent) => void {
    return (event: KeyboardEvent) => {
      // Check for Ctrl+Z (or Cmd+Z on Mac)
      if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        if (this.canUndo()) {
          this.undo();
        }
      }
      
      // Check for Ctrl+Shift+Z or Ctrl+Y (or Cmd equivalents)
      if ((event.ctrlKey || event.metaKey) && 
          ((event.key === 'z' && event.shiftKey) || event.key === 'y')) {
        event.preventDefault();
        if (this.canRedo()) {
          this.redo();
        }
      }
    };
  }

  /**
   * Register keyboard shortcuts
   */
  registerKeyboardShortcuts() {
    const handler = this.createKeyboardHandler();
    document.addEventListener('keydown', handler);
    
    // Return cleanup function
    return () => {
      document.removeEventListener('keydown', handler);
    };
  }

  /**
   * Get statistics about undo/redo usage
   */
  getStatistics(): {
    totalUndoableActions: number;
    currentUndoStackSize: number;
    currentRedoStackSize: number;
    mostRecentAction?: string;
  } {
    return {
      totalUndoableActions: this.undoStack.length + this.redoStack.length,
      currentUndoStackSize: this.undoStack.length,
      currentRedoStackSize: this.redoStack.length,
      mostRecentAction: this.undoStack.length > 0 
        ? this.undoStack[this.undoStack.length - 1].description 
        : undefined
    };
  }
}

// Export singleton instance
export const suggestionUndoManager = new SuggestionUndoManager();
export default suggestionUndoManager;