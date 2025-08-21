import { Instance, Message, ProactiveSuggestion } from './types';
import { contextService } from './context-service';
import { chatWithAgent } from './apis_old';
import { generateInstanceContext } from './utils';
import { triggerEngine } from './trigger-engine';
import { suggestionUIController } from './suggestion-ui-controller';
import { suggestionUndoManager } from './suggestion-undo-manager';
import { actionMonitor } from './action-monitor';
import { createRuleBasedSuggestionPrompt } from './prompts';

export interface ProactiveSettings {
  enabled: boolean;
  idleTimeoutMs: number;
  maxSuggestionsPerSession: number;
  confidenceThreshold: number;
  debounceMs: number;
}

class EnhancedProactiveService {
  private settings: ProactiveSettings = {
    enabled: true,
    idleTimeoutMs: 1000,
    maxSuggestionsPerSession: 50,
    confidenceThreshold: 0.6,
    debounceMs: 500
  };

  private currentSuggestions: ProactiveSuggestion[] = [];
  private isGenerating = false;
  private currentGenerationController: AbortController | null = null;
  private suggestionCount = 0;
  private idleTimer: NodeJS.Timeout | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private currentContext = {
    instances: [] as Instance[],
    messages: [] as Message[],
    htmlContexts: {} as Record<string, any>,
    logs: [] as string[],
  };
  private isSuggestionsStopped = false;
  private shouldAutoResume = false;

  // Progressive suggestion state tracking
  private suggestionHistory: Map<string, {
    ruleId: string;
    level: 'row' | 'table' | 'full';
    acceptedAt: number;
    tableId?: string;
    suggestionType: string;
  }> = new Map();

  // Event listeners
  private onSuggestionsUpdated: ((suggestions: ProactiveSuggestion[]) => void) | null = null;
  private onSuggestionAccepted: ((suggestion: ProactiveSuggestion) => void) | null = null;
  private onGenerationStateChanged: ((isGenerating: boolean) => void) | null = null;

  constructor() {
    this.resetSession();
    this.initializeEnhancedSystem();
  }

  /**
   * Wrapper for chatWithAgent that supports abort signals
   */
  private async chatWithAgentAbortable(
    chatType: any,
    userMessage: string,
    conversationHistory?: any[],
    instanceContext?: string,
    imageContext?: any[],
    htmlContext?: Record<string, any>,
    logs?: string[],
    signal?: AbortSignal
  ): Promise<any> {
    // Check if already aborted
    if (signal?.aborted) {
      throw new DOMException('Operation was aborted', 'AbortError');
    }

    // Create a promise wrapper that can be cancelled
    return new Promise((resolve, reject) => {
      // Set up abort listener
      const onAbort = () => {
        reject(new DOMException('Operation was aborted', 'AbortError'));
      };

      if (signal) {
        signal.addEventListener('abort', onAbort);
      }

      // Call the original chatWithAgent function
      const chatPromise = conversationHistory !== undefined
        ? chatWithAgent(chatType, userMessage, conversationHistory, instanceContext, imageContext, htmlContext, logs)
        : chatWithAgent(chatType, userMessage);

      chatPromise
        .then(result => {
          if (signal) {
            signal.removeEventListener('abort', onAbort);
          }
          if (signal?.aborted) {
            reject(new DOMException('Operation was aborted', 'AbortError'));
          } else {
            resolve(result);
          }
        })
        .catch(error => {
          if (signal) {
            signal.removeEventListener('abort', onAbort);
          }
          reject(error);
        });
    });
  }

  /**
   * Initialize the enhanced proactive suggestion system
   */
  private initializeEnhancedSystem() {
    // Listen for suggestion acceptance/dismissal events from UI controllers
    document.addEventListener('suggestionAccepted', (e: any) => {
      this.handleSuggestionAccepted(e.detail.suggestion);
    });

    document.addEventListener('suggestionDismissed', (e: any) => {
      this.handleSuggestionDismissed(e.detail.suggestion);
    });

    // Listen for instance operations (for undo support)
    document.addEventListener('applyInstanceOperations', (e: any) => {
      this.handleInstanceOperations(e.detail.operations);
    });

    // Set up debounced rule trigger handler
    (triggerEngine as any).onDebouncedRuleTrigger = (rule: any) => {
      console.log('[EnhancedProactiveService] Debounced rule triggered:', rule.id);
      this.handleDebouncedRuleTrigger(rule);
    };

    // Register undo/redo keyboard shortcuts
    suggestionUndoManager.registerKeyboardShortcuts();
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

  /**
   * Main entry point: Process logs and generate suggestions
   * This is called whenever logs are updated in the application
   */
  triggerLogsUpdate(logs: string[]) {
    console.log('[EnhancedProactiveService] Processing logs update:', logs.length);
    this.currentContext.logs = logs;
    
    // Auto-resume if we were stopped and should resume on next interaction
    if (this.isSuggestionsStopped && this.shouldAutoResume && logs.length > 0) {
      console.log('[EnhancedProactiveService] Auto-resuming after user interaction');
      this.isSuggestionsStopped = false;
      this.shouldAutoResume = false;
    }
    
    if (!this.settings.enabled || this.isSuggestionsStopped) return;

    // Check HTML context availability and determine which suggestion types can proceed
    const hasHtmlContext = Object.keys(this.currentContext.htmlContexts).length > 0;
    
    if (!hasHtmlContext) {
      console.log('[EnhancedProactiveService] No HTML context available - checking if context-independent suggestions can proceed');
      
      // Allow certain suggestion types that don't require HTML context
      const canProceedWithoutHtmlContext = this.canGenerateSuggestionsWithoutHtmlContext();
      
      if (!canProceedWithoutHtmlContext) {
        console.log('[EnhancedProactiveService] No context-independent suggestions available, skipping suggestions');
        return;
      }
      
      console.log('[EnhancedProactiveService] Proceeding with context-independent suggestions (no HTML context needed)');
    }

    // Cancel any ongoing suggestion generation immediately
    if (this.currentGenerationController) {
      console.log('[EnhancedProactiveService] Cancelling previous suggestion generation due to new user operation');
      this.currentGenerationController.abort();
      this.currentGenerationController = null;
    }

    // Clear existing debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    // Debounce the processing
    this.debounceTimer = setTimeout(() => {
      this.processLogsAndGenerateSuggestions(logs);
    }, this.settings.debounceMs);
  }

  /**
   * Process logs and generate enhanced suggestions with intelligent debouncing
   */
  private async processLogsAndGenerateSuggestions(logs: string[]) {
    if (this.suggestionCount >= this.settings.maxSuggestionsPerSession) {
      console.log('[EnhancedProactiveService] Max suggestions reached for session');
      return;
    }

    // Check if we should skip generation based on recent activity
    if (this.shouldSkipSuggestionGeneration(logs)) {
      console.log('[EnhancedProactiveService] Skipping suggestion generation based on recent activity');
      return;
    }

    try {
      // Set generating state
      this.isGenerating = true;
      if (this.onGenerationStateChanged) {
        this.onGenerationStateChanged(true);
      }

      console.log('[EnhancedProactiveService] Processing logs for AI-driven suggestions...');

      // Always use AI-driven suggestions with embedded rules
      await this.generateAIDrivenSuggestions(logs);

    } catch (error) {
      console.error('[EnhancedProactiveService] Error generating suggestions:', error);
    } finally {
      this.isGenerating = false;
      if (this.onGenerationStateChanged) {
        this.onGenerationStateChanged(false);
      }
    }
  }

  /**
   * Determine if suggestion generation should be skipped based on recent activity patterns
   */
  private shouldSkipSuggestionGeneration(logs: string[]): boolean {
    const recentLogs = logs.slice(-5);
    
    // TEMPORARILY DISABLED: Skip if there are too many rapid log entries (user is actively working)
    // const rapidLogThreshold = 10; // 10 logs in 5 seconds
    // const recentTimeWindow = 5000; // 5 seconds
    const now = Date.now();
    
    // TEMPORARILY DISABLED: Approximate log timestamps (this is an estimation)
    // const recentLogCount = recentLogs.length;
    // const estimatedLogsPerSecond = recentLogCount; // Rough estimate
    
    // TEMPORARILY DISABLED: High activity check
    // if (estimatedLogsPerSecond > 2) {
    //   console.log('[EnhancedProactiveService] Skipping due to high activity (estimated', estimatedLogsPerSecond, 'logs/sec)');
    //   return true;
    // }
    
    // Skip if user is in a UI navigation sequence
    const navigationPatterns = [
      'Switched to',
      'Opened menu',
      'Closed menu',
      'Selected tab',
      'Clicked button'
    ];
    
    const hasNavigationActivity = recentLogs.some(log => 
      navigationPatterns.some(pattern => log.includes(pattern))
    );
    
    if (hasNavigationActivity) {
      console.log('[EnhancedProactiveService] Skipping due to navigation activity');
      return true;
    }
    
    // REMOVED: Skip if the last suggestion was very recent functionality
    // This was preventing suggestions from being generated in rapid succession
    // which interfered with micro/macro suggestion coordination
    
    return false;
  }

  /**
   * Add suggestions intelligently, avoiding duplicates and managing stale suggestions
   * Replace old suggestions of the same type instead of accumulating them
   */
  private addSuggestions(newSuggestions: ProactiveSuggestion[]) {
    const now = Date.now();
    const staleThreshold = 30000; // 30 seconds
    
    // Remove stale suggestions from current array
    this.currentSuggestions = this.currentSuggestions.filter(s => 
      (now - s.timestamp) <= staleThreshold
    );
    
    // For each new suggestion, remove any existing suggestions of the same type
    newSuggestions.forEach(newSuggestion => {
      // Determine suggestion type from ruleIds or category
      const newSuggestionType = this.getSuggestionType(newSuggestion);
      
      // Remove existing suggestions of the same type
      this.currentSuggestions = this.currentSuggestions.filter(existingSuggestion => {
        const existingType = this.getSuggestionType(existingSuggestion);
        const shouldRemove = existingType === newSuggestionType;
        
        if (shouldRemove) {
          console.log('[EnhancedProactiveService] Replacing existing suggestion of type:', existingType);
        }
        
        return !shouldRemove;
      });
      
      // Add the new suggestion
      this.currentSuggestions.push(newSuggestion);
    });
    
    console.log('[EnhancedProactiveService] Added', newSuggestions.length, 'suggestions. Total:', this.currentSuggestions.length);
  }

  /**
   * Extract suggestion type for deduplication purposes
   */
  private getSuggestionType(suggestion: ProactiveSuggestion): string {
    // Try to get type from ruleIds first
    if ((suggestion as any).ruleIds && (suggestion as any).ruleIds.length > 0) {
      const ruleId = (suggestion as any).ruleIds[0];
      // Map rule IDs to suggestion types
      if (ruleId.includes('website')) return 'suggest-websites';
      if (ruleId.includes('visualization')) return 'suggest-visualization';
      if (ruleId.includes('sorting')) return 'suggest-sorting-filtering';
      if (ruleId.includes('interactive')) return 'suggest-interactive-filtering';
      if (ruleId.includes('fill-missing')) return 'suggest-fill-missing';
      return ruleId; // Use rule ID as type
    }
    
    // Fallback to category
    return suggestion.category || 'general';
  }

  /**
   * Generate suggestions using AI with embedded heuristic rules
   */
  private async generateAIDrivenSuggestions(logs: string[]) {
    console.log('[EnhancedProactiveService] Using AI-driven suggestions with embedded rules');

    // If the global env variable for proactive suggestions is disabled, skip generation
    if (import.meta.env.WXT_USE_PROACTIVE_SERVICE === "false") {
      console.log('[EnhancedProactiveService] AI suggestions disabled by environment variable');
      return;
    }

    // Only clear existing suggestions if they are stale (older than 30 seconds)
    // This prevents clearing suggestions that the user might be trying to accept
    const now = Date.now();
    const staleSuggestionThreshold = 30000; // 30 seconds
    const hasStalesuggestions = this.currentSuggestions.some(s => 
      (now - s.timestamp) > staleSuggestionThreshold
    );
    
    if (hasStalesuggestions || this.currentSuggestions.length === 0) {
      console.log('[EnhancedProactiveService] Clearing stale or no existing suggestions');
      this.clearSuggestions();
    } else {
      console.log('[EnhancedProactiveService] Keeping recent suggestions to avoid race condition');
    }

    // Create new abort controller for this generation
    this.currentGenerationController = new AbortController();
    const generationId = Date.now(); // Unique ID for this generation
    
    console.log('[EnhancedProactiveService] Starting suggestion generation with ID:', generationId);

    try {
      // Check if generation was cancelled before we start
      if (this.currentGenerationController.signal.aborted) {
        console.log('[EnhancedProactiveService] Generation cancelled before starting');
        return;
      }

      // First, check if any trigger rules are activated
      const workspaceName = localStorage.getItem('webseek_workspace_name') || 'this project';
      const context = {
        instances: this.currentContext.instances || contextService.getInstances(),
        messages: this.currentContext.messages || contextService.getMessages(),
        htmlContexts: this.currentContext.htmlContexts || contextService.getHtmlContexts(),
        logs: logs,
        workspaceName: workspaceName
      };

      console.log('[EnhancedProactiveService] Using workspace context:', {
        workspaceName,
        instanceCount: context.instances.length,
        messageCount: context.messages.length,
        htmlContextCount: Object.keys(context.htmlContexts).length
      });

      const triggeredRules = triggerEngine.checkTriggers(context);
      console.log('[EnhancedProactiveService] Triggered rules:', triggeredRules.map(r => ({id: r.id, scope: r.scope, priority: r.priority})));

      // If no rules are triggered, don't generate suggestions
      if (triggeredRules.length === 0) {
        console.log('[EnhancedProactiveService] No trigger rules activated, skipping AI suggestions');
        return;
      }

      // Check if generation was cancelled after rule checking
      if (this.currentGenerationController.signal.aborted) {
        console.log('[EnhancedProactiveService] Generation cancelled after rule checking');
        return;
      }

      // Get recent user actions from the action monitor
      const recentActions = actionMonitor.getRecentActions(30000); // Last 30 seconds
      console.log('[EnhancedProactiveService] Using', recentActions.length, 'recent actions from action monitor: ', recentActions);

      // Use provided context or get current context  
      const currentInstances = context.instances;
      const currentMessages = context.messages;
      const currentHtmlContexts = context.htmlContexts;

      // Check if we have enough context to make suggestions
      // For context-independent suggestions, we don't need HTML context
      const hasHtmlContextForBasicCheck = Object.keys(currentHtmlContexts).length > 0;
      const hasAnyContext = currentInstances.length > 0 || currentMessages.length > 0 || hasHtmlContextForBasicCheck;
      
      if (!hasAnyContext) {
        console.log('[EnhancedProactiveService] No context available (instances, messages, or HTML)');
        return; // Not enough context
      }
      
      // If no HTML context, check if we can proceed with context-independent rules
      if (!hasHtmlContextForBasicCheck) {
        const canProceedWithoutHtml = this.canGenerateSuggestionsWithoutHtmlContext();
        if (!canProceedWithoutHtml) {
          console.log('[EnhancedProactiveService] No HTML context and no context-independent rules available');
          return;
        }
        console.log('[EnhancedProactiveService] Proceeding with context-independent suggestions despite no HTML context');
      }

      // Generate instance and conversation context (excluding images for API efficiency)
      const { textContext } = await generateInstanceContext(currentInstances);
      const imageContext: any[] = []; // No images for suggestions to improve API efficiency

      // Check if generation was cancelled after context generation
      if (this.currentGenerationController.signal.aborted) {
        console.log('[EnhancedProactiveService] Generation cancelled after context generation');
        return;
      }

      // Determine suggestion scope based on triggered rules (not UI state)
      let microRules = triggeredRules.filter(r => r.scope === 'micro');
      let macroRules = triggeredRules.filter(r => r.scope === 'macro');
      
      // Check if HTML context is available and filter rules accordingly
      const hasHtmlContext = Object.keys(currentHtmlContexts).length > 0;
      
      if (!hasHtmlContext) {
        console.log('[EnhancedProactiveService] No HTML context available - filtering to context-independent rules only');
        
        // Define rules that don't require HTML context
        const contextIndependentRules = [
          'suggest-useful-websites',
          // 'workspace-organization',
          // 'cross-instance-analysis',
          // 'workflow-automation'
        ];
        
        // Filter rules to only include context-independent ones
        microRules = microRules.filter(r => contextIndependentRules.includes(r.id));
        macroRules = macroRules.filter(r => contextIndependentRules.includes(r.id));
        
        console.log('[EnhancedProactiveService] Context-independent filtering result:', {
          originalMicroRules: triggeredRules.filter(r => r.scope === 'micro').map(r => r.id),
          originalMacroRules: triggeredRules.filter(r => r.scope === 'macro').map(r => r.id),
          filteredMicroRules: microRules.map(r => r.id),
          filteredMacroRules: macroRules.map(r => r.id),
          contextIndependentRules
        });
      }
      
      console.log('[EnhancedProactiveService] Rule breakdown:', {
        totalTriggeredRules: triggeredRules.length,
        microRules: microRules.length,
        macroRules: macroRules.length,
        microRuleIds: microRules.map(r => r.id),
        macroRuleIds: macroRules.map(r => r.id),
        hasHtmlContext
      });
      
      // Check current UI context
      const isInTableEditor = this.isCurrentlyInEditorContext();
      const isInMainSidepanel = this.isCurrentlyInMainSidepanel();
      
      // Be more permissive with micro suggestions - generate them if:
      // 1. We have micro rules AND user is in table editor context, OR
      // 2. We have micro rules AND the interaction is relevant, OR
      // 3. We have micro rules and are NOT in main sidepanel (fallback for editor detection)
      // This ensures micro suggestions appear more reliably
      const shouldGenerateMicroSuggestions = microRules.length > 0 && (
        isInTableEditor || 
        this.isLatestInteractionRelevantForMicroSuggestions(recentActions, logs) ||
        !isInMainSidepanel  // Fallback: if not clearly in main sidepanel, allow micro suggestions
      );
      
      // Generate macro suggestions if:
      // 1. We have macro rules AND user is in main sidepanel (instance view), OR
      // 2. We have macro rules AND user is in table editor (for dual display)
      // This ensures macro suggestions appear in both main view and editor view
      const shouldGenerateMacroSuggestions = macroRules.length > 0 && (
        isInMainSidepanel || isInTableEditor
      );
      
      console.log('[EnhancedProactiveService] Suggestion generation decision:', {
        hasMicroRules: microRules.length > 0,
        microRuleIds: microRules.map(r => r.id),
        hasMacroRules: macroRules.length > 0,
        macroRuleIds: macroRules.map(r => r.id),
        isInTableEditor: isInTableEditor,
        isInMainSidepanel: isInMainSidepanel,
        isInteractionRelevant: this.isLatestInteractionRelevantForMicroSuggestions(recentActions, logs),
        shouldGenerateMicroSuggestions: shouldGenerateMicroSuggestions,
        shouldGenerateMacroSuggestions: shouldGenerateMacroSuggestions,
        activeElement: document.activeElement?.tagName,
        activeElementClasses: document.activeElement?.className,
        latestLog: logs[logs.length - 1]?.slice(0, 100)
      });
      
      // Process micro and macro suggestions COMPLETELY SEPARATELY
      // Each has its own generation, state management, and display process
      
      // === MICRO SUGGESTION PROCESS (independent) ===
      if (shouldGenerateMicroSuggestions) {
        console.log('[EnhancedProactiveService] === STARTING MICRO SUGGESTION PROCESS ===');
        await this.generateAndDisplayMicroSuggestions(microRules, recentActions, logs, context, currentMessages, textContext, imageContext, currentHtmlContexts);
      } else if (microRules.length > 0) {
        console.log('[EnhancedProactiveService] Micro rules available but conditions not met:', {
          microRuleIds: microRules.map(r => r.id),
          latestLog: logs[logs.length - 1]?.slice(0, 100),
          latestActionType: recentActions[recentActions.length - 1]?.type,
          reason: !isInTableEditor ? 'not in table editor' : 'interaction not relevant'
        });
      }
      
      // === MACRO SUGGESTION PROCESS (independent) ===
      if (shouldGenerateMacroSuggestions) {
        console.log('[EnhancedProactiveService] === STARTING MACRO SUGGESTION PROCESS ===');
        await this.generateAndDisplayMacroSuggestions(macroRules, recentActions, logs, context, currentMessages, textContext, imageContext, currentHtmlContexts);
      } else if (macroRules.length > 0) {
        console.log('[EnhancedProactiveService] Macro rules available but conditions not met:', {
          macroRuleIds: macroRules.map(r => r.id),
          isInTableEditor: isInTableEditor,
          isInMainSidepanel: isInMainSidepanel,
          reason: (!isInMainSidepanel && !isInTableEditor) ? 'not in main sidepanel or table editor' : 'other conditions not met'
        });
      }

      console.log('[EnhancedProactiveService] Completed suggestion generation with ID:', generationId);

    } catch (error) {
      if (typeof error === 'object' && error !== null && 'name' in error && (error as any).name === 'AbortError') {
        console.log('[EnhancedProactiveService] Suggestion generation was aborted (ID:', generationId, ')');
      } else {
        console.error('[EnhancedProactiveService] Error in AI suggestion generation:', error);
      }
    } finally {
      this.currentGenerationController = null;
    }
  }

  /**
   * Check if two table cell arrays have similar content (helper for redundancy detection)
   */
  private areTableContentsSimilar(currentCells: any[][], suggestedCells: any[][]): boolean {
    if (currentCells.length !== suggestedCells.length) return false;
    
    for (let i = 0; i < currentCells.length; i++) {
      const currentRow = currentCells[i] || [];
      const suggestedRow = suggestedCells[i] || [];
      
      if (currentRow.length !== suggestedRow.length) return false;
      
      for (let j = 0; j < currentRow.length; j++) {
        const currentCell = currentRow[j];
        const suggestedCell = suggestedRow[j];
        
        // Compare cell content (could be text, image, etc.)
        if (currentCell?.content !== suggestedCell?.content || 
            currentCell?.src !== suggestedCell?.src ||
            currentCell?.type !== suggestedCell?.type) {
          return false; // Found a meaningful difference
        }
      }
    }
    
    return true; // Tables are essentially identical
  }

  /**
   * Generate and display micro suggestions independently
   */
  private async generateAndDisplayMicroSuggestions(
    microRules: any[], 
    recentActions: any[], 
    logs: string[], 
    context: any, 
    currentMessages: any[], 
    textContext: string, 
    imageContext: any[], 
    currentHtmlContexts: Record<string, any>
  ) {
    console.log('[EnhancedProactiveService] Generating micro suggestions for rules:', microRules.map(r => r.id));
    
    try {
      const suggestionScope = 'micro';
      const enhancedPrompt = createRuleBasedSuggestionPrompt(suggestionScope, microRules, recentActions, logs, this.suggestionHistory, context.workspaceName);
      
      let result;
      if (import.meta.env.WXT_USE_LLM == "true") {
        result = await this.chatWithAgentAbortable(
          'suggest',
          enhancedPrompt,
          currentMessages,
          textContext,
          imageContext,
          currentHtmlContexts,
          logs,
          this.currentGenerationController?.signal
        );
      } else {
        result = await this.chatWithAgentAbortable(
          'suggest',
          enhancedPrompt,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          this.currentGenerationController?.signal
        );
      }

      // Check if generation was cancelled
      if (this.currentGenerationController?.signal.aborted) {
        console.log('[EnhancedProactiveService] Micro suggestion generation was cancelled');
        return;
      }

      if ((result.instances && result.instances.length > 0) || (result.suggestions && result.suggestions.length > 0)) {
        const microSuggestions = this.createSuggestionsFromAIResult(result, suggestionScope, microRules);
        
        if (microSuggestions.length > 0) {
          console.log('[EnhancedProactiveService] Generated', microSuggestions.length, 'micro suggestions - processing independently');
          
          // Add to current suggestions
          this.addSuggestions(microSuggestions);
          this.suggestionCount += microSuggestions.length;
          
          // Display micro suggestions immediately and independently
          console.log('[EnhancedProactiveService] Displaying micro suggestions independently');
          this.displaySuggestions(microSuggestions);
          
          // Update UI state for micro suggestions only
          if (this.onSuggestionsUpdated) {
            this.onSuggestionsUpdated(this.currentSuggestions);
          }
        }
      }
    } catch (error) {
      console.error('[EnhancedProactiveService] Error in micro suggestion generation:', error);
    }
  }

  /**
   * Generate and display macro suggestions independently
   */
  private async generateAndDisplayMacroSuggestions(
    macroRules: any[], 
    recentActions: any[], 
    logs: string[], 
    context: any, 
    currentMessages: any[], 
    textContext: string, 
    imageContext: any[], 
    currentHtmlContexts: Record<string, any>
  ) {
    console.log('[EnhancedProactiveService] Generating macro suggestions for rules:', macroRules.map(r => r.id));
    
    try {
      const suggestionScope = 'macro';
      const enhancedPrompt = createRuleBasedSuggestionPrompt(suggestionScope, macroRules, recentActions, logs, this.suggestionHistory, context.workspaceName);
      
      let result;
      if (import.meta.env.WXT_USE_LLM == "true") {
        result = await this.chatWithAgentAbortable(
          'suggest',
          enhancedPrompt,
          currentMessages,
          textContext,
          imageContext,
          currentHtmlContexts,
          logs,
          this.currentGenerationController?.signal
        );
      } else {
        result = await this.chatWithAgentAbortable(
          'suggest',
          enhancedPrompt,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          this.currentGenerationController?.signal
        );
      }

      // Check if generation was cancelled
      if (this.currentGenerationController?.signal.aborted) {
        console.log('[EnhancedProactiveService] Macro suggestion generation was cancelled');
        return;
      }

      if ((result.instances && result.instances.length > 0) || (result.suggestions && result.suggestions.length > 0)) {
        const macroSuggestions = this.createSuggestionsFromAIResult(result, suggestionScope, macroRules);
        
        if (macroSuggestions.length > 0) {
          console.log('[EnhancedProactiveService] Generated', macroSuggestions.length, 'macro suggestions - processing independently');
          
          // Ensure macro suggestions are peripheral
          macroSuggestions.forEach(suggestion => {
            suggestion.modality = 'peripheral';
          });
          
          // Add to current suggestions
          this.addSuggestions(macroSuggestions);
          this.suggestionCount += macroSuggestions.length;
          
          // Display macro suggestions immediately and independently
          console.log('[EnhancedProactiveService] Displaying macro suggestions independently');
          this.displaySuggestions(macroSuggestions);
          
          // Update UI state for macro suggestions only
          if (this.onSuggestionsUpdated) {
            this.onSuggestionsUpdated(this.currentSuggestions);
          }
        }
      }
    } catch (error) {
      console.error('[EnhancedProactiveService] Error in macro suggestion generation:', error);
    }
  }

  /**
   * Check if the latest user interaction is relevant for micro suggestions
   * Skip micro suggestions if the latest action is irrelevant (like renaming)
   * BUT be more permissive when user is actively in an editor context
   */
  private isLatestInteractionRelevantForMicroSuggestions(recentActions: any[], logs: string[]): boolean {
    // Get the most recent action/log
    const latestLog = logs.length > 0 ? logs[logs.length - 1] : '';
    const latestAction = recentActions.length > 0 ? recentActions[recentActions.length - 1] : null;
    
    // Check if user is currently in an editor context
    const isInEditorContext = this.isCurrentlyInEditorContext();
    
    // If user is in editor context, be very permissive with micro suggestions
    // This ensures micro suggestions appear when users are actively working with data
    if (isInEditorContext) {
      console.log('[EnhancedProactiveService] User in editor context - being very permissive with micro suggestions');
      
      // Only skip for workspace-level actions that don't relate to content editing
      const veryIrrelevantPatterns = [
        /workspace.*title/i,
        /workspace.*name/i,
        /navigation.*between.*views/i,
        /opened.*menu/i,
        /closed.*menu/i
      ];
      
      const isVeryIrrelevant = veryIrrelevantPatterns.some(pattern => pattern.test(latestLog)) ||
        (latestAction && (
          latestAction.type?.includes('workspace-title') ||
          latestAction.type?.includes('workspace-name') ||
          latestAction.type?.includes('navigation-menu') ||
          latestAction.context?.type?.includes('workspace-ui')
        ));
      
      // Return true (relevant) unless it's very irrelevant
      return !isVeryIrrelevant;
    }
    
    // Original logic for non-editor contexts
    // Define irrelevant interactions that should not trigger micro suggestions
    const irrelevantPatterns = [
      /rename/i,
      /renamed/i,
      /naming/i,
      /name.*changed/i,
      /workspace.*title/i,
      /workspace.*name/i,
      /moved.*instance/i,
      /deleted.*instance/i,
      /context.*menu/i,
      /opened.*menu/i,
      /closed.*menu/i,
      /navigation/i,
      /switched.*view/i,
      /toggled/i
    ];
    
    // Check if latest log contains irrelevant patterns
    const isLatestLogIrrelevant = irrelevantPatterns.some(pattern => pattern.test(latestLog));
    
    // Check if latest action is irrelevant
    const isLatestActionIrrelevant = latestAction && (
      latestAction.type?.includes('rename') ||
      latestAction.type?.includes('title') ||
      latestAction.type?.includes('name') ||
      latestAction.type?.includes('move') ||
      latestAction.type?.includes('delete') ||
      latestAction.type?.includes('menu') ||
      latestAction.type?.includes('navigation') ||
      latestAction.context?.type?.includes('rename') ||
      latestAction.context?.type?.includes('ui-interaction')
    );
    
    // Also check if the user just started or ended an editing session (transitional actions)
    const isTransitionalAction = latestLog.includes('Opened') || latestLog.includes('Closed') || 
                                 latestLog.includes('Started') || latestLog.includes('Ended') ||
                                 latestLog.includes('Switched') || latestLog.includes('Changed');
    
    // Check if the action is too recent (avoid over-eagerness)
    const actionTimestamp = latestAction?.timestamp || 0;
    const isActionTooRecent = actionTimestamp > 0 && (Date.now() - actionTimestamp < 500); // Less than 500ms ago
    
    // Check if we're in a rapid-fire sequence of actions (typing, rapid clicks, etc.)
    const recentActionTypes = recentActions.slice(-3).map(a => a.type);
    const isRapidSequence = recentActionTypes.length >= 3 && 
                           recentActionTypes.every(type => type === recentActionTypes[0]);
    
    console.log('[EnhancedProactiveService] Latest interaction relevance check:', {
      latestLog: latestLog.slice(0, 100),
      latestActionType: latestAction?.type,
      isLatestLogIrrelevant,
      isLatestActionIrrelevant,
      isTransitionalAction,
      isActionTooRecent,
      isRapidSequence,
      isRelevant: !isLatestLogIrrelevant && !isLatestActionIrrelevant && !isTransitionalAction && !isActionTooRecent && !isRapidSequence
    });
    
    // Return false if any condition makes it irrelevant
    return !isLatestLogIrrelevant && !isLatestActionIrrelevant && !isTransitionalAction && !isActionTooRecent && !isRapidSequence;
  }

  /**
   * Determine if user is currently in interface view (for macro suggestions) or editor view (for micro suggestions)
   */
  private isCurrentlyInInterfaceView(): boolean {
    // Check if the user is currently in the main interface view vs an editor
    // This is a heuristic based on active elements and UI state
    const activeElement = document.activeElement;
    
    // Check for table editor specifically
    const isInTableEditor = activeElement && (
      activeElement.closest('.table-editor') ||
      activeElement.closest('[class*="table"]') ||
      activeElement.closest('[class*="editor"]') ||
      activeElement.closest('.cell') ||
      activeElement.closest('[class*="cell"]')
    );
    
    // Check for general editors
    const isInEditor = activeElement && (
      activeElement.classList.contains('editor') ||
      activeElement.closest('.editor') ||
      activeElement.tagName === 'TEXTAREA' ||
      activeElement.tagName === 'INPUT' ||
      (activeElement as HTMLElement).contentEditable === 'true' ||
      activeElement.closest('[contenteditable="true"]')
    );
    
    // If user is in table editor or any other editor, they should get micro suggestions
    // Otherwise, they're in interface view and should get macro suggestions
    const isInAnyEditor = isInTableEditor || isInEditor;
    
    console.log('[EnhancedProactiveService] Context detection:', {
      activeElement: activeElement?.tagName,
      activeElementClass: activeElement?.className,
      isInTableEditor,
      isInEditor,
      isInAnyEditor,
      willUseMacroSuggestions: !isInAnyEditor
    });
    
    return !isInAnyEditor;
  }

  /**
   * Determine if user is currently in an editor context (for micro suggestion relevance)
   */
  private isCurrentlyInEditorContext(): boolean {
    const activeElement = document.activeElement;
    
    // Check for table editor specifically
    const isInTableEditor = activeElement && (
      activeElement.closest('.table-editor') ||
      activeElement.closest('[class*="table"]') ||
      activeElement.closest('[class*="editor"]') ||
      activeElement.closest('.cell') ||
      activeElement.closest('[class*="cell"]')
    );
    
    // Check for general editors
    const isInEditor = activeElement && (
      activeElement.classList.contains('editor') ||
      activeElement.closest('.editor') ||
      activeElement.tagName === 'TEXTAREA' ||
      activeElement.tagName === 'INPUT' ||
      (activeElement as HTMLElement).contentEditable === 'true' ||
      activeElement.closest('[contenteditable="true"]')
    );
    
    return !!(isInTableEditor || isInEditor);
  }

  /**
   * Determine if user is currently in the main sidepanel (instance view, not in editor)
   */
  private isCurrentlyInMainSidepanel(): boolean {
    // Check if we're NOT in an editor context and we're in the sidepanel
    const isInEditor = this.isCurrentlyInEditorContext();
    
    // Check if we're in the main sidepanel interface
    const sidepanelElements = [
      '.instance-view',
      '.sidepanel',
      '.instance-container',
      '[class*="instance"]',
      '.main-view'
    ];
    
    const isInSidepanel = sidepanelElements.some(selector => {
      const element = document.querySelector(selector);
      return element && element.contains(document.activeElement || document.body);
    });
    
    // We're in main sidepanel if we're in sidepanel but not in editor
    return !isInEditor && isInSidepanel;
  }

  /**
   * Determine if suggestions can be generated without HTML context
   * Some suggestion types (like workspace-based suggestions) don't need current page HTML
   */
  private canGenerateSuggestionsWithoutHtmlContext(): boolean {
    // Get workspace name from localStorage like other parts of the codebase
    const workspaceName = localStorage.getItem('webseek_workspace_name') || 'this project';
    
    // Get current context for rule checking
    const context = {
      instances: this.currentContext.instances,
      messages: this.currentContext.messages,
      workspaceName: workspaceName,
      htmlContexts: {}, // Empty for context-independent rules
    };

    // Get recent actions for rule evaluation
    const recentActions = actionMonitor.getRecentActions(20);
    
    // Check which rules are triggered
    const triggeredRules = triggerEngine.checkTriggers(context);
    
    // Define rules that don't require HTML context
    const contextIndependentRules = [
      'suggest-useful-websites',
      'workspace-organization',
      'cross-instance-analysis',
      'workflow-automation'
    ];
    
    // Check if any triggered rules are context-independent
    const hasContextIndependentRules = triggeredRules.some(rule => 
      contextIndependentRules.includes(rule.id)
    );
    
    console.log('[EnhancedProactiveService] Context-independent rule check:', {
      triggeredRuleIds: triggeredRules.map(r => r.id),
      contextIndependentRules,
      hasContextIndependentRules,
      workspaceName: context.workspaceName
    });
    
    return hasContextIndependentRules;
  }

  /**
   * Create enhanced prompt with embedded heuristic rules for the LLM
   */
  private createEnhancedSuggestionPrompt(scope: string, recentActions: any[], logs: string[]): string {
    const rulesContext = this.getRelevantRulesForScope(scope);
    
    return `
You are WebSeek's proactive AI assistant. Your task is to analyze the user's recent actions and current context to provide intelligent ${scope} suggestions.

**CURRENT SCOPE: ${scope.toUpperCase()}**
${scope === 'macro' ? '- Focus on high-level workflow improvements, multi-instance operations, and interface-wide suggestions' : '- Focus on immediate, contextual improvements within the current editing context (e.g., table editor, cell operations)'}

**CONTEXT DETECTION:**
${scope === 'micro' ? 'User is currently in an editor (likely table editor). Focus on cell-level operations, data entry patterns, and immediate editing assistance.' : 'User is in the main interface view. Focus on workflow-level suggestions and multi-instance operations.'}

**EMBEDDED HEURISTIC RULES:**
You must evaluate the following rules and ONLY provide suggestions when at least one rule is satisfied:

${rulesContext}

**RECENT USER ACTIONS:**
${recentActions.length > 0 ? recentActions.map((action, i) => `${i + 1}. ${action.type}: ${JSON.stringify(action.context)}`).join('\n') : 'No recent actions'}

**RECENT LOGS:**
${logs.slice(-10).join('\n')}

**INSTRUCTIONS:**
1. Analyze the recent actions and logs against the embedded rules above
2. If NO rules are satisfied, return {"success": true, "message": "No suggestions needed", "instances": []}
3. If one or more rules ARE satisfied, generate appropriate suggestions with:
   - Clear, actionable message explaining what the suggestion does
   - Specific instance operations that implement the suggestion
   - Proper scope and modality settings
   ${scope === 'micro' ? '- For micro suggestions: Focus on immediate, actionable improvements to the current editing task' : '- For macro suggestions: Focus on workflow improvements and multi-instance operations'}

**RESPONSE FORMAT:**
Return strictly JSON with this structure:
{
  "success": boolean,
  "error_message"?: string,
  "message": string,
  "instances": InstanceEvent[],
  "suggestions": [{
    "message": string,
    "scope": "${scope}",
    "modality": "${scope === 'macro' ? 'peripheral' : 'in-situ'}",
    "priority": "high|medium|low",
    "confidence": number, // 0.0 to 1.0
    "category": string,
    "ruleIds": string[] // Which rules triggered this suggestion
  }]
}

Analyze the context and provide intelligent suggestions based on the satisfied rules.`;
  }

  /**
   * Get relevant heuristic rules for the given scope
   */
  private getRelevantRulesForScope(scope: string): string {
    if (scope === 'micro') {
      return `
**MICRO RULES (Editor/Local Context):**
1. **Batch Element Selection**: If user has selected 2+ similar elements from web content, suggest selecting all similar elements
2. **Schema Inference**: If table has blank headers, suggest auto-naming columns based on content
3. **Row/Column Autocomplete**: If user has filled 2+ cells with a pattern, suggest completing the pattern for remaining cells
4. **Computed Columns**: If table has numeric columns with mathematical relationships, suggest computed columns
5. **Data Type Correction**: If cells contain mixed data types, suggest cleaning/standardizing the data
6. **Entity Normalization**: If similar entities have different formats, suggest normalization
7. **Character Removal**: If text contains unwanted characters repeatedly, suggest batch removal
8. **Web Content Extraction**: If user has captured 2+ similar items from web content into table cells, suggest extracting all similar items from the page
9. **Cell Pattern Detection**: If user has entered similar data in adjacent cells, suggest auto-completing the pattern
10. **Table Data Enhancement**: If table cells contain partial information that can be enhanced from web context, suggest completion
`;
    } else {
      return `
**MACRO RULES (Interface/Workflow Level):**
1. **Table Join Suggestions**: If multiple tables share common columns, suggest joining them
2. **Visualization Recommendations**: If data is suitable for charts, suggest appropriate visualizations
3. **Better Chart Suggestions**: If current visualization can be improved, suggest better alternatives
4. **Data Completion**: If datasets have missing information that can be inferred, suggest completion
5. **Workflow Optimization**: If repetitive actions are detected, suggest automation or shortcuts
6. **Cross-Instance Operations**: If patterns exist across multiple instances, suggest bulk operations
7. **Data Pipeline Suggestions**: If data flow can be optimized, suggest pipeline improvements
8. **Export/Format Suggestions**: If data is ready for specific output formats, suggest export options
9. **Multi-Table Operations**: If multiple tables can be combined or compared, suggest operations
10. **Instance Organization**: If instances can be better organized or grouped, suggest improvements
`;
    }
  }

  /**
   * Create ProactiveSuggestion objects from AI result with strict validation
   */
  private createSuggestionsFromAIResult(result: any, scope: string, triggeredRules?: any[]): ProactiveSuggestion[] {
    console.log('[EnhancedProactiveService] createSuggestionsFromAIResult called with:', {
      scope,
      hasResultSuggestions: result.suggestions && Array.isArray(result.suggestions),
      resultSuggestionsCount: result.suggestions?.length || 0,
      hasResultInstances: result.instances && Array.isArray(result.instances),
      resultInstancesCount: result.instances?.length || 0,
      triggeredRuleIds: triggeredRules?.map(r => r.id) || [],
      result: result
    });
    
    const suggestions: ProactiveSuggestion[] = [];
    const triggeredRuleIds = triggeredRules?.map(r => r.id) || [];
    
    // Validate the AI response follows our rules
    if (result.suggestions && Array.isArray(result.suggestions)) {
      console.log('[EnhancedProactiveService] Processing', result.suggestions.length, 'AI suggestions');
      
      result.suggestions.forEach((aiSuggestion: any, index: number) => {
        // STRICT VALIDATION: Check if suggestion follows triggered rules
        const suggestedRuleIds = aiSuggestion.ruleIds || [];
        const hasValidRuleId = suggestedRuleIds.some((ruleId: string) => triggeredRuleIds.includes(ruleId));
        
        // STRICT VALIDATION: Check if scope matches
        const scopeMatches = aiSuggestion.scope === scope;
        
        // STRICT VALIDATION: Check if category matches triggered rules
        const categoryMatches = triggeredRuleIds.includes(aiSuggestion.category);
        
        // STRICT VALIDATION: Check for redundant table suggestions
        let isRedundantTableSuggestion = false;
        if (result.instances && result.instances.length > 0) {
          const updateInstance = result.instances.find((inst: any) => inst.action === 'update');
          if (updateInstance && updateInstance.instance?.type === 'table') {
            // Check if this table suggestion is meaningful
            const suggestedTable = updateInstance.instance;
            // Get current table from context to compare
            const currentInstances = this.currentContext.instances || [];
            const currentTable = currentInstances.find(inst => inst.id === updateInstance.targetId);
            
            if (currentTable && currentTable.type === 'table') {
              // Compare table structure and content
              const currentCells = (currentTable as any).cells || [];
              const suggestedCells = suggestedTable.cells || [];
              
              // Check if tables are identical
              const tablesIdentical = JSON.stringify(currentCells) === JSON.stringify(suggestedCells);
              const sameRowCount = currentCells.length === suggestedCells.length;
              const sameColCount = (currentCells[0]?.length || 0) === (suggestedCells[0]?.length || 0);
              
              if (tablesIdentical || (sameRowCount && sameColCount && this.areTableContentsSimilar(currentCells, suggestedCells))) {
                isRedundantTableSuggestion = true;
                console.warn('[EnhancedProactiveService] REJECTING redundant table suggestion - no meaningful changes detected');
              }
            }
          }
        }
        
        console.log('[EnhancedProactiveService] Validating AI suggestion:', {
          index,
          expectedScope: scope,
          actualScope: aiSuggestion.scope,
          scopeMatches,
          triggeredRuleIds,
          suggestedRuleIds,
          hasValidRuleId,
          category: aiSuggestion.category,
          categoryMatches,
          isRedundantTableSuggestion,
          isValid: hasValidRuleId && scopeMatches && categoryMatches && !isRedundantTableSuggestion
        });
        
        // Only accept suggestions that follow our triggered rules and aren't redundant
        if (!hasValidRuleId || !scopeMatches || !categoryMatches || isRedundantTableSuggestion) {
          console.warn('[EnhancedProactiveService] REJECTING AI suggestion:', {
            message: aiSuggestion.message?.slice(0, 100),
            expectedScope: scope,
            actualScope: aiSuggestion.scope,
            expectedRuleIds: triggeredRuleIds,
            actualRuleIds: suggestedRuleIds,
            category: aiSuggestion.category,
            reason: !hasValidRuleId ? 'invalid rule ID' : !scopeMatches ? 'wrong scope' : !categoryMatches ? 'wrong category' : 'redundant table suggestion'
          });
          return; // Skip this suggestion
        }
        
        const suggestion: ProactiveSuggestion = {
          id: `ai-suggestion-${Date.now()}-${index}`,
          message: aiSuggestion.message || result.message || 'Apply suggested changes',
          instances: scope === 'macro' ? [] : (result.instances || []), // Macro suggestions should not have instances
          scope: scope as any,
          modality: scope === 'macro' ? 'peripheral' : 'in-situ',
          priority: aiSuggestion.priority || 'medium',
          confidence: aiSuggestion.confidence || 0.7,
          category: aiSuggestion.category || 'general',
          timestamp: Date.now(),
          undoable: scope === 'micro', // Only micro suggestions are undoable since they modify instances
          toolCall: aiSuggestion.toolCall, // Include tool call for macro suggestions
          toolSequence: aiSuggestion.toolSequence // Include tool sequence for composite macro suggestions
        };
        
        // Use the validated ruleIds
        (suggestion as any).ruleIds = suggestedRuleIds;
        
        console.log('[EnhancedProactiveService] ACCEPTED AI suggestion:', {
          id: suggestion.id,
          message: suggestion.message.slice(0, 100),
          scope: suggestion.scope,
          modality: suggestion.modality,
          category: suggestion.category,
          ruleIds: (suggestion as any).ruleIds
        });
        suggestions.push(suggestion);
      });
    } else {
      console.log('[EnhancedProactiveService] No structured suggestions in result');
      // For fallback suggestions, only create them if we have instances and they make sense
      if (result.instances && result.instances.length > 0 && triggeredRules && triggeredRules.length > 0) {
        console.log('[EnhancedProactiveService] Creating fallback suggestion from instances');
        const suggestion: ProactiveSuggestion = {
          id: `ai-suggestion-${Date.now()}`,
          message: result.message || 'Apply suggested changes',
          instances: result.instances,
          scope: scope as any,
          modality: scope === 'macro' ? 'peripheral' : 'in-situ',
          priority: 'medium',
          confidence: 0.7,
          category: triggeredRules[0].id, // Use first triggered rule as category
          timestamp: Date.now(),
          undoable: true
        };
        
        (suggestion as any).ruleIds = triggeredRules.map(r => r.id);
        suggestions.push(suggestion);
      }
    }
    
    console.log('[EnhancedProactiveService] Returning', suggestions.length, 'validated suggestions');
    return suggestions;
  }

  /**
   * Generate suggestions using the original LLM-based system
   */
  private async generateLegacySuggestions(logs: string[]) {
    console.log('[EnhancedProactiveService] Using legacy LLM-based suggestions');

    // If the global env variable for proactive suggestions is disabled, skip generation
    if (import.meta.env.WXT_USE_PROACTIVE_SERVICE === "false") {
      console.log('[EnhancedProactiveService] LLM suggestions disabled by environment variable');
      return;
    }

    // Clear existing suggestions when starting new generation
    this.clearSuggestions();

    this.currentGenerationController = new AbortController();

    try {
      // Use provided context or get current context
      const currentInstances = this.currentContext.instances || contextService.getInstances();
      const currentMessages = this.currentContext.messages || contextService.getMessages();
      const currentHtmlContexts = this.currentContext.htmlContexts || contextService.getHtmlContexts();

      // Check if we have enough context to make suggestions
      // For context-independent suggestions, we don't need HTML context
      const hasHtmlContextForManualCheck = Object.keys(currentHtmlContexts).length > 0;
      const hasAnyContextForManual = currentInstances.length > 0 || currentMessages.length > 0 || hasHtmlContextForManualCheck;
      
      if (!hasAnyContextForManual) {
        console.log('[EnhancedProactiveService] No context available for manual suggestion (instances, messages, or HTML)');
        return; // Not enough context
      }
      
      // If no HTML context, check if we can proceed with context-independent rules
      if (!hasHtmlContextForManualCheck) {
        const canProceedWithoutHtml = this.canGenerateSuggestionsWithoutHtmlContext();
        if (!canProceedWithoutHtml) {
          console.log('[EnhancedProactiveService] No HTML context and no context-independent rules available for manual suggestion');
          return;
        }
        console.log('[EnhancedProactiveService] Proceeding with context-independent manual suggestions despite no HTML context');
      }

      // Generate instance and conversation context (excluding images for API efficiency)
      const { textContext } = await generateInstanceContext(currentInstances);
      const imageContext: any[] = []; // No images for suggestions to improve API efficiency

      console.log('[EnhancedProactiveService] Generating legacy LLM suggestions...');

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
          id: `legacy-suggestion-${Date.now()}`,
          message: result.message || 'Apply suggested changes',
          instances: result.instances,
          scope: 'macro', // Default to macro for legacy suggestions
          modality: 'peripheral', // Default to peripheral for legacy suggestions
          priority: 'medium',
          confidence: 0.7,
          category: 'general',
          timestamp: Date.now(),
          undoable: true
        };
        
        this.currentSuggestions = [suggestion];
        this.suggestionCount++;
        
        console.log('[EnhancedProactiveService] Generated legacy suggestion:', suggestion.message);
        
        // Display using UI controller for consistency
        this.displaySuggestions([suggestion]);
        
        // Notify listeners
        if (this.onSuggestionsUpdated) {
          this.onSuggestionsUpdated(this.currentSuggestions);
        }
      } else {
        console.log('[EnhancedProactiveService] No instance updates suggested by LLM');
      }

    } catch (error) {
      if (typeof error === 'object' && error !== null && 'name' in error && (error as any).name !== 'AbortError') {
        console.error('[EnhancedProactiveService] Error in legacy suggestion generation:', error);
      }
    } finally {
      this.currentGenerationController = null;
    }
  }





  /**
   * Display suggestions using the appropriate UI modality with enhanced targeting
   * Note: Macro suggestions are now handled by the MacroSuggestionPanel.tsx component
   * and will be passed through the React state system rather than the UI controller
   * Micro suggestions only show ghost previews, not suggestion messages
   */
  private displaySuggestions(suggestions: ProactiveSuggestion[]) {
    console.log('[EnhancedProactiveService] Displaying', suggestions.length, 'suggestions:', 
      suggestions.map(s => ({id: s.id, scope: s.scope, modality: s.modality, message: s.message.slice(0, 50)})));
    
    // Separate micro and macro suggestions for different handling
    const microSuggestions = suggestions.filter(s => s.scope === 'micro');
    const macroSuggestions = suggestions.filter(s => s.scope === 'macro');
    
    console.log('[EnhancedProactiveService] Separated suggestions:', {
      microCount: microSuggestions.length,
      macroCount: macroSuggestions.length
    });
    
    // Ensure macro suggestions are always peripheral
    macroSuggestions.forEach(suggestion => {
      suggestion.modality = 'peripheral';
    });
    
    // For micro suggestions: Only show ghost previews, no suggestion messages
    // The ghost instances are handled by the React component via currentSuggestion prop
    if (microSuggestions.length > 0) {
      console.log('[EnhancedProactiveService] Micro suggestions will be displayed as ghost previews only (no suggestion messages)');
      // No UI controller display for micro suggestions - handled by React ghost rendering
    }
    
    // Display macro suggestions in peripheral view
    if (macroSuggestions.length > 0) {
      console.log('[EnhancedProactiveService] Displaying', macroSuggestions.length, 'macro suggestions in peripheral view');
      try {
        suggestionUIController.displaySuggestions(macroSuggestions, {
          autoHide: false // Don't auto-hide macro suggestions
        });
      } catch (error) {
        console.error('[EnhancedProactiveService] Error displaying macro suggestions:', error);
      }
    }
    
    console.log('[EnhancedProactiveService] displaySuggestions completed');
  }

  /**
   * Get target element for in-situ suggestions with improved detection
   */
  private getTargetElementForSuggestions(): HTMLElement | undefined {
    const activeElement = document.activeElement as HTMLElement;
    
    console.log('[EnhancedProactiveService] Detecting target element, active:', {
      tagName: activeElement?.tagName,
      className: activeElement?.className,
      id: activeElement?.id
    });
    
    // Priority 1: Currently focused cell in table editor
    if (activeElement) {
      const cell = activeElement.closest('.cell') || 
                  activeElement.closest('[class*="cell"]') ||
                  activeElement.closest('td') ||
                  activeElement.closest('th');
      
      if (cell) {
        console.log('[EnhancedProactiveService] Found focused table cell:', cell.className);
        return cell as HTMLElement;
      }
    }
    
    // Priority 2: Table editor container
    const tableEditor = document.querySelector('.table-editor') || 
                       document.querySelector('[class*="table-editor"]') ||
                       document.querySelector('.MultiTableEditor');
    
    if (tableEditor) {
      console.log('[EnhancedProactiveService] Found table editor container:', tableEditor.className);
      return tableEditor as HTMLElement;
    }
    
    // Priority 3: Any active table on the page
    const activeTable = document.querySelector('table.active') ||
                       document.querySelector('[class*="table"].active') ||
                       document.querySelector('table');
    
    if (activeTable) {
      console.log('[EnhancedProactiveService] Found active table:', activeTable.className);
      return activeTable as HTMLElement;
    }
    
    // Priority 4: Currently active editor element
    if (activeElement) {
      const editor = activeElement.closest('.editor') || 
                    activeElement.closest('[class*="editor"]');
      
      if (editor) {
        console.log('[EnhancedProactiveService] Found editor element:', editor.className);
        return editor as HTMLElement;
      }
      
      // Check if active element itself is an input/textarea
      if (activeElement.tagName === 'INPUT' || 
          activeElement.tagName === 'TEXTAREA' ||
          (activeElement as HTMLElement).contentEditable === 'true') {
        console.log('[EnhancedProactiveService] Using active input element:', activeElement.tagName);
        return activeElement;
      }
    }
    
    // Priority 5: Main content area
    const mainContent = document.querySelector('.instance-view') ||
                       document.querySelector('[class*="content"]') ||
                       document.querySelector('main') ||
                       document.body;
    
    console.log('[EnhancedProactiveService] Using fallback content area:', mainContent?.className || 'body');
    return mainContent as HTMLElement;
  }

  /**
   * Handle suggestion acceptance
   */
  private async handleSuggestionAccepted(suggestion: ProactiveSuggestion) {
    console.log('[EnhancedProactiveService] Handling suggestion acceptance:', suggestion.id);
    
    try {
      // First, remove from current suggestions to prevent double-processing
      const initialCount = this.currentSuggestions.length;
      this.currentSuggestions = this.currentSuggestions.filter(s => s.id !== suggestion.id);
      console.log('[EnhancedProactiveService] Removed suggestion from queue. Count:', initialCount, '→', this.currentSuggestions.length);
      
      // Record suggestion acceptance in history for progressive suggestions
      if ((suggestion as any).ruleIds) {
        const ruleIds = (suggestion as any).ruleIds as string[];
        ruleIds.forEach(ruleId => {
          this.suggestionHistory.set(`${ruleId}-${Date.now()}`, {
            ruleId,
            level: this.determineSuggestionLevel(suggestion),
            acceptedAt: Date.now(),
            tableId: this.extractTableIdFromSuggestion(suggestion),
            suggestionType: suggestion.category || 'general'
          });
        });
        
        console.log('[EnhancedProactiveService] Updated suggestion history:', 
          Array.from(this.suggestionHistory.entries()));
      }

      // Record for undo if needed
      if (suggestion.undoable) {
        const previousState = contextService.getInstances();
        
        // Apply the suggestion operations
        if (suggestion.instances && suggestion.instances.length > 0) {
          // Always apply to context service first for data persistence
          console.log('[EnhancedProactiveService] Applying suggestion to context service');
          await this.handleInstanceOperations(suggestion.instances);
          
          // Also notify React component for UI updates
          if (this.onSuggestionAccepted) {
            console.log('[EnhancedProactiveService] Notifying React component via callback');
            this.onSuggestionAccepted(suggestion);
          }
          
          // Record for undo
          const currentState = contextService.getInstances();
          suggestionUndoManager.recordSuggestionApplication(
            suggestion,
            suggestion.instances,
            previousState,
            currentState
          );
        } else {
          // Handle macro suggestions without instances (like useful websites)
          await this.handleMacroSuggestionAction(suggestion);
        }
      }

      // Notify UI of the updated suggestions
      setTimeout(() => {
        if (this.onSuggestionsUpdated) {
          console.log('[EnhancedProactiveService] Notifying UI of suggestion acceptance');
          this.onSuggestionsUpdated(this.currentSuggestions);
        }
      }, 10); // Small delay to prevent React DOM conflicts
      
    } catch (error) {
      console.error('[EnhancedProactiveService] Error handling suggestion acceptance:', error);
    }
  }

  /**
   * Determine the level of suggestion from the accepted suggestion
   */
  private determineSuggestionLevel(suggestion: ProactiveSuggestion): 'row' | 'table' | 'full' {
    const message = suggestion.message.toLowerCase();
    
    if (message.includes('complete the current row') || message.includes('fill the row')) {
      return 'row';
    } else if (message.includes('complete the table') || message.includes('fill the table')) {
      return 'table';
    } else if (message.includes('all items') || message.includes('entire') || 
               message.includes('complete dataset') || message.includes('full extraction')) {
      return 'full';
    }
    
    // Default based on scope
    return suggestion.scope === 'macro' ? 'full' : 'row';
  }

  /**
   * Extract table ID from suggestion for tracking
   */
  private extractTableIdFromSuggestion(suggestion: ProactiveSuggestion): string | undefined {
    if (suggestion.instances && suggestion.instances.length > 0) {
      const firstInstance = suggestion.instances[0];
      if (firstInstance.action === 'update' && firstInstance.targetId) {
        return firstInstance.targetId;
      } else if (firstInstance.instance && firstInstance.instance.type === 'table') {
        return firstInstance.instance.id;
      }
    }
    return undefined;
  }

  /**
   * Handle macro suggestion actions that don't involve instance operations
   */
  private async handleMacroSuggestionAction(suggestion: ProactiveSuggestion) {
    console.log('[EnhancedProactiveService] Handling macro suggestion action:', {
      category: suggestion.category,
      id: suggestion.id,
      ruleIds: (suggestion as any).ruleIds,
      message: suggestion.message.slice(0, 100)
    });
    
    // Check if this is a useful websites suggestion
    const ruleIds = (suggestion as any).ruleIds as string[] || [];
    
    console.log('[EnhancedProactiveService] Checking website suggestion conditions:', {
      hasUsefulWebsitesRuleId: ruleIds.includes('suggest-useful-websites'),
      categoryIncludesResource: suggestion.category?.toLowerCase().includes('resource'),
      categoryIncludesWebsite: suggestion.category?.toLowerCase().includes('website'),
      exactCategory: suggestion.category,
      allRuleIds: ruleIds
    });
    
    if (ruleIds.includes('suggest-useful-websites') || 
        suggestion.category === 'suggest-useful-websites' ||
        suggestion.category?.toLowerCase().includes('resource') ||
        suggestion.category?.toLowerCase().includes('website')) {
      console.log('[EnhancedProactiveService] Detected useful websites suggestion - calling handler');
      await this.handleUsefulWebsitesSuggestion(suggestion);
    } else if (suggestion.category?.toLowerCase().includes('workflow')) {
      await this.handleWorkflowSuggestion(suggestion);
    } else {
      // Generic macro suggestion - just show a notification
      console.log('[EnhancedProactiveService] Applied macro suggestion (no specific handler):', suggestion.message);
      // You could add a toast notification here
    }
  }

  /**
   * Handle useful websites suggestions by displaying the message with clickable links
   * Users can click on the links they're interested in rather than auto-opening all
   */
  private async handleUsefulWebsitesSuggestion(suggestion: ProactiveSuggestion) {
    console.log('[EnhancedProactiveService] Processing useful websites suggestion - displaying as clickable message');
    
    // For website suggestions, we don't need to do anything special
    // The message already contains the formatted links that users can click
    // The suggestion will be displayed in the UI with the message content
    
    // Log the action for analytics
    actionMonitor.recordAction(
      'website-suggestion-displayed',
      { 
        suggestionId: suggestion.id, 
        messageLength: suggestion.message.length,
        hasLinks: suggestion.message.includes('http')
      },
      undefined,
      { suggestionId: suggestion.id, ruleIds: (suggestion as any).ruleIds }
    );
    
    console.log('[EnhancedProactiveService] Website suggestion will be displayed as clickable message in UI');
  }
  
  /**
   * Extract key terms from suggestion for search query generation
   */
  private extractKeyTermsFromSuggestion(suggestion: ProactiveSuggestion): string[] {
    const message = suggestion.message.toLowerCase();
    const keyTerms: string[] = [];
    
    // Try to extract context from current instances/data
    if (this.currentContext.instances && this.currentContext.instances.length > 0) {
      const instances = this.currentContext.instances;
      
      // Look for table content or data that might indicate the domain
      instances.forEach(instance => {
        if (instance.type === 'table' && (instance as any).content) {
          const tableData = JSON.stringify((instance as any).content).toLowerCase();
          
          // Extract potential product names, brands, or categories
          const productPatterns = [
            /[a-z]+\s+[a-z]+(?:\s+[a-z]+)?/g // Multi-word terms
          ];
          
          productPatterns.forEach(pattern => {
            const matches = tableData.match(pattern);
            if (matches) {
              keyTerms.push(...matches.slice(0, 3)); // Limit to first 3 matches
            }
          });
        }
      });
    }
    
    // Extract domain-relevant terms from the suggestion message itself
    const relevantWords = message.match(/\b[a-z]{4,}\b/g) || [];
    keyTerms.push(...relevantWords.slice(0, 3));
    
    // Remove common words and deduplicate
    const commonWords = ['this', 'that', 'with', 'have', 'will', 'from', 'they', 'been', 'have', 'their', 'said', 'each', 'which', 'some', 'what', 'were', 'take', 'than', 'many', 'well', 'more'];
    return [...new Set(keyTerms.filter(term => 
      term.length > 3 && !commonWords.includes(term.toLowerCase())
    ))].slice(0, 5); // Return top 5 unique terms
  }

  /**
   * Handle workflow suggestion actions
   */
  private async handleWorkflowSuggestion(suggestion: ProactiveSuggestion) {
    console.log('[EnhancedProactiveService] Processing workflow suggestion:', suggestion.message);
    // Implement workflow-specific actions here
    // For now, just log it
  }

  /**
   * Handle suggestion dismissal
   */
  private handleSuggestionDismissed(suggestion: ProactiveSuggestion) {
    console.log('[EnhancedProactiveService] Handling suggestion dismissal:', suggestion.id);
    this.dismissSuggestion(suggestion.id);
  }

  /**
   * Handle instance operations for undo/redo and direct application
   */
  private async handleInstanceOperations(operations: any[]) {
    console.log('[EnhancedProactiveService] Applying instance operations:', operations);
    
    // Apply operations to the context service
    for (const operation of operations) {
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

  // Legacy compatibility methods

  async acceptSuggestion(suggestionId: string): Promise<boolean> {
    console.log('[EnhancedProactiveService] Legacy acceptSuggestion called:', suggestionId);
    console.log('[EnhancedProactiveService] Current suggestions:', this.currentSuggestions.map(s => ({id: s.id, message: s.message.slice(0, 50)})));
    
    const suggestion = this.currentSuggestions.find(s => s.id === suggestionId);
    if (!suggestion) {
      console.log('[EnhancedProactiveService] Suggestion not found:', suggestionId);
      console.log('[EnhancedProactiveService] Available suggestion IDs:', this.currentSuggestions.map(s => s.id));
      return false;
    }

    await this.handleSuggestionAccepted(suggestion);
    return true;
  }

  dismissSuggestion(suggestionId: string) {
    console.log('[EnhancedProactiveService] Dismissing suggestion:', suggestionId);
    const beforeCount = this.currentSuggestions.length;
    this.currentSuggestions = this.currentSuggestions.filter(s => s.id !== suggestionId);
    const afterCount = this.currentSuggestions.length;
    
    if (beforeCount === afterCount) {
      console.log('[EnhancedProactiveService] Warning: Suggestion not found for dismissal:', suggestionId);
      console.log('[EnhancedProactiveService] Available suggestions:', this.currentSuggestions.map(s => s.id));
    } else {
      console.log('[EnhancedProactiveService] Successfully dismissed suggestion. Remaining:', afterCount);
    }
    
    if (this.onSuggestionsUpdated) {
      this.onSuggestionsUpdated(this.currentSuggestions);
    }
  }

  clearSuggestions() {
    if (this.currentSuggestions.length > 0) {
      console.log('[EnhancedProactiveService] Clearing', this.currentSuggestions.length, 'suggestions:', 
        this.currentSuggestions.map(s => s.id));
      this.currentSuggestions = [];
      
      try {
        suggestionUIController.clearAllSuggestions();
      } catch (error) {
        console.error('[EnhancedProactiveService] Error clearing UI suggestions:', error);
      }
      
      if (this.onSuggestionsUpdated) {
        this.onSuggestionsUpdated([]);
      }
    }
  }

  /**
   * Clear only micro suggestions, preserving macro suggestions
   * Used when ESC key is pressed - should only dismiss ghost previews, not macro suggestions
   */
  clearMicroSuggestions() {
    const microSuggestions = this.currentSuggestions.filter(s => s.scope === 'micro');
    const macroSuggestions = this.currentSuggestions.filter(s => s.scope === 'macro');
    
    if (microSuggestions.length > 0) {
      console.log('[EnhancedProactiveService] Clearing', microSuggestions.length, 'micro suggestions:', 
        microSuggestions.map(s => s.id));
      console.log('[EnhancedProactiveService] Preserving', macroSuggestions.length, 'macro suggestions:', 
        macroSuggestions.map(s => s.id));
      
      // Update current suggestions to only include macro suggestions
      this.currentSuggestions = macroSuggestions;
      
      try {
        // Clear all UI suggestions and re-display only macro suggestions
        suggestionUIController.clearAllSuggestions();
        if (macroSuggestions.length > 0) {
          suggestionUIController.displaySuggestions(macroSuggestions, {
            autoHide: false
          });
        }
      } catch (error) {
        console.error('[EnhancedProactiveService] Error clearing micro suggestions:', error);
      }
      
      // Update React state - this will remove ghost previews while keeping macro suggestions
      if (this.onSuggestionsUpdated) {
        this.onSuggestionsUpdated(this.currentSuggestions);
      }
    } else {
      console.log('[EnhancedProactiveService] No micro suggestions to clear');
    }
  }

  getCurrentSuggestions(): ProactiveSuggestion[] {
    return [...this.currentSuggestions];
  }

  // Debug method to check suggestion state
  debugSuggestionState(): any {
    return {
      currentSuggestions: this.currentSuggestions.map(s => ({
        id: s.id,
        message: s.message.slice(0, 100),
        timestamp: s.timestamp,
        age: Date.now() - s.timestamp
      })),
      isGenerating: this.isGenerating,
      suggestionCount: this.suggestionCount,
      isStopped: this.isSuggestionsStopped
    };
  }

  resetSession() {
    console.log('[EnhancedProactiveService] Resetting session');
    this.suggestionCount = 0;
    this.currentSuggestions = [];
    this.suggestionHistory.clear();
  }

  getSessionStats() {
    return {
      suggestionCount: this.suggestionCount,
      maxSuggestions: this.settings.maxSuggestionsPerSession,
      isAtLimit: this.suggestionCount >= this.settings.maxSuggestionsPerSession,
      suggestionHistorySize: this.suggestionHistory.size,
      recentSuggestions: Array.from(this.suggestionHistory.values()).slice(-5)
    };
  }

  /**
   * Handle debounced rule triggers
   */
  private async handleDebouncedRuleTrigger(rule: any) {
    try {
      console.log('[EnhancedProactiveService] Processing debounced rule:', rule.id, 'scope:', rule.scope);
      
      const workspaceName = localStorage.getItem('webseek_workspace_name') || 'this project';
      const context = {
        instances: this.currentContext.instances,
        messages: this.currentContext.messages,
        htmlContexts: this.currentContext.htmlContexts,
        logs: this.currentContext.logs,
        workspaceName: workspaceName
      };
      
      const recentActions = actionMonitor.getRecentActions(30000);
      
      // Use AI-driven generation for debounced rules too
      const suggestionScope = rule.scope || 'macro';
      const enhancedPrompt = createRuleBasedSuggestionPrompt(
        suggestionScope, 
        [rule], 
        recentActions, 
        this.currentContext.logs, 
        this.suggestionHistory, 
        workspaceName
      );
      
      console.log('[EnhancedProactiveService] Generating AI-driven suggestions for debounced rule:', rule.id);
      
      let result;
      if (import.meta.env.WXT_USE_LLM == "true") {
        // Generate instance and conversation context (excluding images for API efficiency)
        const { textContext } = await generateInstanceContext(context.instances);
        const imageContext: any[] = []; // No images for suggestions to improve API efficiency
        
        result = await this.chatWithAgentAbortable(
          'suggest',
          enhancedPrompt,
          context.messages,
          textContext,
          imageContext,
          context.htmlContexts,
          context.logs
        );
      } else {
        result = await this.chatWithAgentAbortable(
          'suggest',
          enhancedPrompt
        );
      }
      
      if (result && ((result.instances && result.instances.length > 0) || (result.suggestions && result.suggestions.length > 0))) {
        console.log('[EnhancedProactiveService] Debounced rule result:', {
          hasInstances: result.instances && result.instances.length > 0,
          instanceCount: result.instances?.length || 0,
          hasSuggestions: result.suggestions && result.suggestions.length > 0,
          suggestionCount: result.suggestions?.length || 0,
          result: result
        });
        
        const suggestions = this.createSuggestionsFromAIResult(result, suggestionScope, [rule]);
        
        console.log('[EnhancedProactiveService] Created suggestions from AI result:', suggestions.length, suggestions.map(s => ({id: s.id, message: s.message.slice(0, 100)})));
        
        if (suggestions.length > 0) {
          // Ensure macro suggestions are displayed in peripheral view
          if (suggestionScope === 'macro') {
            suggestions.forEach(suggestion => {
              suggestion.modality = 'peripheral';
            });
          }
          
          this.addSuggestions(suggestions);
          this.suggestionCount += suggestions.length;
          
          console.log('[EnhancedProactiveService] Generated', suggestions.length, 'AI-driven suggestions for debounced rule:', rule.id);
          
          // Display suggestions
          this.displaySuggestions(suggestions);
          
          // Notify listeners
          if (this.onSuggestionsUpdated) {
            console.log('[EnhancedProactiveService] Notifying UI of updated suggestions:', this.currentSuggestions.length, 'total suggestions');
            this.onSuggestionsUpdated(this.currentSuggestions);
          } else {
            console.log('[EnhancedProactiveService] Warning: No onSuggestionsUpdated callback registered');
          }
        }
      } else {
        console.log('[EnhancedProactiveService] No suggestions generated for debounced rule:', rule.id);
      }
    } catch (error) {
      console.error('[EnhancedProactiveService] Error handling debounced rule:', error);
    }
  }

  stopSuggestions(autoResumeOnNextInteraction = false) {
    console.log('[EnhancedProactiveService] Stopping suggestions', autoResumeOnNextInteraction ? '(will auto-resume)' : '');
    this.isSuggestionsStopped = true;
    this.shouldAutoResume = autoResumeOnNextInteraction;
    
    // Abort any ongoing generation
    if (this.currentGenerationController) {
      this.currentGenerationController.abort();
      this.currentGenerationController = null;
    }
    
    // Clear timers
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    
    this.clearSuggestions();
  }

  resumeSuggestions() {
    console.log('[EnhancedProactiveService] Resuming suggestions');
    this.isSuggestionsStopped = false;
    this.shouldAutoResume = false;
  }

  /**
   * Get undo manager for external access
   */
  getUndoManager() {
    return suggestionUndoManager;
  }

  /**
   * Get UI controller for external access
   */
  getUIController() {
    return suggestionUIController;
  }

  // Cleanup
  destroy() {
    console.log('[EnhancedProactiveService] Destroying service');
    
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    this.clearSuggestions();
    suggestionUIController.destroy();
    triggerEngine.destroy();
  }
}

// Export singleton instance
export const proactiveService = new EnhancedProactiveService();
export default proactiveService;