/**
 * GlobalUndoManager - Manages undo/redo functionality for all application state changes
 * Extends the suggestion-based undo system to handle all user actions
 */

import { Instance } from './types';
import { suggestionUndoManager } from './suggestion-undo-manager';

interface StateSnapshot {
  id: string;
  timestamp: number;
  description: string;
  instances: Instance[];
  logs: string[];
  undoable: boolean;
}

interface StateChange {
  previousState: Instance[];
  newState: Instance[];
  previousLogs: string[];
  newLogs: string[];
  description: string;
  undoable?: boolean;
}

export class GlobalUndoManager {
  private stateHistory: StateSnapshot[] = [];
  private currentStateIndex: number = -1;
  private maxHistorySize: number = 100;
  private snapshotId: number = 0;
  private isApplyingUndoRedo: boolean = false;
  private instanceId: string;

  constructor() {
    this.instanceId = `undoManager_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log('[GlobalUndoManager] Creating new instance:', this.instanceId);
    
    // Try to restore state from sessionStorage to survive hot reloads
    try {
      const savedState = sessionStorage.getItem('globalUndoManagerState');
      if (savedState) {
        const parsed = JSON.parse(savedState);
        this.stateHistory = parsed.stateHistory || [];
        this.currentStateIndex = parsed.currentStateIndex || -1;
        console.log('[GlobalUndoManager] Restored state from sessionStorage:', {
          historyLength: this.stateHistory.length,
          currentIndex: this.currentStateIndex
        });
      }
    } catch (error) {
      console.log('[GlobalUndoManager] Failed to restore state:', error);
    }
  }

    /**
   * Record a state change for undo/redo
   */
  recordStateChange(change: StateChange) {
    console.log('[GlobalUndoManager] Recording state change:', {
      instanceId: this.instanceId,
      description: change.description,
      previousInstancesCount: change.previousState.length,
      newInstancesCount: change.newState.length,
      previousLogsCount: change.previousLogs.length,
      newLogsCount: change.newLogs.length,
      undoable: change.undoable
    });

    // Allow initial state recording even if not undoable, but skip other non-undoable changes
    if (!change.undoable && this.stateHistory.length > 0) {
      console.log('[GlobalUndoManager] Skipping non-undoable change (not initial state)');
      return;
    }

    // Check for duplicate recording - prevent identical operations within 100ms
    // TEMPORARILY DISABLED FOR DEBUGGING
    const now = Date.now();
    const lastSnapshot = this.stateHistory[this.stateHistory.length - 1];
    
    // TODO: Re-enable duplicate prevention after debugging
    /*
    if (lastSnapshot && 
        (now - lastSnapshot.timestamp) < 100 &&
        lastSnapshot.description === change.description &&
        lastSnapshot.instances.length === change.newState.length &&
        lastSnapshot.logs.length === change.newLogs.length) {
      console.log('[GlobalUndoManager] Preventing duplicate recording of same operation:', change.description);
      console.log('[GlobalUndoManager] Time since last:', now - lastSnapshot.timestamp, 'ms');
      return;
    }
    */
    console.log('[GlobalUndoManager] Duplicate prevention DISABLED for debugging');

    // Create snapshot ID
    const snapshotId = `state_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create new snapshot
    const snapshot: StateSnapshot = {
      id: snapshotId,
      timestamp: Date.now(),
      instances: structuredClone(change.newState),
      logs: [...change.newLogs],
      description: change.description,
      undoable: true
    };

    // If we're not at the end of history, remove future states
    if (this.currentStateIndex < this.stateHistory.length - 1) {
      this.stateHistory = this.stateHistory.slice(0, this.currentStateIndex + 1);
    }

    // Add new snapshot
    this.stateHistory.push(snapshot);
    this.currentStateIndex = this.stateHistory.length - 1;

    console.log('[GlobalUndoManager] State recorded:', {
      snapshotId,
      currentIndex: this.currentStateIndex,
      historyLength: this.stateHistory.length,
      description: change.description
    });

    // Limit history size
    if (this.stateHistory.length > this.maxHistorySize) {
      const removed = this.stateHistory.shift();
      this.currentStateIndex--;
      console.log('[GlobalUndoManager] Removed old snapshot:', removed?.id);
    }

    // Dispatch state changed event
    this.dispatchStateChanged();
    
    // Save state to sessionStorage to survive hot reloads
    try {
      sessionStorage.setItem('globalUndoManagerState', JSON.stringify({
        stateHistory: this.stateHistory,
        currentStateIndex: this.currentStateIndex
      }));
    } catch (error) {
      console.log('[GlobalUndoManager] Failed to save state:', error);
    }
  }

  /**
   * Undo the last action
   */
  undo(): boolean {
    console.log('[GlobalUndoManager] Undo called:', {
      currentIndex: this.currentStateIndex,
      historyLength: this.stateHistory.length,
      canUndo: this.canUndo()
    });
    
    // Debug: show recent history
    console.log('[GlobalUndoManager] Recent history:');
    for (let i = Math.max(0, this.currentStateIndex - 2); i < this.stateHistory.length; i++) {
      const snapshot = this.stateHistory[i];
      console.log(`  [${i}]${i === this.currentStateIndex ? ' (current)' : ''}: ${snapshot.description} (instances: ${snapshot.instances.length}, logs: ${snapshot.logs.length})`);
    }
    
    if (!this.canUndo()) {
      console.log('[GlobalUndoManager] Cannot undo - at beginning of history');
      return false;
    }

    this.currentStateIndex--;
    const targetSnapshot = this.stateHistory[this.currentStateIndex];
    
    console.log('[GlobalUndoManager] Undoing to snapshot:', {
      targetIndex: this.currentStateIndex,
      targetDescription: targetSnapshot.description,
      targetInstancesCount: targetSnapshot.instances.length,
      targetLogsCount: targetSnapshot.logs.length,
      targetLogs: targetSnapshot.logs
    });
    
    this.applySnapshot(targetSnapshot);
    this.dispatchStateChanged();
    return true;
  }

  /**
   * Redo the next state change
   */
  redo(): StateSnapshot | null {
    if (!this.canRedo()) {
      return null;
    }

    this.currentStateIndex++;
    const targetSnapshot = this.stateHistory[this.currentStateIndex];
    
    console.log(`[GlobalUndoManager] Redoing to: ${targetSnapshot.description}`);
    
    // Apply the next state
    this.isApplyingUndoRedo = true;
    try {
      this.applySnapshot(targetSnapshot);
      this.dispatchStateChanged();
      return targetSnapshot;
    } finally {
      this.isApplyingUndoRedo = false;
    }
  }

  /**
   * Check if undo is possible
   */
  canUndo(): boolean {
    const result = this.currentStateIndex > 0;
    console.log('[GlobalUndoManager] canUndo check:', {
      currentStateIndex: this.currentStateIndex,
      historyLength: this.stateHistory.length,
      canUndo: result,
      historyDescriptions: this.stateHistory.map(s => s.description)
    });
    return result;
  }

  /**
   * Check if redo is possible
   */
  canRedo(): boolean {
    return this.currentStateIndex < this.stateHistory.length - 1;
  }

  /**
   * Get the current history length
   */
  getHistoryLength(): number {
    return this.stateHistory.length;
  }

  /**
   * Get description of next undoable action
   */
  getUndoDescription(): string | null {
    if (!this.canUndo()) {
      return null;
    }
    return this.stateHistory[this.currentStateIndex - 1].description;
  }

  /**
   * Get description of next redoable action
   */
  getRedoDescription(): string | null {
    if (!this.canRedo()) {
      return null;
    }
    return this.stateHistory[this.currentStateIndex + 1].description;
  }

  /**
   * Get current state history for debugging
   */
  getHistory(): Array<{ id: string; description: string; timestamp: number; isCurrent: boolean }> {
    return this.stateHistory.map((snapshot, index) => ({
      id: snapshot.id,
      description: snapshot.description,
      timestamp: snapshot.timestamp,
      isCurrent: index === this.currentStateIndex
    }));
  }

  /**
   * Apply a state snapshot
   */
  private applySnapshot(snapshot: StateSnapshot) {
    console.log('[GlobalUndoManager] Applying snapshot:', {
      snapshotId: snapshot.id,
      description: snapshot.description,
      instancesCount: snapshot.instances.length,
      logsCount: snapshot.logs.length,
      timestamp: snapshot.timestamp
    });
    
    // Dispatch event to update application state
    const event = new CustomEvent('applyGlobalState', {
      detail: {
        instances: snapshot.instances,
        logs: snapshot.logs,
        description: snapshot.description
      }
    });
    
    console.log('[GlobalUndoManager] Dispatching applyGlobalState event with:', {
      instancesCount: snapshot.instances.length,
      logsCount: snapshot.logs.length,
      logs: snapshot.logs
    });
    
    document.dispatchEvent(event);
  }

  /**
   * Dispatch state changed event for UI updates
   */
  private dispatchStateChanged() {
    const event = new CustomEvent('globalUndoStateChanged', {
      detail: {
        canUndo: this.canUndo(),
        canRedo: this.canRedo(),
        undoDescription: this.getUndoDescription(),
        redoDescription: this.getRedoDescription(),
        historySize: this.stateHistory.length,
        currentIndex: this.currentStateIndex
      }
    });
    document.dispatchEvent(event);
  }

  /**
   * Register global keyboard shortcuts for undo/redo
   */
  registerGlobalKeyboardShortcuts(): () => void {
    const handler = (event: KeyboardEvent) => {
      // Only handle if not in input/textarea/contenteditable
      const activeElement = document.activeElement;
      const isInInput = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        (activeElement as HTMLElement).contentEditable === 'true'
      );

      if (isInInput) {
        return; // Let input elements handle their own undo/redo
      }

      // Check for Ctrl+Z (or Cmd+Z on Mac)
      if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
        console.log('[GlobalUndoManager] Undo keyboard shortcut triggered');
        event.preventDefault();
        event.stopPropagation();
        if (this.canUndo()) {
          console.log('[GlobalUndoManager] Executing undo...');
          this.undo();
        } else {
          console.log('[GlobalUndoManager] Cannot undo - no previous state');
          console.log('[GlobalUndoManager] Current state:', {
            currentStateIndex: this.currentStateIndex,
            historyLength: this.stateHistory.length,
            history: this.stateHistory.map(s => ({ id: s.id, description: s.description, instancesCount: s.instances.length, logsCount: s.logs.length }))
          });
        }
      }
      
      // Check for Ctrl+Shift+Z or Ctrl+Y (or Cmd equivalents)
      if ((event.ctrlKey || event.metaKey) && 
          ((event.key === 'z' && event.shiftKey) || event.key === 'y')) {
        console.log('[GlobalUndoManager] Redo keyboard shortcut triggered');
        event.preventDefault();
        event.stopPropagation();
        if (this.canRedo()) {
          console.log('[GlobalUndoManager] Executing redo...');
          this.redo();
        } else {
          console.log('[GlobalUndoManager] Cannot redo - no next state');
        }
      }
    };

    // Use capture phase to intercept before other handlers
    document.addEventListener('keydown', handler, true);
    
    return () => {
      document.removeEventListener('keydown', handler, true);
    };
  }

  /**
   * Initialize with current state
   */
  initializeWithState(instances: Instance[], logs: string[] = [], description: string = 'Initial state') {
    if (this.stateHistory.length === 0) {
      this.recordStateChange({
        previousState: [],
        newState: instances,
        previousLogs: [],
        newLogs: logs,
        description,
        undoable: false // Initial state is not undoable
      });
    }
  }

  /**
   * Clear all history (useful for new documents/sessions)
   */
  clearHistory() {
    this.stateHistory = [];
    this.currentStateIndex = -1;
    this.dispatchStateChanged();
  }

  /**
   * Restore to a specific checkpoint by log index
   * This is different from undo/redo as it maps to external log indices
   */
  restoreToLogCheckpoint(logIndex: number, logs: string[], getCurrentInstances: () => Instance[], getCurrentLogs: () => string[]): boolean {
    // For this implementation, we'll find the corresponding state snapshot
    // that matches the log description at the given index
    if (logIndex < 0 || logIndex >= logs.length) {
      console.warn(`[GlobalUndoManager] Invalid log index: ${logIndex}`);
      return false;
    }

    const targetLogDescription = logs[logIndex];
    console.log(`[GlobalUndoManager] Looking for checkpoint matching: "${targetLogDescription}"`);

    // Find the closest matching state snapshot
    // We'll look for snapshots that occurred around the same time or have similar descriptions
    let bestMatch: StateSnapshot | null = null;
    let bestMatchIndex = -1;

    // Try to find an exact description match first
    for (let i = 0; i < this.stateHistory.length; i++) {
      const snapshot = this.stateHistory[i];
      if (snapshot.description === targetLogDescription) {
        bestMatch = snapshot;
        bestMatchIndex = i;
        break;
      }
    }

    // If no exact match, find the snapshot that would represent the state at that log point
    // For simplicity, we'll use the snapshot at the corresponding relative position
    if (!bestMatch && this.stateHistory.length > 0) {
      const relativePosition = logIndex / logs.length;
      const targetSnapshotIndex = Math.min(
        Math.floor(relativePosition * this.stateHistory.length),
        this.stateHistory.length - 1
      );
      bestMatch = this.stateHistory[targetSnapshotIndex];
      bestMatchIndex = targetSnapshotIndex;
    }

    if (!bestMatch) {
      console.warn(`[GlobalUndoManager] No matching snapshot found for log index ${logIndex}`);
      return false;
    }

    console.log(`[GlobalUndoManager] Restoring to checkpoint: "${bestMatch.description}" at snapshot index ${bestMatchIndex}`);

    // Apply the snapshot
    this.isApplyingUndoRedo = true;
    try {
      this.currentStateIndex = bestMatchIndex;
      this.applySnapshot(bestMatch);
      
      // Record this restoration as a new state change
      this.recordStateChange({
        previousState: getCurrentInstances(),
        newState: bestMatch.instances,
        previousLogs: getCurrentLogs(),
        newLogs: bestMatch.logs,
        description: `Restored to checkpoint: ${targetLogDescription}`,
        undoable: true
      });

      this.dispatchStateChanged();
      return true;
    } finally {
      this.isApplyingUndoRedo = false;
    }
  }

  /**
   * Get statistics for debugging
   */
  getStatistics() {
    return {
      historySize: this.stateHistory.length,
      currentIndex: this.currentStateIndex,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      maxHistorySize: this.maxHistorySize
    };
  }
}

// Export singleton instance
export const globalUndoManager = new GlobalUndoManager();
export default globalUndoManager;
