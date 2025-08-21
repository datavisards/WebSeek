/**
 * SuggestionUIController - Manages both In-Situ and Peripheral suggestion displays
 * Part of the enhanced proactive suggestion system
 */

import { ProactiveSuggestion } from './types';

export interface SuggestionDisplayOptions {
  targetElement?: HTMLElement;
  position?: { x: number; y: number };
  className?: string;
  autoHide?: boolean;
  hideDelayMs?: number;
}

export class SuggestionUIController {
  private inSituContainer: HTMLElement | null = null;
  private peripheralContainer: HTMLElement | null = null;
  private macroPanel: HTMLElement | null = null;
  private macroToggleButton: HTMLElement | null = null;
  private activeSuggestions: Map<string, HTMLElement> = new Map();

  constructor() {
    this.initializeContainers();
  }

  /**
   * Initialize UI containers for both modalities
   */
  private initializeContainers() {
    // Create in-situ overlay container
    this.inSituContainer = document.createElement('div');
    this.inSituContainer.id = 'suggestion-in-situ-overlay';
    this.inSituContainer.className = 'suggestion-overlay in-situ';
    this.inSituContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 10000;
    `;
    document.body.appendChild(this.inSituContainer);

    // Create peripheral notification area
    this.peripheralContainer = document.createElement('div');
    this.peripheralContainer.id = 'suggestion-peripheral-container';
    this.peripheralContainer.className = 'suggestion-container peripheral';
    this.peripheralContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 320px;
      max-height: 400px;
      overflow-y: auto;
      z-index: 9999;
      pointer-events: none;
    `;
    document.body.appendChild(this.peripheralContainer);

    // Macro panel functionality is now handled by MacroSuggestionPanel.tsx component
    // No need for DOM-based macro panel creation
    /*
    // Create macro suggestions panel (initially hidden)
    this.macroPanel = document.createElement('div');
    this.macroPanel.id = 'suggestion-macro-panel';
    this.macroPanel.className = 'suggestion-panel macro';
    this.macroPanel.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 400px;
      max-height: 300px;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
      z-index: 9998;
      transform: translateY(100%);
      transition: transform 0.3s ease-out;
      overflow: hidden;
    `;

    // Create macro panel header
    const macroHeader = document.createElement('div');
    macroHeader.className = 'macro-panel-header';
    macroHeader.style.cssText = `
      background: #f8fafc;
      border-bottom: 1px solid #e5e7eb;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    `;
    macroHeader.innerHTML = `
      <div style="display: flex; align-items: center;">
        <div style="
          width: 8px; 
          height: 8px; 
          border-radius: 50%; 
          background: #3b82f6;
          margin-right: 8px;
        "></div>
        <span style="font-weight: 600; color: #111827; font-size: 14px;">Macro Suggestions</span>
      </div>
      <button class="close-macro-panel" style="
        background: none;
        border: none;
        color: #6b7280;
        cursor: pointer;
        font-size: 16px;
        padding: 4px;
      ">×</button>
    `;

    // Create macro panel content
    const macroContent = document.createElement('div');
    macroContent.className = 'macro-panel-content';
    macroContent.style.cssText = `
      max-height: 240px;
      overflow-y: auto;
      padding: 0;
    `;

    this.macroPanel.appendChild(macroHeader);
    this.macroPanel.appendChild(macroContent);
    document.body.appendChild(this.macroPanel);

    // Create toggle button for macro panel
    this.macroToggleButton = document.createElement('button');
    this.macroToggleButton.id = 'macro-suggestions-toggle';
    this.macroToggleButton.className = 'macro-toggle-btn';
    this.macroToggleButton.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background: #3b82f6;
      border: none;
      color: white;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
      z-index: 9999;
      display: none;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      transition: all 0.2s ease;
    `;
    this.macroToggleButton.innerHTML = '💡';
    this.macroToggleButton.title = 'View macro suggestions';
    document.body.appendChild(this.macroToggleButton);

    // Add event listeners
    this.setupMacroPanelEventListeners();
    */
  }

  /**
   * Setup event listeners for macro panel interactions
   * Disabled - using MacroSuggestionPanel.tsx component instead
   */
  private setupMacroPanelEventListeners() {
    // Macro panel functionality moved to React component
    /*
    // Toggle panel visibility
    this.macroToggleButton?.addEventListener('click', () => {
      this.toggleMacroPanel();
    });

    // Close panel
    this.macroPanel?.querySelector('.close-macro-panel')?.addEventListener('click', () => {
      this.hideMacroPanel();
    });

    // Close panel when clicking outside
    document.addEventListener('click', (e) => {
      if (this.macroPanel && !this.macroPanel.contains(e.target as Node) && 
          this.macroToggleButton && !this.macroToggleButton.contains(e.target as Node)) {
        this.hideMacroPanel();
      }
    });
    */
  }

  /**
   * Display suggestions based on their modality and scope
   */
  displaySuggestions(
    suggestions: ProactiveSuggestion[],
    options: SuggestionDisplayOptions = {}
  ) {
    // Group suggestions by modality and scope
    const inSituSuggestions = suggestions.filter(s => s.modality === 'in-situ');
    const peripheralSuggestions = suggestions.filter(s => s.modality === 'peripheral' && s.scope !== 'macro');
    const macroSuggestions = suggestions.filter(s => s.scope === 'macro');

    // Display in-situ suggestions (typically micro suggestions)
    if (inSituSuggestions.length > 0) {
      this.displayInSituSuggestions(inSituSuggestions, options);
    }

    // Display peripheral suggestions (non-macro)
    if (peripheralSuggestions.length > 0) {
      this.displayPeripheralSuggestions(peripheralSuggestions, options);
    }

    // Display macro suggestions in dedicated panel (now handled by React component)
    if (macroSuggestions.length > 0) {
      console.log('[SuggestionUIController] Macro suggestions now handled by MacroSuggestionPanel.tsx component');
      // this.displayMacroSuggestions(macroSuggestions, options);
    }
  }

  /**
   * Display macro suggestions in the dedicated macro panel
   * Disabled - using MacroSuggestionPanel.tsx component instead
   */
  private displayMacroSuggestions(
    suggestions: ProactiveSuggestion[],
    options: SuggestionDisplayOptions
  ) {
    // Macro panel functionality moved to React component
    console.log('[SuggestionUIController] displayMacroSuggestions disabled - using React component');
    return;
    /*
    if (!this.macroPanel) return;

    const macroContent = this.macroPanel.querySelector('.macro-panel-content');
    if (!macroContent) return;

    // Clear existing macro suggestions
    macroContent.innerHTML = '';

    // Show toggle button if we have macro suggestions
    if (this.macroToggleButton) {
      this.macroToggleButton.style.display = 'flex';
      
      // Add badge with suggestion count
      const badge = this.macroToggleButton.querySelector('.suggestion-count');
      if (badge) {
        badge.remove();
      }
      
      const countBadge = document.createElement('div');
      countBadge.className = 'suggestion-count';
      countBadge.style.cssText = `
        position: absolute;
        top: -5px;
        right: -5px;
        background: #ef4444;
        color: white;
        border-radius: 50%;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: bold;
      `;
      countBadge.textContent = suggestions.length.toString();
      this.macroToggleButton.appendChild(countBadge);
    }

    suggestions.forEach((suggestion, index) => {
      const element = this.createMacroSuggestionElement(suggestion);
      macroContent.appendChild(element);
      this.activeSuggestions.set(suggestion.id, element);

      // Auto-hide if specified (but keep toggle button visible)
      if (options.autoHide) {
        setTimeout(() => {
          this.hideSuggestion(suggestion.id);
          // Hide toggle button if no more macro suggestions
          if (this.getMacroSuggestionCount() === 0 && this.macroToggleButton) {
            this.macroToggleButton.style.display = 'none';
          }
        }, (options.hideDelayMs || 30000) + (index * 2000)); // Longer delay for macro suggestions
      }
    });
    */
  }

  /**
   * Create a macro suggestion element
   * Disabled - using MacroSuggestionPanel.tsx component instead
   */
  private createMacroSuggestionElement(suggestion: ProactiveSuggestion): HTMLElement {
    // Macro panel functionality moved to React component
    console.log('[SuggestionUIController] createMacroSuggestionElement disabled - using React component');
    return document.createElement('div');
    /*
    const element = document.createElement('div');
    element.className = `suggestion-macro priority-${suggestion.priority}`;
    element.style.cssText = `
      border-bottom: 1px solid #f3f4f6;
      padding: 16px;
      transition: background-color 0.2s ease;
    `;

    const priorityColor = {
      high: '#ef4444',
      medium: '#f59e0b', 
      low: '#6b7280'
    };

    element.innerHTML = `
      <div class="suggestion-header" style="display: flex; align-items: center; margin-bottom: 12px;">
        <div class="suggestion-priority-dot" style="
          width: 8px; 
          height: 8px; 
          border-radius: 50%; 
          background: ${priorityColor[suggestion.priority]};
          margin-right: 10px;
        "></div>
        <div class="suggestion-category" style="
          font-size: 11px; 
          text-transform: uppercase; 
          font-weight: 600; 
          color: #6b7280;
          letter-spacing: 0.05em;
        ">${suggestion.category}</div>
        <div class="suggestion-confidence" style="
          margin-left: auto; 
          font-size: 11px; 
          color: #6b7280;
          background: #f3f4f6;
          padding: 2px 6px;
          border-radius: 4px;
        ">${Math.round(suggestion.confidence * 100)}%</div>
      </div>
      
      <div class="suggestion-content">
        <div class="suggestion-message" style="
          font-weight: 500; 
          margin-bottom: 8px;
          color: #111827;
          font-size: 14px;
          line-height: 1.4;
        ">${suggestion.message}</div>
        
        ${suggestion.detailedDescription ? `
          <div class="suggestion-description" style="
            font-size: 12px; 
            color: #6b7280; 
            margin-bottom: 12px;
            line-height: 1.4;
          ">${suggestion.detailedDescription}</div>
        ` : ''}
        
        ${suggestion.estimatedImpact ? `
          <div class="suggestion-impact" style="
            font-size: 11px; 
            color: #059669; 
            background: #f0f9f4; 
            padding: 6px 8px; 
            border-radius: 6px;
            display: inline-block;
            margin-bottom: 12px;
          ">Expected: ${suggestion.estimatedImpact}</div>
        ` : ''}
        
        <div class="suggestion-controls" style="
          display: flex; 
          gap: 10px; 
          font-size: 12px;
        ">
          <button class="accept-btn" style="
            background: #3b82f6; 
            color: white; 
            border: none; 
            padding: 8px 12px; 
            border-radius: 6px; 
            cursor: pointer;
            font-weight: 500;
            transition: background-color 0.2s ease;
          ">Apply</button>
          <button class="dismiss-btn" style="
            background: #f3f4f6; 
            color: #6b7280; 
            border: none; 
            padding: 8px 12px; 
            border-radius: 6px; 
            cursor: pointer;
            transition: background-color 0.2s ease;
          ">Dismiss</button>
        </div>
      </div>
    `;

    // Add hover effects
    element.addEventListener('mouseenter', () => {
      element.style.backgroundColor = '#f8fafc';
    });

    element.addEventListener('mouseleave', () => {
      element.style.backgroundColor = 'transparent';
    });

    // Add interaction handlers
    this.addSuggestionHandlers(element, suggestion);

    return element;
    */
  }

  /**
   * Toggle macro panel visibility
   * Disabled - using MacroSuggestionPanel.tsx component instead
   */
  private toggleMacroPanel() {
    // Macro panel functionality moved to React component
    console.log('[SuggestionUIController] toggleMacroPanel disabled - using React component');
    return;
    /*
    if (!this.macroPanel) return;
    
    const isVisible = this.macroPanel.style.transform === 'translateY(0px)';
    
    if (isVisible) {
      this.hideMacroPanel();
    } else {
      this.showMacroPanel();
    }
    */
  }

  /**
   * Show macro panel
   * Disabled - using MacroSuggestionPanel.tsx component instead
   */
  private showMacroPanel() {
    // Macro panel functionality moved to React component
    console.log('[SuggestionUIController] showMacroPanel disabled - using React component');
    /*
    if (!this.macroPanel) return;
    
    this.macroPanel.style.transform = 'translateY(0px)';
    this.macroPanel.style.pointerEvents = 'auto';
    */
  }

  /**
   * Hide macro panel
   * Disabled - using MacroSuggestionPanel.tsx component instead
   */
  private hideMacroPanel() {
    // Macro panel functionality moved to React component
    console.log('[SuggestionUIController] hideMacroPanel disabled - using React component');
    /*
    if (!this.macroPanel) return;
    
    this.macroPanel.style.transform = 'translateY(100%)';
    this.macroPanel.style.pointerEvents = 'none';
    */
  }

  /**
   * Get count of active macro suggestions
   * Disabled - using MacroSuggestionPanel.tsx component instead
   */
  private getMacroSuggestionCount(): number {
    // Macro panel functionality moved to React component
    return 0;
    /*
    if (!this.macroPanel) return 0;
    
    const macroContent = this.macroPanel.querySelector('.macro-panel-content');
    return macroContent ? macroContent.children.length : 0;
    */
  }

  /**
   * Display in-situ suggestions directly over relevant content
   */
  private displayInSituSuggestions(
    suggestions: ProactiveSuggestion[],
    options: SuggestionDisplayOptions
  ) {
    if (!this.inSituContainer) return;

    // Clear existing in-situ suggestions
    this.clearInSituSuggestions();

    suggestions.forEach((suggestion, index) => {
      const element = this.createInSituElement(suggestion, index);
      
      // Position near the target element or use provided position
      if (options.targetElement) {
        this.positionNearElement(element, options.targetElement, index);
      } else if (options.position) {
        element.style.left = `${options.position.x}px`;
        element.style.top = `${options.position.y + (index * 60)}px`;
      }

      if (this.inSituContainer) {
        this.inSituContainer.appendChild(element);
      }
      this.activeSuggestions.set(suggestion.id, element);

      // Auto-hide if specified
      if (options.autoHide) {
        setTimeout(() => {
          this.hideSuggestion(suggestion.id);
        }, options.hideDelayMs || 5000);
      }
    });
  }

  /**
   * Display peripheral suggestions in the notification area
   */
  private displayPeripheralSuggestions(
    suggestions: ProactiveSuggestion[],
    options: SuggestionDisplayOptions
  ) {
    if (!this.peripheralContainer) return;

    suggestions.forEach((suggestion, index) => {
      const element = this.createPeripheralElement(suggestion);
      
      // Animate in with staggered timing
      element.style.opacity = '0';
      element.style.transform = 'translateX(100%)';
      
      if (!this.peripheralContainer) return;
      this.peripheralContainer.appendChild(element);
      this.activeSuggestions.set(suggestion.id, element);

      // Animate in
      setTimeout(() => {
        element.style.transition = 'all 0.3s ease-out';
        element.style.opacity = '1';
        element.style.transform = 'translateX(0)';
      }, index * 150);

      // Auto-hide if specified
      if (options.autoHide) {
        setTimeout(() => {
          this.hideSuggestion(suggestion.id);
        }, (options.hideDelayMs || 8000) + (index * 1000));
      }
    });
  }

  /**
   * Create an in-situ suggestion element
   */
  private createInSituElement(suggestion: ProactiveSuggestion, index: number): HTMLElement {
    const element = document.createElement('div');
    element.className = `suggestion-in-situ ${suggestion.scope} priority-${suggestion.priority}`;
    element.style.cssText = `
      position: absolute;
      background: rgba(59, 130, 246, 0.95);
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      max-width: 250px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      pointer-events: auto;
      cursor: pointer;
      z-index: ${10001 + index};
      backdrop-filter: blur(4px);
    `;

    element.innerHTML = `
      <div class="suggestion-content">
        <div class="suggestion-message">${suggestion.message}</div>
        <div class="suggestion-controls" style="margin-top: 4px; font-size: 10px; opacity: 0.8;">
          Press Tab to accept • Esc to dismiss
        </div>
      </div>
    `;

    // Add interaction handlers
    this.addSuggestionHandlers(element, suggestion);

    return element;
  }

  /**
   * Create a peripheral suggestion element
   */
  private createPeripheralElement(suggestion: ProactiveSuggestion): HTMLElement {
    const element = document.createElement('div');
    element.className = `suggestion-peripheral ${suggestion.scope} priority-${suggestion.priority}`;
    element.style.cssText = `
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 8px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      pointer-events: auto;
      cursor: pointer;
      transition: all 0.2s ease;
    `;

    const priorityColor = {
      high: '#ef4444',
      medium: '#f59e0b', 
      low: '#6b7280'
    };

    element.innerHTML = `
      <div class="suggestion-header" style="display: flex; align-items: center; margin-bottom: 8px;">
        <div class="suggestion-priority-dot" style="
          width: 6px; 
          height: 6px; 
          border-radius: 50%; 
          background: ${priorityColor[suggestion.priority]};
          margin-right: 8px;
        "></div>
        <div class="suggestion-category" style="
          font-size: 10px; 
          text-transform: uppercase; 
          font-weight: 600; 
          color: #6b7280;
          letter-spacing: 0.05em;
        ">${suggestion.category}</div>
        <div class="suggestion-confidence" style="
          margin-left: auto; 
          font-size: 10px; 
          color: #6b7280;
        ">${Math.round(suggestion.confidence * 100)}%</div>
      </div>
      
      <div class="suggestion-content">
        <div class="suggestion-message" style="
          font-weight: 500; 
          margin-bottom: 4px;
          color: #111827;
        ">${suggestion.message}</div>
        
        ${suggestion.detailedDescription ? `
          <div class="suggestion-description" style="
            font-size: 12px; 
            color: #6b7280; 
            margin-bottom: 8px;
          ">${suggestion.detailedDescription}</div>
        ` : ''}
        
        ${suggestion.estimatedImpact ? `
          <div class="suggestion-impact" style="
            font-size: 11px; 
            color: #059669; 
            background: #f0f9f4; 
            padding: 4px 6px; 
            border-radius: 4px;
            display: inline-block;
            margin-bottom: 8px;
          ">Impact: ${suggestion.estimatedImpact}</div>
        ` : ''}
        
        <div class="suggestion-controls" style="
          display: flex; 
          gap: 8px; 
          font-size: 11px;
        ">
          <button class="accept-btn" style="
            background: #3b82f6; 
            color: white; 
            border: none; 
            padding: 4px 8px; 
            border-radius: 4px; 
            cursor: pointer;
          ">Accept</button>
          <button class="dismiss-btn" style="
            background: #f3f4f6; 
            color: #6b7280; 
            border: none; 
            padding: 4px 8px; 
            border-radius: 4px; 
            cursor: pointer;
          ">Dismiss</button>
        </div>
      </div>
    `;

    // Add hover effects
    element.addEventListener('mouseenter', () => {
      element.style.transform = 'translateX(-4px)';
      element.style.boxShadow = '0 8px 25px -5px rgba(0, 0, 0, 0.1)';
    });

    element.addEventListener('mouseleave', () => {
      element.style.transform = 'translateX(0)';
      element.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
    });

    // Add interaction handlers
    this.addSuggestionHandlers(element, suggestion);

    return element;
  }

  /**
   * Position an element near a target element
   */
  private positionNearElement(element: HTMLElement, target: HTMLElement, offset: number = 0) {
    const rect = target.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    
    // Position below and to the right of target
    let x = rect.right + 10;
    let y = rect.top + (offset * 60);
    
    // Ensure element stays within viewport
    if (x + elementRect.width > window.innerWidth) {
      x = rect.left - elementRect.width - 10;
    }
    
    if (y + elementRect.height > window.innerHeight) {
      y = rect.bottom - elementRect.height;
    }
    
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
  }

  /**
   * Add interaction handlers to suggestion elements
   */
  private addSuggestionHandlers(element: HTMLElement, suggestion: ProactiveSuggestion) {
    const acceptBtn = element.querySelector('.accept-btn') as HTMLButtonElement;
    const dismissBtn = element.querySelector('.dismiss-btn') as HTMLButtonElement;

    // Accept handler
    const acceptHandler = (e: Event) => {
      e.stopPropagation();
      this.acceptSuggestion(suggestion);
    };

    // Dismiss handler
    const dismissHandler = (e: Event) => {
      e.stopPropagation();
      this.dismissSuggestion(suggestion);
    };

    if (acceptBtn) {
      acceptBtn.addEventListener('click', acceptHandler);
    }

    if (dismissBtn) {
      dismissBtn.addEventListener('click', dismissHandler);
    }

    // For in-situ suggestions, clicking the element accepts it
    if (suggestion.modality === 'in-situ') {
      element.addEventListener('click', acceptHandler);
    }

    // Keyboard handlers
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        acceptHandler(e);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        dismissHandler(e);
      }
    };

    element.addEventListener('keydown', keyHandler);
    element.setAttribute('tabindex', '0');
  }

  /**
   * Accept a suggestion
   */
  private acceptSuggestion(suggestion: ProactiveSuggestion) {
    // Dispatch custom event for the application to handle
    const event = new CustomEvent('suggestionAccepted', {
      detail: { suggestion }
    });
    document.dispatchEvent(event);

    // Remove the suggestion from UI
    this.hideSuggestion(suggestion.id);
  }

  /**
   * Dismiss a suggestion
   */
  private dismissSuggestion(suggestion: ProactiveSuggestion) {
    // Dispatch custom event
    const event = new CustomEvent('suggestionDismissed', {
      detail: { suggestion }
    });
    document.dispatchEvent(event);

    // Remove the suggestion from UI
    this.hideSuggestion(suggestion.id);
  }

  /**
   * Hide a specific suggestion
   */
  hideSuggestion(suggestionId: string) {
    const element = this.activeSuggestions.get(suggestionId);
    if (element) {
      element.style.transition = 'opacity 0.2s ease-out, transform 0.2s ease-out';
      element.style.opacity = '0';
      element.style.transform = 'scale(0.95)';
      
      setTimeout(() => {
        element.remove();
        this.activeSuggestions.delete(suggestionId);
      }, 200);
    }
  }

  /**
   * Clear all in-situ suggestions
   */
  private clearInSituSuggestions() {
    const inSituSuggestions = Array.from(this.activeSuggestions.entries())
      .filter(([_, element]) => element.classList.contains('suggestion-in-situ'));
    
    inSituSuggestions.forEach(([id, _]) => {
      this.hideSuggestion(id);
    });
  }

  /**
   * Clear all peripheral suggestions
   */
  clearPeripheralSuggestions() {
    const peripheralSuggestions = Array.from(this.activeSuggestions.entries())
      .filter(([_, element]) => element.classList.contains('suggestion-peripheral'));
    
    peripheralSuggestions.forEach(([id, _]) => {
      this.hideSuggestion(id);
    });
  }

  /**
   * Clear all suggestions
   */
  clearAllSuggestions() {
    Array.from(this.activeSuggestions.keys()).forEach(id => {
      this.hideSuggestion(id);
    });
    
    // Hide macro panel and toggle button (now handled by React component)
    // this.hideMacroPanel();
    // if (this.macroToggleButton) {
    //   this.macroToggleButton.style.display = 'none';
    // }
  }

  /**
   * Get currently active suggestions
   */
  getActiveSuggestions(): string[] {
    return Array.from(this.activeSuggestions.keys());
  }

  /**
   * Check if any suggestions are currently active
   */
  hasActiveSuggestions(): boolean {
    return this.activeSuggestions.size > 0;
  }

  /**
   * Cleanup UI controllers
   */
  destroy() {
    this.clearAllSuggestions();
    
    if (this.inSituContainer) {
      this.inSituContainer.remove();
    }
    
    if (this.peripheralContainer) {
      this.peripheralContainer.remove();
    }
  }
}

// Export singleton instance
export const suggestionUIController = new SuggestionUIController();
export default suggestionUIController;