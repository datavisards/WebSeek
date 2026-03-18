/**
 * MacroSuggestionPanel - A dedicated panel for displaying macro (peripheral) suggestions
 * Integrates with the existing sidepanel layout and supports tool-based suggestion execution
 */

import React, { useState, useEffect } from 'react';
import { ProactiveSuggestion, ToolCall } from '../types';
import { detectMarkdown, renderMarkdown } from '../utils';
import { MACRO_TOOLS } from '../macro-tools';
import './MacroSuggestionPanel.css';

interface MacroSuggestionPanelProps {
  suggestions: ProactiveSuggestion[];
  onAccept: (suggestionId: string) => void;
  onDismiss: (suggestionId: string) => void;
  onDismissAll?: () => void; // Add dismiss all callback
  onExecuteTool: (toolCall: ToolCall, suggestionId: string) => void;
  onExecuteToolSequence?: (toolSequence: { goal: string; steps: Array<{ description: string; toolCall: ToolCall }> }, suggestionId: string) => void;
  className?: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const MacroSuggestionPanel: React.FC<MacroSuggestionPanelProps> = ({
  suggestions,
  onAccept,
  onDismiss,
  onDismissAll,
  onExecuteTool,
  onExecuteToolSequence,
  className = '',
  isCollapsed = false,
  onToggleCollapse
}) => {
  const [expandedSuggestion, setExpandedSuggestion] = useState<string | null>(null);
  
  // Filter for macro suggestions only and sort by batch order (newest first), then confidence (highest first)
  const macroSuggestions = suggestions
    .filter(s => s.scope === 'macro')
    .sort((a, b) => {
      // First sort by batch order (newest first)
      const aBatchOrder = (a as any).batchOrder || a.timestamp;
      const bBatchOrder = (b as any).batchOrder || b.timestamp;
      
      if (aBatchOrder !== bBatchOrder) {
        return bBatchOrder - aBatchOrder;
      }
      
      // Then sort by confidence (highest first)
      return b.confidence - a.confidence;
    });

  const getToolIcon = (toolName: string) => {
    switch (toolName) {
      case 'openPage': return '🌐';
      case 'tableSort': return '🔄';
      case 'tableFilter': return '🔍';
      case 'createVisualization': return '📊';
      case 'exportData': return '💾';
      case 'duplicateInstance': return '📋';
      case 'searchAndReplace': return '🔄';
      case 'mergeInstances': return '🔗';
      default: return '⚙️';
    }
  };

  const getToolDisplayName = (toolName: string) => {
    const tool = MACRO_TOOLS.find(t => t.name === toolName);
    return tool ? tool.name : toolName;
  };

  const getToolDescription = (toolName: string) => {
    const tool = MACRO_TOOLS.find(t => t.name === toolName);
    return tool ? tool.description : 'Execute tool action';
  };

  const handleApplyTool = (suggestion: ProactiveSuggestion) => {
    console.log('[MacroSuggestionPanel] Applying suggestion:', {
      id: suggestion.id,
      hasToolSequence: !!suggestion.toolSequence,
      hasToolCall: !!suggestion.toolCall,
      hasOnExecuteToolSequence: !!onExecuteToolSequence,
      suggestion: suggestion
    });
    
    if (suggestion.toolSequence && onExecuteToolSequence) {
      console.log('[MacroSuggestionPanel] ⚡ TRIGGERING TOOL SEQUENCE EXECUTION:', suggestion.toolSequence);
      console.log('[MacroSuggestionPanel] ⚡ Suggestion ID:', suggestion.id);
      console.log('[MacroSuggestionPanel] ⚡ First step parameters:', suggestion.toolSequence.steps?.[0]?.toolCall?.parameters);
      onExecuteToolSequence(suggestion.toolSequence, suggestion.id);
      console.log('[MacroSuggestionPanel] ⚡ TOOL SEQUENCE EXECUTION TRIGGERED');
    } else if (suggestion.toolCall) {
      console.log('[MacroSuggestionPanel] Executing single tool call:', suggestion.toolCall);
      onExecuteTool(suggestion.toolCall, suggestion.id);
    } else {
      console.log('[MacroSuggestionPanel] No tool call or sequence found, accepting suggestion:', suggestion.id);
      onAccept(suggestion.id);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🔵';
      default: return '🔵';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'data-extraction': return '📊';
      case 'data-wrangling': return '🔧';
      case 'data-cleaning': return '🧹';
      case 'data-modeling': return '📈';
      default: return '💡';
    }
  };

  const getConfidenceTooltip = (confidence: number) => {
    const percentage = Math.round(confidence * 100);
    if (confidence >= 0.8) {
      return `High confidence (${percentage}%): This suggestion is highly relevant and likely to be useful`;
    }
    if (confidence >= 0.6) {
      return `Medium confidence (${percentage}%): This suggestion is moderately relevant and may be useful`;
    }
    return `Low confidence (${percentage}%): This suggestion is potentially relevant but may need verification`;
  };

  return (
    <div className={`macro-suggestion-panel ${isCollapsed ? 'collapsed' : ''} ${className}`}>
      {!isCollapsed && (
        <div className="suggestions-list">
        {macroSuggestions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">💡</div>
            <div className="empty-text">
              <p>No AI suggestions available</p>
              <small>Suggestions will appear here as you work with your data</small>
            </div>
          </div>
        ) : (
          macroSuggestions.map((suggestion) => (
          <div key={suggestion.id} className={`suggestion-card priority-${suggestion.priority} ${suggestion.isLoading ? 'loading' : ''}`}>
            {suggestion.isLoading ? (
              // Loading placeholder
              <div className="suggestion-loading">
                <div className="loading-spinner">
                  <div className="spinner"></div>
                </div>
                <div className="loading-text">
                  {suggestion.loadingMessage || 'Loading...'}
                </div>
                <div className="loading-subtext">
                  Refining suggestion based on current context
                </div>
              </div>
            ) : (
              <>
                <div className="suggestion-header">
                  <div className="suggestion-meta">
                    <span className="category-icon">
                      {getCategoryIcon(suggestion.category)}
                    </span>
                    <span className="category-text">{suggestion.category}</span>
                    <span className="priority-indicator">
                      {getPriorityIcon(suggestion.priority)}
                    </span>
                    <span 
                      className="confidence-score"
                      title={getConfidenceTooltip(suggestion.confidence)}
                    >
                      {Math.round(suggestion.confidence * 100)}%
                    </span>
                  </div>
                  <button
                    className="expand-btn"
                    onClick={() => setExpandedSuggestion(
                      expandedSuggestion === suggestion.id ? null : suggestion.id
                    )}
                  >
                    {expandedSuggestion === suggestion.id ? '▼' : '▶'}
                  </button>
                </div>

                <div className="suggestion-content-macro">
                  {detectMarkdown(suggestion.message) ? (
                    <h4 
                      className="suggestion-message markdown-content"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(suggestion.message) }}
                    />
                  ) : (
                    <h4 className="suggestion-message">{suggestion.message}</h4>
                  )}
                  
                  {suggestion.estimatedImpact && (
                    <div className="impact-indicator">
                      <span className="impact-label">Impact:</span>
                      <span className="impact-text">{suggestion.estimatedImpact}</span>
                    </div>
                  )}

                  {expandedSuggestion === suggestion.id && (
                    <div className="expanded-details">
                      {suggestion.toolSequence ? (
                        <div className="tool-sequence-overview">
                          <strong>Tools: </strong>
                          {suggestion.toolSequence.steps.map((step, index) => (
                            <span key={index} className="tool-name">
                              {getToolIcon(step.toolCall.function)} {step.toolCall.function}
                              {index < (suggestion.toolSequence?.steps.length || 0) - 1 ? ' → ' : ''}
                            </span>
                          ))}
                        </div>
                      ) : suggestion.detailedDescription && (
                        detectMarkdown(suggestion.detailedDescription) ? (
                          <div 
                            className="detailed-description markdown-content"
                            dangerouslySetInnerHTML={{ __html: renderMarkdown(suggestion.detailedDescription) }}
                          />
                        ) : (
                          <p className="detailed-description">
                            {suggestion.detailedDescription}
                          </p>
                        )
                      )}

                      {suggestion.toolCall && (
                        <div className="tool-details">
                          <strong>Tool: </strong>
                          <span className="tool-icon">{getToolIcon(suggestion.toolCall.function)}</span>
                          <span className="tool-name">{suggestion.toolCall.function}</span>
                        </div>
                      )}
                      
                      {suggestion.contextualData && (
                        <div className="contextual-data">
                          <strong>Context:</strong>
                          <pre>{JSON.stringify(suggestion.contextualData, null, 2)}</pre>
                        </div>
                      )}
                      
                      {suggestion.instances && suggestion.instances.length > 0 && (
                        <div className="instance-preview">
                          <strong>Will affect {suggestion.instances.length} item(s)</strong>
                          <ul>
                            {suggestion.instances.map((instance, idx) => (
                              <li key={idx}>
                                {instance.action} {instance.instance?.type || 'item'}
                                {instance.targetId && ` (${instance.targetId})`}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="suggestion-actions">
                  <button
                    className={`accept-btn ${(suggestion.toolCall || suggestion.toolSequence) ? 'tool-action' : ''}`}
                    onClick={() => handleApplyTool(suggestion)}
                    title={
                      suggestion.toolSequence 
                        ? `Execute ${suggestion.toolSequence.steps.length} step sequence: ${suggestion.toolSequence.goal}`
                        : suggestion.toolCall 
                          ? `Execute ${getToolDisplayName(suggestion.toolCall.function)}` 
                          : "Accept this suggestion"
                    }
                  >
                    {suggestion.toolSequence ? (
                      <>
                        <span className="tool-icon">🔄</span>
                        Apply Sequence ({suggestion.toolSequence.steps.length} steps)
                      </>
                    ) : suggestion.toolCall ? (
                      <>
                        <span className="tool-icon">{getToolIcon(suggestion.toolCall.function)}</span>
                        Apply
                      </>
                    ) : (
                      'Apply'
                    )}
                  </button>
                  <button
                    className="dismiss-btn"
                    onClick={() => onDismiss(suggestion.id)}
                    title="Dismiss this suggestion"
                  >
                    Dismiss
                  </button>
                  {suggestion.undoable && (
                    <span className="undoable-indicator" title="This action can be undone">
                      ↶ Undoable
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
          ))
        )}
      </div>
      )}
    </div>
  );
};

export default MacroSuggestionPanel;