/**
 * State Export Utility for WebSeek Testing
 * 
 * This module should be integrated into the WebSeek sidepanel
 * to allow easy export of the current system state for testing.
 * 
 * Usage: Add this to sidepanel.tsx and call exportStateForTesting()
 */

import { Instance, Message, ProactiveSuggestion } from './types';

interface SimplifiedSuggestion {
  type: string;
  description: string;
  priority: string;
  id: string;
}

interface SimplifiedInSituSuggestion {
  type: string;
  description: string;
  priority: string;
  id: string;
  instances: any[]; // The InstanceEvent[] that shows what will be added/updated
}

interface LatencyRecord {
  timestamp: number;
  type: 'micro' | 'macro';
  modality: 'in-situ' | 'peripheral';
  latencyMs: number;
  suggestionCount: number;
  success: boolean;
  aborted: boolean;
}

interface LatencyStatistics {
  micro: {
    count: number;
    avgLatencyMs: number;
    minLatencyMs: number;
    maxLatencyMs: number;
    medianLatencyMs: number;
    totalSuggestions: number;
    type: 'micro';
    modality: 'in-situ';
  };
  macro: {
    count: number;
    avgLatencyMs: number;
    minLatencyMs: number;
    maxLatencyMs: number;
    medianLatencyMs: number;
    totalSuggestions: number;
    type: 'macro';
    modality: 'peripheral';
  };
  overall: {
    totalGenerations: number;
    successfulGenerations: number;
    abortedGenerations: number;
    allRecords: LatencyRecord[];
  };
}

interface ExportedState {
  timestamp: string;
  instances: Instance[];
  instanceContext: any[];
  htmlContext: Record<string, {pageURL: string, htmlContent: string}>;
  conversationHistory: Message[];
  interactionLogs: string[];
  suggestions: SimplifiedSuggestion[]; // Peripheral suggestions only
  inSituSuggestions: SimplifiedInSituSuggestion[]; // In-situ suggestions with ghost preview data
  currentPageInfo: {pageId: string, url: string} | null;
  isInEditor: boolean;
  editingTableId: string | null;
  latencyData?: {
    records: LatencyRecord[];
    statistics: LatencyStatistics;
  };
}

/**
 * Export current WebSeek state for testing
 */
export function exportStateForTesting(
  instances: Instance[],
  htmlContext: Record<string, {pageURL: string, htmlContent: string}>,
  messages: Message[],
  logs: string[],
  suggestions: ProactiveSuggestion[],
  currentPageInfo: {pageId: string, url: string} | null,
  isInEditor: boolean,
  editingTableId: string | null,
  latencyRecords?: LatencyRecord[],
  latencyStatistics?: LatencyStatistics
): ExportedState {
  // Convert instances to the InstanceEvent format expected by the prompt
  const instanceContext = instances.map(instance => ({
    action: 'add',
    instance: instance
  }));

  // Separate peripheral and in-situ suggestions
  const peripheralSuggestions = suggestions.filter(s => s.modality === 'peripheral');
  const inSituSuggestions = suggestions.filter(s => s.modality === 'in-situ');

  const state: ExportedState = {
    timestamp: new Date().toISOString(),
    instances,
    instanceContext,
    htmlContext,
    conversationHistory: messages.map(msg => ({
      role: msg.role,
      message: msg.message,
      chatType: msg.chatType,
      operations: msg.operations
    })),
    interactionLogs: logs,
    suggestions: peripheralSuggestions.map(s => ({
      type: s.category,
      description: s.message,
      priority: s.priority,
      id: s.id
    })),
    inSituSuggestions: inSituSuggestions.map(s => ({
      type: s.category,
      description: s.message,
      priority: s.priority,
      id: s.id,
      instances: s.instances // Include the InstanceEvent[] for ghost preview
    })),
    currentPageInfo,
    isInEditor,
    editingTableId
  };

  // Add latency data if available
  if (latencyRecords && latencyStatistics) {
    state.latencyData = {
      records: latencyRecords,
      statistics: latencyStatistics
    };
  }

  return state;
}

/**
 * Copy state to clipboard as JSON
 */
export async function copyStateToClipboard(state: ExportedState): Promise<boolean> {
  try {
    const json = JSON.stringify(state, null, 2);
    await navigator.clipboard.writeText(json);
    console.log('✓ State copied to clipboard');
    return true;
  } catch (error) {
    console.error('Failed to copy state:', error);
    return false;
  }
}

/**
 * Download state as JSON file
 * Now creates files in the combined suggestion format for compatibility with labeling UI
 */
export function downloadStateAsFile(state: ExportedState, filename?: string): void {
  const timestamp = Date.now();
  
  // Wrap the state in the combined suggestion format
  // This makes manual exports compatible with the labeling UI
  const combinedFormat = {
    timestamp: new Date(timestamp).toISOString(),
    suggestionId: `manual-export-${timestamp}`,
    suggestionType: "macro",
    suggestionModality: "peripheral",
    suggestion: {
      id: `manual-export-${timestamp}`,
      message: "Manual state export (no suggestion applied)",
      scope: "macro",
      modality: "peripheral",
      priority: "N/A",
      confidence: 0,
      category: "manual-export",
      ruleIds: [],
      instances: [],
      toolCall: null,
      toolSequence: null
    },
    // For manual exports, stateBefore and stateAfter are the same
    stateBefore: state,
    stateAfter: state,
    changes: {
      instanceCountBefore: state.instances.length,
      instanceCountAfter: state.instances.length,
      instanceCountDelta: 0,
      messageCountBefore: state.conversationHistory?.length || 0,
      messageCountAfter: state.conversationHistory?.length || 0,
      messageCountDelta: 0
    }
  };
  
  const json = JSON.stringify(combinedFormat, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  // Use combined format filename for consistency
  a.download = filename || `suggestion_macro_combined_${timestamp}.json`;
  document.body.appendChild(a);
  a.click();
  
  // Delay cleanup to ensure download starts
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
  
  console.log('✓ State downloaded as file in combined format');
}

/**
 * Create a testing panel button component (React)
 */
export function TestingExportButton({
  instances,
  htmlContext,
  messages,
  logs,
  suggestions,
  currentPageInfo,
  isInEditor,
  editingTableId,
  proactiveService
}: {
  instances: Instance[];
  htmlContext: Record<string, {pageURL: string, htmlContent: string}>;
  messages: Message[];
  logs: string[];
  suggestions: ProactiveSuggestion[];
  currentPageInfo: {pageId: string, url: string} | null;
  isInEditor: boolean;
  editingTableId: string | null;
  proactiveService?: any; // EnhancedProactiveService instance
}) {
  const handleExport = async () => {
    // Get latency data if proactive service is available
    let latencyRecords: LatencyRecord[] | undefined;
    let latencyStatistics: LatencyStatistics | undefined;
    
    if (proactiveService) {
      try {
        latencyRecords = proactiveService.getLatencyRecords();
        latencyStatistics = proactiveService.getLatencyStatistics();
        console.log('[TestingExport] Latency data included:', {
          recordCount: latencyRecords?.length || 0,
          microCount: latencyStatistics?.micro.count || 0,
          macroCount: latencyStatistics?.macro.count || 0
        });
      } catch (error) {
        console.warn('[TestingExport] Failed to get latency data:', error);
      }
    }
    
    const state = exportStateForTesting(
      instances,
      htmlContext,
      messages,
      logs,
      suggestions,
      currentPageInfo,
      isInEditor,
      editingTableId,
      latencyRecords,
      latencyStatistics
    );
    
    // For large states, always download as file (more reliable)
    const stateSize = JSON.stringify(state).length;
    
    {
      // Small state - try clipboard first
      const copied = await copyStateToClipboard(state);
      if (copied) {
        alert('✓ State copied to clipboard!\n\nPaste it into the testing harness when prompted.');
      } else {
        // Fallback to download
        downloadStateAsFile(state);
        alert('✓ State downloaded as JSON file in combined format!\n\nThe file is now compatible with the labeling UI.');
      }
    }
  };

  return (
    <button
      onClick={handleExport}
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 10000,
        padding: '10px 15px',
        backgroundColor: '#4CAF50',
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 'bold',
        boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
      }}
      title="Export current state for testing"
    >
      📤 Export State
    </button>
  );
}
