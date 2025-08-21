/**
 * ProactiveService - Legacy proactive suggestion system
 * Used by some components for backward compatibility
 */

import { suggestionGenerator } from './suggestion-generator';
import { triggerEngine } from './trigger-engine';
import { contextService } from './context-service';
import { suggestionUIController } from './suggestion-ui-controller';
import { actionMonitor } from './action-monitor';
import { 
  ProactiveSuggestion, 
  SuggestionTriggerRule, 
  UserActionEvent
} from './types';

export interface ProactiveSettings {
  enabled: boolean;
  suggestionDelay: number;
  maxSuggestions: number;
  confidenceThreshold: number;
}

export class ProactiveService {
  private currentSuggestions: ProactiveSuggestion[] = [];
  private isActive: boolean = true;
  private settings: ProactiveSettings = {
    enabled: true,
    suggestionDelay: 2000,
    maxSuggestions: 3,
    confidenceThreshold: 0.6
  };
  private onSuggestionsUpdated: ((suggestions: ProactiveSuggestion[]) => void) | null = null;
  private sessionStats = {
    suggestionsGenerated: 0,
    suggestionsAccepted: 0,
    sessionStartTime: Date.now()
  };

  constructor() {
    this.initialize();
  }

  private initialize() {
    // Listen for action monitor events using subscribe method
    actionMonitor.subscribe((event: UserActionEvent) => {
      if (this.isActive && this.settings.enabled) {
        this.processUserAction(event);
      }
    });

    // Trigger engine is already initialized by default
  }

  /**
   * Process user actions and potentially generate suggestions
   */
  private async processUserAction(event: UserActionEvent) {
    try {
      // Get recent actions for context
      const recentActions = actionMonitor.getRecentActions(30000); // Last 30 seconds
      
      // Check which rules are triggered
      const triggeredRules = triggerEngine.checkTriggers(recentActions);
      
      if (triggeredRules.length > 0) {
        // Generate suggestions based on triggered rules
        const context = this.buildContext();
        const suggestions = await suggestionGenerator.generateSuggestions(triggeredRules, context);
        
        if (suggestions.length > 0) {
          this.addSuggestions(suggestions);
        }
      }
    } catch (error) {
      console.error('[ProactiveService] Error processing user action:', error);
    }
  }

  /**
   * Build context for suggestion generation
   */
  private buildContext() {
    return {
      instances: contextService.getInstances(),
      recentActions: actionMonitor.getRecentActions(60000),
      currentUrl: window.location.href,
      timestamp: Date.now()
    };
  }

  /**
   * Add new suggestions to the current list
   */
  private addSuggestions(newSuggestions: ProactiveSuggestion[]) {
    // Filter out low-confidence suggestions
    const filteredSuggestions = newSuggestions.filter(
      s => s.confidence >= this.settings.confidenceThreshold
    );

    // Add to current suggestions (up to max limit)
    this.currentSuggestions.push(...filteredSuggestions);
    this.currentSuggestions = this.currentSuggestions
      .slice(-this.settings.maxSuggestions); // Keep only the most recent

    this.sessionStats.suggestionsGenerated += filteredSuggestions.length;

    // Display suggestions
    if (filteredSuggestions.length > 0) {
      this.displaySuggestions(filteredSuggestions);
    }

    // Notify listeners
    if (this.onSuggestionsUpdated) {
      this.onSuggestionsUpdated(this.currentSuggestions);
    }
  }

  /**
   * Display suggestions using the UI controller
   */
  private displaySuggestions(suggestions: ProactiveSuggestion[]) {
    try {
      suggestionUIController.displaySuggestions(suggestions, {
        autoHide: true,
        hideDelayMs: 8000
      });
    } catch (error) {
      console.error('[ProactiveService] Error displaying suggestions:', error);
    }
  }

  /**
   * Accept a suggestion
   */
  async acceptSuggestion(suggestionId: string): Promise<boolean> {
    const suggestion = this.currentSuggestions.find(s => s.id === suggestionId);
    if (!suggestion) {
      return false;
    }

    try {
      // Apply suggestion instances if any
      if (suggestion.instances && suggestion.instances.length > 0) {
        // Apply operations through context service
        for (const operation of suggestion.instances) {
          switch (operation.action) {
            case 'add':
              if (operation.instance) {
                contextService.addInstance(operation.instance);
              }
              break;
            case 'remove':
              if (operation.targetId) {
                contextService.removeInstance(operation.targetId);
              }
              break;
            case 'update':
              if (operation.targetId && operation.instance) {
                contextService.updateInstance(operation.targetId, operation.instance);
              }
              break;
          }
        }
      }

      // Remove from current suggestions
      this.currentSuggestions = this.currentSuggestions.filter(s => s.id !== suggestionId);
      this.sessionStats.suggestionsAccepted++;

      // Notify listeners
      if (this.onSuggestionsUpdated) {
        this.onSuggestionsUpdated(this.currentSuggestions);
      }

      return true;
    } catch (error) {
      console.error('[ProactiveService] Error accepting suggestion:', error);
      return false;
    }
  }

  /**
   * Dismiss a suggestion
   */
  dismissSuggestion(suggestionId: string) {
    this.currentSuggestions = this.currentSuggestions.filter(s => s.id !== suggestionId);
    
    if (this.onSuggestionsUpdated) {
      this.onSuggestionsUpdated(this.currentSuggestions);
    }
  }

  /**
   * Clear all suggestions
   */
  clearSuggestions() {
    this.currentSuggestions = [];
    // Clear all individual suggestions
    this.currentSuggestions.forEach(suggestion => {
      suggestionUIController.hideSuggestion(suggestion.id);
    });
    
    if (this.onSuggestionsUpdated) {
      this.onSuggestionsUpdated(this.currentSuggestions);
    }
  }

  /**
   * Get current suggestions
   */
  getCurrentSuggestions(): ProactiveSuggestion[] {
    return [...this.currentSuggestions];
  }

  /**
   * Stop generating suggestions
   */
  stopSuggestions() {
    this.isActive = false;
    this.clearSuggestions();
  }

  /**
   * Resume generating suggestions
   */
  resumeSuggestions() {
    this.isActive = true;
  }

  /**
   * Update settings
   */
  updateSettings(newSettings: Partial<ProactiveSettings>) {
    this.settings = { ...this.settings, ...newSettings };
  }

  /**
   * Get current settings
   */
  getSettings(): ProactiveSettings {
    return { ...this.settings };
  }

  /**
   * Reset session statistics
   */
  resetSession() {
    this.sessionStats = {
      suggestionsGenerated: 0,
      suggestionsAccepted: 0,
      sessionStartTime: Date.now()
    };
    this.clearSuggestions();
  }

  /**
   * Get session statistics
   */
  getSessionStats() {
    return { ...this.sessionStats };
  }

  /**
   * Listen for suggestions updates
   */
  onSuggestionsChange(callback: (suggestions: ProactiveSuggestion[]) => void) {
    this.onSuggestionsUpdated = callback;
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.stopSuggestions();
    this.onSuggestionsUpdated = null;
  }
}

// Export singleton instance
export const proactiveService = new ProactiveService();
export default proactiveService;
