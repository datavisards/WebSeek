/**
 * EnhancedSystemDemo - A demo component to test the enhanced proactive system
 */

import React, { useState, useEffect } from 'react';
import { proactiveService } from '../proactive-service-enhanced';

const EnhancedSystemDemo: React.FC = () => {
  const [testLogs, setTestLogs] = useState<string[]>([]);
  const [sessionStats, setSessionStats] = useState(proactiveService.getSessionStats());

  useEffect(() => {
    // Update stats periodically
    const interval = setInterval(() => {
      setSessionStats(proactiveService.getSessionStats());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const addTestLog = (logMessage: string) => {
    const newLogs = [...testLogs, logMessage];
    setTestLogs(newLogs);
    
    // Trigger the proactive service with the new logs
    proactiveService.triggerLogsUpdate(newLogs);
  };

  const clearLogs = () => {
    setTestLogs([]);
    proactiveService.triggerLogsUpdate([]);
  };

  const resetSession = () => {
    proactiveService.resetSession();
    setSessionStats(proactiveService.getSessionStats());
  };

  const testLogSequences = [
    {
      name: "Macro Workflow Test",
      logs: [
        "Created table \"Table1\"",
        "Added data to table",
        "Created visualization for table",
        "User navigated to main interface",
        "Multiple instances detected"
      ]
    },
    {
      name: "Micro Editor Test", 
      logs: [
        "User started editing cell A1",
        "User entered text in cell A2", 
        "Pattern detected in columns",
        "User focused on table editor"
      ]
    },
    {
      name: "Element Selection Test",
      logs: [
        "User selected element #item1",
        "User selected element #item2",
        "Similar elements detected",
        "Batch selection opportunity"
      ]
    },
    {
      name: "Data Pattern Test",
      logs: [
        "User entered data in multiple cells",
        "Pattern recognition triggered",
        "Auto-completion opportunity detected",
        "User working in data editor"
      ]
    }
  ];

  return (
    <div style={{
      background: '#f8f9fa',
      border: '1px solid #dee2e6',
      borderRadius: '8px',
      padding: '16px',
      marginBottom: '16px'
    }}>
      <h3 style={{ margin: '0 0 16px 0', color: '#495057' }}>
        🚀 Enhanced Proactive System Demo
      </h3>

      {/* System Status */}
      <div style={{ 
        marginBottom: '16px',
        padding: '12px',
        background: '#d4edda',
        borderRadius: '4px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <span style={{ fontWeight: 'bold' }}>
            AI System: ✅ ENABLED
          </span>
        </div>
        <div style={{ fontSize: '12px', color: '#6c757d' }}>
          Using AI-driven suggestions with embedded heuristic rules. Macro suggestions appear in dedicated panel.
        </div>
      </div>

      {/* Session Stats */}
      <div style={{ marginBottom: '16px', fontSize: '12px' }}>
        <strong>Session Stats:</strong> {sessionStats.suggestionCount}/{sessionStats.maxSuggestions} suggestions used
        <button
          onClick={resetSession}
          style={{
            marginLeft: '8px',
            background: '#6c757d',
            color: 'white',
            border: 'none',
            padding: '2px 6px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '10px'
          }}
        >
          Reset
        </button>
      </div>

      {/* Test Log Sequences */}
      <div style={{ marginBottom: '16px' }}>
        <strong>Quick Test Sequences:</strong>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
          {testLogSequences.map((sequence, index) => (
            <button
              key={index}
              onClick={() => {
                sequence.logs.forEach((log, i) => {
                  setTimeout(() => addTestLog(log), i * 500);
                });
              }}
              style={{
                background: '#007bff',
                color: 'white',
                border: 'none',
                padding: '6px 10px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '11px'
              }}
            >
              {sequence.name}
            </button>
          ))}
        </div>
      </div>

      {/* Manual Log Input */}
      <div style={{ marginBottom: '16px' }}>
        <strong>Manual Log Input:</strong>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
          {[
            'Created table "TestTable"',
            'Updated table "TestTable"', 
            'Opened the table editor',
            'Closed the table editor',
            'Selected element on page',
            'Created visualization "Chart1"'
          ].map((logText, index) => (
            <button
              key={index}
              onClick={() => addTestLog(logText)}
              style={{
                background: '#28a745',
                color: 'white',
                border: 'none',
                padding: '4px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '11px'
              }}
            >
              + {logText}
            </button>
          ))}
        </div>
      </div>

      {/* Current Logs */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <strong>Current Test Logs ({testLogs.length}):</strong>
          <button
            onClick={clearLogs}
            style={{
              background: '#dc3545',
              color: 'white',
              border: 'none',
              padding: '4px 8px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px'
            }}
          >
            Clear All
          </button>
        </div>
        <div style={{
          background: '#212529',
          color: '#f8f9fa',
          padding: '8px',
          borderRadius: '4px',
          maxHeight: '120px',
          overflowY: 'auto',
          fontFamily: 'monospace',
          fontSize: '11px'
        }}>
          {testLogs.length === 0 ? (
            <div style={{ color: '#6c757d' }}>No logs yet. Add some logs to trigger suggestions.</div>
          ) : (
            testLogs.map((log, index) => (
              <div key={index}>{index + 1}. {log}</div>
            ))
          )}
        </div>
      </div>

      <div style={{ fontSize: '11px', color: '#6c757d' }}>
        💡 <strong>How to test:</strong> Click the sequence buttons above to simulate user actions. 
        Watch for suggestions appearing in the MacroSuggestionPanel above and in-situ overlays.
        Press Tab to accept suggestions, Esc to dismiss, Ctrl+Z to undo.
      </div>
    </div>
  );
};

export default EnhancedSystemDemo;