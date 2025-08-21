/**
 * MacroSuggestionPanel - A dedicated panel for displaying macro (peripheral) suggestions
 * Integrates with the existing sidepanel layout
 */

import React, { useState, useEffect } from 'react';
import { ProactiveSuggestion } from '../types';
import { detectMarkdown, renderMarkdown } from '../utils';
import './MacroSuggestionPanel.css';

interface MacroSuggestionPanelProps {
  suggestions: ProactiveSuggestion[];
  onAccept: (suggestionId: string) => void;
  onDismiss: (suggestionId: string) => void;
  className?: string;
}

const MacroSuggestionPanel: React.FC<MacroSuggestionPanelProps> = ({
  suggestions,
  onAccept,
  onDismiss,
  className = ''
}) => {
  const [expandedSuggestion, setExpandedSuggestion] = useState<string | null>(null);
  
  // Filter for macro suggestions only
  const macroSuggestions = suggestions.filter(s => s.scope === 'macro');

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

  return (
    <div className={`macro-suggestion-panel ${className}`}>
      <div className="panel-header">
        <h3>AI Suggestions</h3>
        <span className="suggestion-count">{macroSuggestions.length}</span>
      </div>
      
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
          <div key={suggestion.id} className={`suggestion-card priority-${suggestion.priority}`}>
            <div className="suggestion-header">
              <div className="suggestion-meta">
                <span className="category-icon">
                  {getCategoryIcon(suggestion.category)}
                </span>
                <span className="category-text">{suggestion.category}</span>
                <span className="priority-indicator">
                  {getPriorityIcon(suggestion.priority)}
                </span>
                <span className="confidence-score">
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

            <div className="suggestion-content">
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
                  {suggestion.detailedDescription && (
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
                className="accept-btn"
                onClick={() => onAccept(suggestion.id)}
                title="Accept this suggestion"
              >
                Apply
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
          </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MacroSuggestionPanel;