/**
 * SuggestionDebugger - A component to help debug suggestion acceptance issues
 */

import React, { useState, useEffect } from 'react';
import { ProactiveSuggestion } from '../types';

interface SuggestionDebuggerProps {
  suggestions: ProactiveSuggestion[];
  onAccept: (suggestionId: string) => void;
  onDismiss: (suggestionId: string) => void;
  className?: string;
}

const SuggestionDebugger: React.FC<SuggestionDebuggerProps> = ({
  suggestions,
  onAccept,
  onDismiss,
  className = ''
}) => {
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [keyPressed, setKeyPressed] = useState<string>('');

  const addDebugLog = (message: string) => {
    setDebugLog(prev => [...prev.slice(-9), `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  useEffect(() => {
    addDebugLog(`Suggestions updated: ${suggestions.length} suggestions`);
    suggestions.forEach((s, i) => {
      addDebugLog(`  ${i + 1}. ${s.message} (${s.id})`);
    });
  }, [suggestions]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      setKeyPressed(e.key);
      addDebugLog(`Key pressed: ${e.key}`);
      
      if (e.key === 'Tab' && suggestions.length > 0) {
        addDebugLog(`Tab pressed with ${suggestions.length} suggestions available`);
        addDebugLog(`Will accept suggestion: ${suggestions[0].id}`);
      }
      
      setTimeout(() => setKeyPressed(''), 1000);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [suggestions]);

  const handleManualAccept = (suggestionId: string) => {
    addDebugLog(`Manually accepting suggestion: ${suggestionId}`);
    onAccept(suggestionId);
  };

  const handleManualDismiss = (suggestionId: string) => {
    addDebugLog(`Manually dismissing suggestion: ${suggestionId}`);
    onDismiss(suggestionId);
  };

  return (
    <div className={`suggestion-debugger ${className}`} style={{
      background: '#f8f9fa',
      border: '1px solid #dee2e6',
      borderRadius: '4px',
      padding: '12px',
      marginBottom: '16px',
      fontSize: '12px'
    }}>
      <h4 style={{ margin: '0 0 8px 0', color: '#495057' }}>
        Suggestion Debug Panel
        {keyPressed && (
          <span style={{ 
            marginLeft: '8px', 
            color: '#007bff',
            background: '#e7f3ff',
            padding: '2px 6px',
            borderRadius: '4px'
          }}>
            Key: {keyPressed}
          </span>
        )}
      </h4>
      
      <div style={{ marginBottom: '12px' }}>
        <strong>Current Suggestions ({suggestions.length}):</strong>
        {suggestions.length === 0 ? (
          <div style={{ color: '#6c757d', fontStyle: 'italic', marginTop: '4px' }}>
            No suggestions available
          </div>
        ) : (
          <div style={{ marginTop: '4px' }}>
            {suggestions.map((suggestion, index) => (
              <div key={suggestion.id} style={{
                background: 'white',
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                padding: '8px',
                marginBottom: '4px'
              }}>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                  #{index + 1}: {suggestion.message}
                  {index === 0 && (
                    <span style={{ 
                      marginLeft: '8px',
                      color: '#28a745',
                      fontSize: '10px',
                      background: '#d4edda',
                      padding: '1px 4px',
                      borderRadius: '2px'
                    }}>
                      TAB TARGET
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '11px', color: '#6c757d', marginBottom: '6px' }}>
                  ID: {suggestion.id} | 
                  Scope: {suggestion.scope} | 
                  Modality: {suggestion.modality} | 
                  Priority: {suggestion.priority}
                  {suggestion.instances && ` | Changes: ${suggestion.instances.length}`}
                </div>
                <div>
                  <button
                    onClick={() => handleManualAccept(suggestion.id)}
                    style={{
                      background: '#007bff',
                      color: 'white',
                      border: 'none',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      marginRight: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleManualDismiss(suggestion.id)}
                    style={{
                      background: '#6c757d',
                      color: 'white',
                      border: 'none',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      cursor: 'pointer'
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <strong>Debug Log:</strong>
        <div style={{
          background: '#212529',
          color: '#f8f9fa',
          padding: '8px',
          borderRadius: '4px',
          maxHeight: '120px',
          overflowY: 'auto',
          fontFamily: 'monospace',
          fontSize: '10px',
          marginTop: '4px'
        }}>
          {debugLog.length === 0 ? (
            <div style={{ color: '#6c757d' }}>No debug events yet...</div>
          ) : (
            debugLog.map((log, index) => (
              <div key={index}>{log}</div>
            ))
          )}
        </div>
      </div>

      <div style={{ marginTop: '8px', fontSize: '11px', color: '#6c757d' }}>
        💡 Press <strong>Tab</strong> to accept the first suggestion, <strong>Esc</strong> to dismiss all
      </div>
    </div>
  );
};

export default SuggestionDebugger;