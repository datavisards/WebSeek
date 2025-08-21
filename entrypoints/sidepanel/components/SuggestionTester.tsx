/**
 * SuggestionTester - A component to test and debug suggestion functionality
 */

import React, { useState } from 'react';
import { ProactiveSuggestion, InstanceEvent } from '../types';
import { proactiveService } from '../proactive-service-enhanced';

const SuggestionTester: React.FC = () => {
  const [testResults, setTestResults] = useState<string[]>([]);

  const addTestResult = (message: string) => {
    setTestResults(prev => [...prev.slice(-9), `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const createTestSuggestion = (): ProactiveSuggestion => {
    const testInstanceEvent: InstanceEvent = {
      action: 'update',
      targetId: 'test-table-1',
      instance: {
        id: 'test-table-1',
        type: 'table',
        rows: 2,
        cols: 2,
        cells: [
          [
            { type: 'text', content: 'Updated Cell A1', id: 'cell-a1', source: { type: 'manual' } },
            { type: 'text', content: 'Cell B1', id: 'cell-b1', source: { type: 'manual' } }
          ],
          [
            { type: 'text', content: 'Cell A2', id: 'cell-a2', source: { type: 'manual' } },
            { type: 'text', content: 'Cell B2', id: 'cell-b2', source: { type: 'manual' } }
          ]
        ],
        source: { type: 'manual' }
      }
    };

    return {
      id: `test-suggestion-${Date.now()}`,
      message: 'Test suggestion: Update table cell',
      detailedDescription: 'This is a test suggestion to update a table cell value',
      instances: [testInstanceEvent],
      scope: 'micro',
      modality: 'in-situ',
      priority: 'high',
      confidence: 0.9,
      contextualData: { test: true },
      triggerEvent: 'manual-test',
      estimatedImpact: '1 cell updated',
      category: 'test',
      timestamp: Date.now(),
      undoable: true
    };
  };

  const createManualSuggestion = () => {
    const suggestion = createTestSuggestion();
    addTestResult(`Creating test suggestion: ${suggestion.id}`);
    
    // Manually add to proactive service
    (proactiveService as any).currentSuggestions.push(suggestion);
    
    // Trigger the suggestions updated callback
    if ((proactiveService as any).onSuggestionsUpdated) {
      (proactiveService as any).onSuggestionsUpdated([suggestion]);
      addTestResult('Suggestion added to proactive service');
    } else {
      addTestResult('ERROR: No suggestions updated callback found');
    }
  };

  const testAcceptSuggestion = async () => {
    const currentSuggestions = proactiveService.getCurrentSuggestions();
    addTestResult(`Current suggestions count: ${currentSuggestions.length}`);
    
    if (currentSuggestions.length > 0) {
      const suggestion = currentSuggestions[0];
      addTestResult(`Testing acceptance of: ${suggestion.id}`);
      
      const result = await proactiveService.acceptSuggestion(suggestion.id);
      addTestResult(`Acceptance result: ${result}`);
    } else {
      addTestResult('No suggestions to accept');
    }
  };

  const clearAllSuggestions = () => {
    proactiveService.clearSuggestions();
    addTestResult('All suggestions cleared');
  };

  const testKeyboardEvent = () => {
    addTestResult('Simulating Tab key press...');
    
    // Create and dispatch a Tab key event
    const event = new KeyboardEvent('keydown', {
      key: 'Tab',
      code: 'Tab',
      bubbles: true,
      cancelable: true
    });
    
    document.dispatchEvent(event);
    addTestResult('Tab key event dispatched');
  };

  const getCurrentSuggestionInfo = () => {
    const suggestions = proactiveService.getCurrentSuggestions();
    addTestResult(`=== Current State ===`);
    addTestResult(`Suggestions count: ${suggestions.length}`);
    suggestions.forEach((s, i) => {
      addTestResult(`${i + 1}. ${s.message} (${s.id})`);
      addTestResult(`   Instances: ${s.instances?.length || 0}`);
    });
    addTestResult(`===================`);
  };

  return (
    <div style={{
      background: '#fff3cd',
      border: '1px solid #ffeaa7',
      borderRadius: '8px',
      padding: '16px',
      marginBottom: '16px'
    }}>
      <h3 style={{ margin: '0 0 16px 0', color: '#856404' }}>
        🧪 Suggestion System Tester
      </h3>

      <div style={{ 
        display: 'flex', 
        flexWrap: 'wrap', 
        gap: '8px', 
        marginBottom: '16px' 
      }}>
        <button
          onClick={createManualSuggestion}
          style={{
            background: '#007bff',
            color: 'white',
            border: 'none',
            padding: '8px 12px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          Create Test Suggestion
        </button>
        
        <button
          onClick={testAcceptSuggestion}
          style={{
            background: '#28a745',
            color: 'white',
            border: 'none',
            padding: '8px 12px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          Test Accept
        </button>

        <button
          onClick={testKeyboardEvent}
          style={{
            background: '#fd7e14',
            color: 'white',
            border: 'none',
            padding: '8px 12px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          Simulate Tab Key
        </button>

        <button
          onClick={getCurrentSuggestionInfo}
          style={{
            background: '#6f42c1',
            color: 'white',
            border: 'none',
            padding: '8px 12px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          Check State
        </button>

        <button
          onClick={clearAllSuggestions}
          style={{
            background: '#dc3545',
            color: 'white',
            border: 'none',
            padding: '8px 12px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          Clear All
        </button>
      </div>

      <div>
        <strong>Test Results:</strong>
        <div style={{
          background: '#212529',
          color: '#f8f9fa',
          padding: '12px',
          borderRadius: '4px',
          maxHeight: '200px',
          overflowY: 'auto',
          fontFamily: 'monospace',
          fontSize: '11px',
          marginTop: '8px'
        }}>
          {testResults.length === 0 ? (
            <div style={{ color: '#6c757d' }}>No test results yet. Click a button to start testing.</div>
          ) : (
            testResults.map((result, index) => (
              <div key={index} style={{ marginBottom: '2px' }}>
                {result}
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ 
        marginTop: '12px', 
        fontSize: '11px', 
        color: '#6c757d',
        background: '#f8f9fa',
        padding: '8px',
        borderRadius: '4px'
      }}>
        <strong>Instructions:</strong>
        <ol style={{ margin: '4px 0', paddingLeft: '16px' }}>
          <li>Click "Create Test Suggestion" to add a suggestion</li>
          <li>Press the actual Tab key or click "Simulate Tab Key"</li>
          <li>Watch the console and test results for debug output</li>
          <li>Use "Check State" to see current suggestions</li>
        </ol>
      </div>
    </div>
  );
};

export default SuggestionTester;