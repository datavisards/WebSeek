import { Instance, Message, ProactiveSuggestion } from './types';
import { contextService } from './context-service';
import { chatWithAgent } from './api-selector';
import { generateInstanceContext } from './utils';

export interface ProactiveSettings {
  enabled: boolean;
  idleTimeoutMs: number; // Time to wait after user stops interacting
  maxSuggestionsPerSession: number; // Limit to avoid overwhelming
  confidenceThreshold: number; // Minimum confidence to show suggestions
  debounceMs: number; // Debounce rapid context changes
}

class ProactiveService {
  private settings: ProactiveSettings = {
    enabled: true,
    idleTimeoutMs: 1000, // 1 second after user stops
    maxSuggestionsPerSession: 50, // Increased from 10 to 50
    confidenceThreshold: 0.6,
    debounceMs: 500, // 0.5 second debounce
  };

  private currentSuggestions: ProactiveSuggestion[] = [];
  private isGenerating = false;
  private currentGenerationController: AbortController | null = null;
  private suggestionCount = 0;
  private idleTimer: NodeJS.Timeout | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private lastActivity = Date.now();
  private currentContext = {
    instances: [] as Instance[],
    messages: [] as Message[],
    htmlContexts: {} as Record<string, any>,
    logs: [] as string[],
  };
  private isSuggestionsStopped = false;
  private isUserActive = false;
  private shouldAutoResume = false;

  // Event listeners
  private onSuggestionsUpdated: ((suggestions: ProactiveSuggestion[]) => void) | null = null;
  private onSuggestionAccepted: ((suggestion: ProactiveSuggestion) => void) | null = null;
  private onGenerationStateChanged: ((isGenerating: boolean) => void) | null = null;

  constructor() {
    this.resetSession();
  }

  // Configuration methods
  updateSettings(newSettings: Partial<ProactiveSettings>) {
    this.settings = { ...this.settings, ...newSettings };
  }

  getSettings(): ProactiveSettings {
    return { ...this.settings };
  }

  // Event listener registration
  onSuggestionsChange(callback: (suggestions: ProactiveSuggestion[]) => void) {
    this.onSuggestionsUpdated = callback;
  }

  onSuggestionAccept(callback: (suggestion: ProactiveSuggestion) => void) {
    this.onSuggestionAccepted = callback;
  }

  onGenerationStateChange(callback: (isGenerating: boolean) => void) {
    this.onGenerationStateChanged = callback;
  }

  // Update context with new instances, messages, and HTML contexts
  updateContext({instances, messages, htmlContexts}: {instances?: Instance[], messages?: Message[], htmlContexts?: Record<string, any>}) {
    if (instances) {
      this.currentContext.instances = instances;
    }
    if (messages) {
      this.currentContext.messages = messages;
    }
    if (htmlContexts) {
      this.currentContext.htmlContexts = htmlContexts;
    }
  }

  // Immediate trigger for logs updates
  triggerLogsUpdate(logs: string[]) {
    this.currentContext.logs = logs;
    
    // Always log the context update regardless of settings or stopped state
    console.log('Proactive service: logs updated', logs);
    
    // Auto-resume if we were stopped and should resume on next interaction
    if (this.isSuggestionsStopped && this.shouldAutoResume && logs.length > 0) {
      console.log('Proactive service: auto-resuming after user interaction');
      this.isSuggestionsStopped = false;
      this.shouldAutoResume = false;
    }
    
    if (!this.settings.enabled || this.isSuggestionsStopped) return;

    // Check if the htmlContexts are available
    if (Object.keys(this.currentContext.htmlContexts).length === 0) {
      console.log("No HTML context available, skipping proactive suggestions trigger");
      return;
    }

    this.lastActivity = Date.now();

    // Clear existing timers
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    // Immediately generate suggestions without waiting for idle time
    this.generateSuggestions(this.currentContext.instances, this.currentContext.messages, this.currentContext.htmlContexts, this.currentContext.logs);
  }

  // Start the idle timer
  private startIdleTimer() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }

    this.idleTimer = setTimeout(() => {
      this.generateSuggestions(this.currentContext.instances, this.currentContext.messages, this.currentContext.htmlContexts, this.currentContext.logs);
    }, this.settings.idleTimeoutMs);
  }

  // Generate suggestions using LLM
  private async generateSuggestions(instances: Instance[], messages: Message[], htmlContexts: Record<string, any>, logs: string[]) {
    console.log('Generating proactive suggestions...', this.isGenerating, this.suggestionCount, this.settings.maxSuggestionsPerSession, 'stopped:', this.isSuggestionsStopped);
    
    if (this.suggestionCount >= this.settings.maxSuggestionsPerSession ||
        this.isSuggestionsStopped) {
      return;
    }

    // If already generating, cancel the previous generation
    if (this.isGenerating && this.currentGenerationController) {
      console.log('Canceling previous suggestion generation for new interaction');
      this.currentGenerationController.abort();
    }

    // Clear existing suggestions when starting new generation
    this.clearSuggestions();

    this.isGenerating = true;
    this.currentGenerationController = new AbortController();
    
    // Notify that generation started
    if (this.onGenerationStateChanged) {
      this.onGenerationStateChanged(true);
    }

    try {
      // Use provided context or get current context
      const currentInstances = instances || contextService.getInstances();
      const currentMessages = messages || contextService.getMessages();
      const currentHtmlContexts = htmlContexts || contextService.getHtmlContexts();

      console.log('Current context:', {
        instances: currentInstances,
        messages: currentMessages,
        htmlContexts: Object.keys(currentHtmlContexts)
      });

      // Check if we have enough context to make suggestions
      if (currentInstances.length === 0 && currentMessages.length === 0 && Object.keys(currentHtmlContexts).length === 0) {
        return; // Not enough context
      }

      // Generate instance and conversation context
      const { imageContext, textContext } = await generateInstanceContext(currentInstances);
      

      console.log('Generating proactive suggestions...');

      // Call LLM with suggest type
      let result;
      if (import.meta.env.WXT_USE_LLM == "true") {
        result = await chatWithAgent(
          'suggest',
          'Provide proactive suggestions based on the current context.',
          currentMessages,
          textContext,
          imageContext,
          currentHtmlContexts,
          logs
        );
      } else {
        result = await chatWithAgent(
          'suggest',
          'Provide proactive suggestions based on the current context.'
        );
      }

      if (result.instances && result.instances.length > 0) {
        // Create a proactive suggestion from the result
        const suggestion: ProactiveSuggestion = {
          message: result.message || 'Apply suggested changes',
          instances: result.instances,
          id: `suggestion_${Date.now()}`
        };
        
        this.currentSuggestions = [suggestion];
        this.suggestionCount++;
        
        console.log('Generated proactive suggestion:', suggestion);
        
        // Notify listeners
        if (this.onSuggestionsUpdated) {
          this.onSuggestionsUpdated(this.currentSuggestions);
        }
      } else {
        console.log('No instance updates suggested, skipping');
      }

    } catch (error) {
      if (typeof error === 'object' && error !== null && 'name' in error && (error as any).name !== 'AbortError') {
        console.error('Error generating proactive suggestions:', error);
      }
    } finally {
      this.isGenerating = false;
      this.currentGenerationController = null;
      
      // Notify that generation ended
      if (this.onGenerationStateChanged) {
        this.onGenerationStateChanged(false);
      }
    }
  }

  // Accept a suggestion and execute it
  async acceptSuggestion(suggestionId: string): Promise<boolean> {
    const suggestion = this.currentSuggestions.find(s => s.id === suggestionId);
    if (!suggestion) return false;

    try {
      // If suggestion has instances, trigger the appropriate handler
      if (suggestion.instances && suggestion.instances.length > 0) {
        if (this.onSuggestionAccepted) {
          this.onSuggestionAccepted(suggestion);
        }
      }

      // Remove the accepted suggestion
      this.currentSuggestions = this.currentSuggestions.filter(s => s.id !== suggestionId);
      
      // Notify listeners of updated suggestions
      if (this.onSuggestionsUpdated) {
        this.onSuggestionsUpdated(this.currentSuggestions);
      }

      return true;
    } catch (error) {
      console.error('Error accepting suggestion:', error);
      return false;
    }
  }

  // Dismiss a suggestion
  dismissSuggestion(suggestionId: string) {
    this.currentSuggestions = this.currentSuggestions.filter(s => s.id !== suggestionId);
    
    if (this.onSuggestionsUpdated) {
      this.onSuggestionsUpdated(this.currentSuggestions);
    }
  }

  // Clear all current suggestions
  clearSuggestions() {
    if (this.currentSuggestions.length > 0) {
      this.currentSuggestions = [];
      if (this.onSuggestionsUpdated) {
        this.onSuggestionsUpdated([]);
      }
    }
  }

  // Get current suggestions
  getCurrentSuggestions(): ProactiveSuggestion[] {
    return [...this.currentSuggestions];
  }

  // Reset session (clear counters and suggestions)
  resetSession() {
    this.suggestionCount = 0;
    this.currentSuggestions = [];
  }

  // Get current session stats
  getSessionStats() {
    return {
      suggestionCount: this.suggestionCount,
      maxSuggestions: this.settings.maxSuggestionsPerSession,
      isAtLimit: this.suggestionCount >= this.settings.maxSuggestionsPerSession
    };
  }

  // Stop all suggestion generation (but continue logging)
  stopSuggestions(autoResumeOnNextInteraction = false) {
    console.log('Proactive service: stopping suggestions', autoResumeOnNextInteraction ? '(will auto-resume)' : '');
    this.isSuggestionsStopped = true;
    this.shouldAutoResume = autoResumeOnNextInteraction;
    
    // Abort any ongoing generation tasks
    if (this.currentGenerationController) {
      console.log('Aborting ongoing suggestion generation');
      this.currentGenerationController.abort();
      this.currentGenerationController = null;
    }
    
    // Clear any pending timers
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    
    // Clear current suggestions
    this.clearSuggestions();
  }

  // Resume suggestion generation
  resumeSuggestions() {
    console.log('Proactive service: resuming suggestions');
    this.isSuggestionsStopped = false;
    this.shouldAutoResume = false;
  }

  // Set user activity state (to track if user is actively working)
  setUserActive(isActive: boolean) {
    this.isUserActive = isActive;
    if (isActive) {
      this.lastActivity = Date.now();
    }
  }

  // Cleanup
  destroy() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.clearSuggestions();
  }
}

// Export singleton instance
export const proactiveService = new ProactiveService();
export default proactiveService;