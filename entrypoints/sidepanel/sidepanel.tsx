// sidepanel.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import InstanceView from './components/instanceview.tsx';
import { Instance, ProactiveSuggestion } from './types.tsx';
import './sidepanel.css';
import { Message } from './types.tsx';
import ToolView from './components/toolview.tsx';
import websocketService from './websocket';
import { proactiveService } from './proactive-service-enhanced';
import { actionMonitor } from './action-monitor';
import SuggestionIndicator from './components/SuggestionIndicator.tsx';
import ProactiveSettings from './components/ProactiveSettings.tsx';
import { executeMacroTool } from './macro-tool-executor';
import { chatWithAgent } from './apis';
import { requestSuggestionRefinement as refinementAPI } from './refinement-api';
import WorkspaceNameModal from './components/WorkspaceNameModal.tsx';
import { updateInstances } from './utils';
import { globalUndoManager } from './global-undo-manager';
import { systemLogger } from './system-logger';
import { TestingExportButton } from './testing-export.tsx';

// Helper function for logging macro suggestion applications
const logMacroSuggestionApplication = async (
  suggestion: ProactiveSuggestion,
  state: any,
  phase: 'before' | 'after'
) => {
  try {
    const timestamp = Date.now();
    const suggestionType = suggestion.scope === 'micro' ? 'micro' : 'macro';
    const logData = {
      timestamp: new Date(timestamp).toISOString(),
      phase,
      suggestionId: suggestion.id,
      suggestionType,
      suggestionModality: suggestion.modality,
      suggestion: {
        id: suggestion.id,
        message: suggestion.message,
        scope: suggestion.scope,
        modality: suggestion.modality,
        priority: suggestion.priority,
        confidence: suggestion.confidence,
        category: suggestion.category,
        ruleIds: (suggestion as any).ruleIds,
        instances: suggestion.instances,
        toolCall: (suggestion as any).toolCall,
        toolSequence: (suggestion as any).toolSequence
      },
      state
    };

    console.log(`[SuggestionApplicationLog] ${phase.toUpperCase()} - ${suggestionType} suggestion:`, {
      suggestionId: suggestion.id,
      message: suggestion.message.slice(0, 100),
      instanceCount: state.instances?.length || 0
    });

    const filename = `suggestion_${suggestionType}_${phase}_${timestamp}.json`;
    const blob = new Blob([JSON.stringify(logData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log(`[SuggestionApplicationLog] Saved ${phase} log to ${filename}`);
  } catch (error) {
    console.error('[SuggestionApplicationLog] Error logging suggestion application:', error);
  }
};

// Helper function for logging combined before/after comparison
const logMacroSuggestionApplicationCombined = async (
  suggestion: ProactiveSuggestion,
  stateBefore: any,
  stateAfter: any
) => {
  try {
    const timestamp = Date.now();
    const suggestionType = suggestion.scope === 'micro' ? 'micro' : 'macro';
    const logData = {
      timestamp: new Date(timestamp).toISOString(),
      suggestionId: suggestion.id,
      suggestionType,
      suggestionModality: suggestion.modality,
      suggestion: {
        id: suggestion.id,
        message: suggestion.message,
        scope: suggestion.scope,
        modality: suggestion.modality,
        priority: suggestion.priority,
        confidence: suggestion.confidence,
        category: suggestion.category,
        ruleIds: (suggestion as any).ruleIds,
        instances: suggestion.instances,
        toolCall: (suggestion as any).toolCall,
        toolSequence: (suggestion as any).toolSequence
      },
      stateBefore,
      stateAfter,
      changes: {
        instanceCountBefore: stateBefore.instances?.length || 0,
        instanceCountAfter: stateAfter.instances?.length || 0,
        instanceCountDelta: (stateAfter.instances?.length || 0) - (stateBefore.instances?.length || 0),
        messageCountBefore: stateBefore.messages?.length || 0,
        messageCountAfter: stateAfter.messages?.length || 0,
        messageCountDelta: (stateAfter.messages?.length || 0) - (stateBefore.messages?.length || 0)
      }
    };

    console.log(`[SuggestionApplicationLog] COMBINED - ${suggestionType} suggestion:`, {
      suggestionId: suggestion.id,
      message: suggestion.message.slice(0, 100),
      changes: logData.changes
    });

    const filename = `suggestion_${suggestionType}_combined_${timestamp}.json`;
    console.log(`[SuggestionApplicationLog] Preparing download: ${filename}`);
    const blob = new Blob([JSON.stringify(logData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    console.log(`[SuggestionApplicationLog] Triggering download click for ${filename}`);
    a.click();
    
    // Delay cleanup to give browser time to start the download
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      console.log(`[SuggestionApplicationLog] Download cleanup completed for ${filename}`);
    }, 100);

    console.log(`[SuggestionApplicationLog] Saved combined log to ${filename}`);
  } catch (error) {
    console.error('[SuggestionApplicationLog] Error logging combined suggestion application:', error);
  }
};

const SidePanel = () => {
  console.log('[SidePanel] Component mounting/re-mounting');
  
  // Initialize system logging for this workspace session
  useEffect(() => {
    systemLogger.setContext(undefined, 'webseek_workspace');
    systemLogger.logUserAction('component_mount', 'sidepanel', {
      timestamp: new Date().toISOString()
    });
    
    return () => {
      systemLogger.logUserAction('component_unmount', 'sidepanel', {
        timestamp: new Date().toISOString()
      });
    };
  }, []);
  
  const [logs, setLogsInternal] = useState<string[]>([]);
  const logsRef = useRef<string[]>([]);
  const [htmlContext, setHtmlContexts] = useState<Record<string, {pageURL: string, htmlContent: string}>>({});
  const htmlContextRef = useRef<Record<string, {pageURL: string, htmlContent: string}>>({});
  const [htmlLoadingStates, setHtmlLoadingStates] = useState<Record<string, boolean>>({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [agentLoading, setAgentLoading] = useState(false);
  const [instances, setInstancesInternal] = useState<Instance[]>([]);

  // Track component lifecycle
  useEffect(() => {
    console.log('[SidePanel] Component mounted, checking undo manager state');
    console.log('[SidePanel] Undo manager can undo:', globalUndoManager.canUndo());
    console.log('[SidePanel] Undo manager can redo:', globalUndoManager.canRedo());
    console.log('[SidePanel] Current history length:', globalUndoManager.getHistory().length);
    
    // Check if we have persisted state from a component remount during undo
    try {
      const pendingUndo = sessionStorage.getItem('pendingUndoState');
      if (pendingUndo) {
        const undoData = JSON.parse(pendingUndo);
        console.log('[SidePanel] Found pending undo state, applying:', undoData);
        
        setInstancesInternal(undoData.instances);
        setLogsInternal(undoData.logs);
        logsRef.current = undoData.logs;
        
        // Clear the pending state
        sessionStorage.removeItem('pendingUndoState');
      }
    } catch (error) {
      console.log('[SidePanel] Failed to restore pending undo state:', error);
    }
    
    return () => {
      console.log('[SidePanel] Component unmounting');
    };
  }, []);

  // Wrapper for setInstances with logging
  const setInstances = useCallback((newStateOrUpdater: React.SetStateAction<Instance[]>) => {
    console.log('[SidePanel] setInstances called directly (not through recordable)');
    console.log('[SidePanel] setInstances newState:', typeof newStateOrUpdater === 'function' ? 'function' : newStateOrUpdater);
    console.log('[SidePanel] Stack trace for direct setInstances call:');
    console.trace();
    setInstancesInternal(newStateOrUpdater);
  }, []);

  // Wrapper for setLogs with logging
  const setLogs = useCallback((newStateOrUpdater: React.SetStateAction<string[]>) => {
    console.log('[SidePanel] setLogs called directly');
    console.log('[SidePanel] setLogs newState:', typeof newStateOrUpdater === 'function' ? 'function' : newStateOrUpdater);
    console.log('[SidePanel] Stack trace for direct setLogs call:');
    console.trace();
    setLogsInternal(newStateOrUpdater);
  }, []);
  
  // Proactive suggestion state
  const [suggestions, setSuggestions] = useState<ProactiveSuggestion[]>([]);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const isGeneratingSuggestionsRef = useRef(false); // For real-time state checking
  const [showSettings, setShowSettings] = useState(false);
  
  // Workspace naming state
  const [workspaceName, setWorkspaceName] = useState<string>('');
  const [showWorkspaceNameModal, setShowWorkspaceNameModal] = useState(false);
  const [hasShownWorkspaceModal, setHasShownWorkspaceModal] = useState(false);
  
  // Tool view height mode state
  const [toolViewHeightMode, setToolViewHeightMode] = useState<'minimum' | 'small' | 'large'>('small');
  
  // Debug: Track instances changes
  useEffect(() => {
    console.log('[SidePanel] Instances state changed:', {
      count: instances.length,
      instances: instances.map(i => ({ id: i.id, type: i.type })),
      stackTrace: new Error('State change').stack?.split('\n').slice(1, 4)
    });
    
    // Check for suspicious empty state
    if (instances.length === 0 && logs.length === 0) {
      console.warn('[SidePanel] WARNING: Both instances and logs are empty! This might be a state reset.');
      console.trace('[SidePanel] Empty state stack trace');
    }
  }, [instances]);

  // Debug: Track logs changes  
  useEffect(() => {
    console.log('[SidePanel] Logs state changed:', {
      count: logs.length,
      logs: logs,
      stackTrace: new Error('Log change').stack?.split('\n').slice(1, 4)
    });
  }, [logs]);
  
  // Editor context state - tracks if user is currently in any editor
  const [isInEditor, setIsInEditor] = useState(false);
  
  // Currently editing table ID - for constraining suggestions to only the editing table
  const [editingTableId, setEditingTableId] = useState<string | null>(null);
  
  // Capture mode state - tracks if user is currently in element capture mode
  const [isInCaptureMode, setIsInCaptureMode] = useState(false);

  // Current page info for HTML context fetching
  const [currentPageInfo, setCurrentPageInfo] = useState<{pageId: string, url: string} | null>(null);
  const currentPageInfoRef = useRef<{pageId: string, url: string} | null>(null);

  // Callbacks from InstanceView for programmatic control
  const instanceViewCallbacks = useRef<{
    saveTable: () => void;
    closeTableEditor: () => void;
    openVisualizationEditor: (spec: any) => void;
    // isInVisualizationEditor: () => boolean;
    // saveCurrentVisualization: () => boolean;
    // hasNonEmptyVisualization: () => boolean;
  } | null>(null);

  // Callback to notify MultiTableEditor about external table modifications
  const multiTableEditorCallbacks = useRef<{
    markTableDirty: (tableId: string) => void;
  } | null>(null);

  // Helper function to update currentPageInfo both in state and ref
  const updateCurrentPageInfo = useCallback((newPageInfo: {pageId: string, url: string} | null) => {
    console.log('[SidePanel] updateCurrentPageInfo called:', { 
      from: currentPageInfoRef.current, 
      to: newPageInfo,
      caller: new Error().stack?.split('\n')[2]?.trim() // Add caller info for debugging
    });
    setCurrentPageInfo(newPageInfo);
    currentPageInfoRef.current = newPageInfo;
    
    // Update proactive service with current page info
    proactiveService.updateContext({
      currentPageInfo: newPageInfo
    });
    
    // Log the page change for system logging
    if (newPageInfo) {
      systemLogger.logUserAction('page_activated', 'SidePanel', {
        pageId: newPageInfo.pageId,
        url: newPageInfo.url,
        timestamp: new Date().toISOString()
      });
    }
  }, []);

  // Handle external table modifications (e.g., from chat)
  const handleTableModified = useCallback((tableId: string) => {
    console.log(`[SidePanel] External table modification detected: ${tableId}`);
    if (multiTableEditorCallbacks.current?.markTableDirty) {
      console.log(`[SidePanel] Marking table ${tableId} as dirty via MultiTableEditor callback`);
      multiTableEditorCallbacks.current.markTableDirty(tableId);
    } else {
      console.log(`[SidePanel] MultiTableEditor callback not available, table ${tableId} dirty state not updated`);
    }
  }, []);

  // Handle HTML loading state changes from InstanceView
  const handleHTMLLoadingStatesChange = useCallback((loadingStates: Record<string, boolean>) => {
    setHtmlLoadingStates(loadingStates);
  }, []);

  const addLog = (message: string, actionDetails?: {
    type: string;
    context?: any;
    instanceId?: string;
    metadata?: any;
  }, recordInUndo: boolean = true) => {
    const previousLogs = [...logsRef.current];
    const updatedLogs = [...logsRef.current, message];
    console.log('[SidePanel] Adding log:', {
      message,
      previousLogsCount: previousLogs.length,
      updatedLogsCount: updatedLogs.length,
      previousLogs,
      updatedLogs,
      recordInUndo
    });
    
    // System logging for data analysis
    systemLogger.logUserAction('add_log', 'history', {
      message,
      actionDetails,
      recordInUndo,
      logCount: updatedLogs.length
    }, {
      instanceCount: instances.length,
      tableCount: instances.filter(i => i.type === 'table').length,
      visualizationCount: instances.filter(i => i.type === 'visualization').length
    });
    
    setLogsInternal(updatedLogs);
    logsRef.current = updatedLogs;
    
    // Record this log change for undo/redo only if requested
    if (recordInUndo) {
      console.log('[SidePanel] Recording log change in undo manager:', {
        instancesCount: instances.length,
        previousLogsCount: previousLogs.length,
        newLogsCount: updatedLogs.length,
        description: message
      });
      
      globalUndoManager.recordStateChange({
        previousState: instances,
        newState: instances, // Instances don't change when adding logs
        previousLogs: previousLogs,
        newLogs: updatedLogs,
        description: message,
        undoable: true
      });
    } else {
      console.log('[SidePanel] Skipping undo recording for log (will be recorded by accompanying instance change)');
    }
    
    // Always record action for monitoring regardless of undo recording
    if (actionDetails) {
      actionMonitor.recordAction(
        actionDetails.type,
        actionDetails.context || { message },
        actionDetails.instanceId,
        actionDetails.metadata
      );
    } else {
      // Fallback to parsing for any logs that don't provide action details
      recordUserActionFromLog(message);
    }
    
    // Always trigger proactive suggestions on log updates
    console.log("Triggering proactive suggestions due to logs update", updatedLogs);
    proactiveService.triggerLogsUpdate(updatedLogs);
  };

  /**
   * Legacy log message parser - now only used as fallback for logs that don't provide action details
   * Most operations should now record actions directly via the actionDetails parameter
   */
  const recordUserActionFromLog = (message: string) => {
    console.log('[SidePanel] Falling back to legacy log parsing for message:', message);
    
    // Table editor operations
    if (message.includes('Opened table editor')) {
      const instanceId = extractInstanceId(message);
      actionMonitor.recordAction(
        'table-selected',
        { message, editorOpened: true },
        instanceId
      );
    }
    // Table cell edits (Added/Appended to cell)
    else if (message.includes('cell (') && (message.includes('Added') || message.includes('Appended'))) {
      const instanceId = extractInstanceId(message);
      const cellMatch = message.match(/cell \((\d+), ([A-Z])\)/);
      if (cellMatch) {
        actionMonitor.recordAction(
          'cell-edited',
          { 
            message,
            cellPosition: `${cellMatch[2]}${cellMatch[1]}`
          },
          instanceId,
          {
            column: cellMatch[2].charCodeAt(0) - 65, // Convert A,B,C to 0,1,2
            row: parseInt(cellMatch[1]) - 1, // Convert 1,2,3 to 0,1,2
            editType: message.includes('Added') ? 'add-content' : 'append-content'
          }
        );
      }
    }
    // Element selection
    else if (message.includes('Selected') && !message.includes('table-selected')) {
      actionMonitor.recordAction(
        'element-selected',
        { pageId: 'current', selector: 'element', message },
        undefined,
        { elementType: 'generic' }
      );
    }
    // Visualization creation
    else if (message.includes('Created') && message.includes('visualization')) {
      const instanceId = extractInstanceId(message);
      actionMonitor.recordAction(
        'visualization-created',
        { message },
        instanceId
      );
    }
    // Instance creation (general)
    else if (message.includes('Created') && (message.includes('Image') || message.includes('Text') || message.includes('Table') || message.includes('Sketch'))) {
      const instanceId = extractInstanceId(message);
      let instanceType = 'unknown';
      if (message.includes('Image')) instanceType = 'image';
      else if (message.includes('Text')) instanceType = 'text';
      else if (message.includes('Table')) instanceType = 'table';
      else if (message.includes('Sketch')) instanceType = 'sketch';
      
      actionMonitor.recordAction(
        'instance-created',
        { message, instanceType },
        instanceId,
        { instanceType }
      );
    }
  };

  /**
   * Extract instance ID from log message
   */
  const extractInstanceId = (message: string): string | undefined => {
    const match = message.match(/"([^"]+)"/);
    return match ? match[1] : undefined;
  };

  const addMessage = (message: Message) => {
    setMessages(prev => [...prev, message]);
  };

  // Workspace naming handlers
  const handleSaveWorkspaceName = useCallback((name: string) => {
    setWorkspaceName(name);
    setShowWorkspaceNameModal(false);
    setHasShownWorkspaceModal(true);
    
    // Store workspace name in localStorage for persistence
    localStorage.setItem('webseek_workspace_name', name);
    
    // Record the workspace naming action
    actionMonitor.recordAction(
      'workspace-titled',
      { name },
      undefined,
      { workspaceName: name }
    );
    
    // System logging
    systemLogger.logUserAction('workspace_named', 'workspace', {
      workspaceName: name,
      nameLength: name.length
    });
    systemLogger.setContext(undefined, name);
    
    addLog(`Named workspace "${name}"`, {
      type: 'workspace-titled',
      context: { name },
      metadata: { workspaceName: name }
    });
  }, [addLog]);

  const handleSkipWorkspaceNaming = useCallback(() => {
    // Set default name when skipping
    const defaultName = 'Instance View';
    setWorkspaceName(defaultName);
    localStorage.setItem('webseek_workspace_name', defaultName);
    setShowWorkspaceNameModal(false);
    setHasShownWorkspaceModal(true);
    
    // Log the skip action
    addLog('Skipped workspace naming, using default name', {
      type: 'workspace-skipped',
      context: { defaultName },
      metadata: { workspaceName: defaultName }
    });
  }, [addLog]);

  const handleCancelWorkspaceNaming = useCallback(() => {
    setShowWorkspaceNameModal(false);
  }, []);

  // Handle workspace name change from InstanceView
  const handleWorkspaceNameChange = useCallback((newName: string) => {
    const trimmedName = newName.trim().slice(0, 30); // Ensure max 30 chars
    setWorkspaceName(trimmedName);
    
    // Store in localStorage for persistence
    localStorage.setItem('webseek_workspace_name', trimmedName);
    
    // Record the workspace renaming action
    actionMonitor.recordAction(
      'workspace-renamed',
      { oldName: workspaceName, newName: trimmedName },
      undefined,
      { workspaceName: trimmedName }
    );
    
    addLog(`Renamed workspace to "${trimmedName}"`, {
      type: 'workspace-renamed',
      context: { oldName: workspaceName, newName: trimmedName },
      metadata: { workspaceName: trimmedName }
    });
  }, [workspaceName, addLog]);

  // Load workspace name from localStorage on mount and show modal if needed
  useEffect(() => {
    const savedName = localStorage.getItem('webseek_workspace_name');
    if (savedName) {
      setWorkspaceName(savedName);
      setHasShownWorkspaceModal(true);
    } else {
      // Show workspace naming modal immediately when sidepanel opens (if no saved name)
      setShowWorkspaceNameModal(true);
    }
  }, []);

  // Function to get current page information and trigger HTML content fetching
  const initializeCurrentPageContext = useCallback(async () => {
    try {
      // Get the current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url || !tab.id) {
        console.warn('[SidePanel] No active tab found');
        return;
      }

      console.log('[SidePanel] Requesting page snapshot from content script for:', tab.url);
      
      // Send message to content script to create snapshot and get pageId
      try {
        const response = await chrome.tabs.sendMessage(tab.id, {
          type: 'CREATE_SNAPSHOT_AND_GET_ID'
        });
        
        if (response?.pageId) {
          console.log('[SidePanel] Got pageId from content script:', response.pageId);
          const newPageInfo = { pageId: response.pageId, url: tab.url };
          updateCurrentPageInfo(newPageInfo);
          
          // Now fetch the HTML content using the pageId
          const fetchHtmlContent = async (retryCount = 0) => {
            try {
              // Use background script proxy to avoid HTTPS/HTTP mixed content issues
              const backendUrl = `http://${import.meta.env.VITE_BACKEND_URL}`; // Force HTTP
              const fetchResponse = await chrome.runtime.sendMessage({
                type: 'PROXY_FETCH',
                url: `${backendUrl}/api/snapshots/${response.pageId}`,
                options: { method: 'GET' }
              });
              
              if (fetchResponse?.ok) {
                const snapshotData = JSON.parse(fetchResponse.data);
                console.log('[SidePanel] Successfully fetched HTML content for current page');
                
                const newHtmlContext = {
                  [response.pageId]: {
                    pageURL: tab.url,
                    htmlContent: snapshotData.htmlContent
                  }
                };
                
                setHtmlContexts(prev => {
                  const updated = { ...prev, ...newHtmlContext };
                  
                  // Update proactive service immediately with the new HTML context
                  proactiveService.updateContext({
                    htmlContexts: updated
                  });
                  
                  return updated;
                });
                
                // Small delay to ensure state is updated, then trigger suggestions
                setTimeout(() => {
                  console.log('[SidePanel] Triggering proactive suggestions after HTML context loaded');
                  proactiveService.triggerLogsUpdate(logsRef.current);
                }, 100);
              } else if (fetchResponse?.status === 404 && retryCount < 3) {
                // Snapshot not ready yet, retry after exponential backoff delay
                const delayMs = Math.min(1000 * Math.pow(2, retryCount), 5000); // 1s, 2s, 4s max
                console.log(`[SidePanel] Snapshot not ready, retrying in ${delayMs}ms... (attempt ${retryCount + 1}/3)`);
                setTimeout(() => fetchHtmlContent(retryCount + 1), delayMs);
              } else {
                console.warn('[SidePanel] Failed to fetch snapshot:', fetchResponse?.status || 'Unknown error', 'after', retryCount, 'retries');
              }
            } catch (error) {
              if (retryCount < 3) {
                console.log(`[SidePanel] Error fetching HTML, retrying in ${(retryCount + 1) * 1000}ms:`, error);
                setTimeout(() => fetchHtmlContent(retryCount + 1), (retryCount + 1) * 1000);
              } else {
                console.warn('[SidePanel] Error fetching HTML content after retries:', error);
              }
            }
          };
          
          setTimeout(fetchHtmlContent, 2000); // Wait 2 seconds for the snapshot to be created
        } else {
          console.warn('[SidePanel] Content script did not return pageId');
        }
      } catch (error) {
        console.warn('[SidePanel] Failed to communicate with content script:', error);
      }
      
    } catch (error) {
      console.error('[SidePanel] Error getting current page info:', error);
    }
  }, []);

  // Initialize current page context
  useEffect(() => {
    initializeCurrentPageContext();
  }, [initializeCurrentPageContext]);

  // Listen for tab navigation and activation to automatically update HTML context
  useEffect(() => {
    const handleTabUpdated = (tabId: number, changeInfo: any, tab: any) => {
      // Only process complete navigation events for the current tab
      if (changeInfo.status === 'complete' && tab.url) {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
          if (tabs[0]?.id === tabId) {
            console.log('[SidePanel] Navigation detected to:', tab.url);
            console.log('[SidePanel] Current page info before update:', currentPageInfoRef.current);
            // Re-initialize page context for the new URL
            await initializeCurrentPageContext();
            console.log('[SidePanel] Re-initialized page context after navigation');
          }
        });
      }
    };

    const handleTabActivated = (activeInfo: { tabId: number; windowId: number }) => {
      // When user switches to a different tab, update the page context
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        if (tabs[0]) {
          const currentTab = tabs[0];
          console.log('[SidePanel] Tab activation detected:', { 
            tabId: activeInfo.tabId, 
            url: currentTab.url,
            currentPageInfo: currentPageInfoRef.current 
          });
          
          // Check if we're switching to a different page
          const currentPageUrl = currentPageInfoRef.current?.url;
          if (currentTab.url && currentTab.url !== currentPageUrl) {
            console.log('[SidePanel] Switching to different page, re-initializing context');
            await initializeCurrentPageContext();
          } else if (currentTab.url === currentPageUrl) {
            console.log('[SidePanel] Same page detected, no context re-initialization needed');
          } else {
            console.log('[SidePanel] Tab has no URL or invalid state, skipping');
          }
        }
      });
    };

    // Add listeners for both tab updates (navigation) and activation (switching)
    chrome.tabs.onUpdated.addListener(handleTabUpdated);
    chrome.tabs.onActivated.addListener(handleTabActivated);

    return () => {
      chrome.tabs.onUpdated.removeListener(handleTabUpdated);
      chrome.tabs.onActivated.removeListener(handleTabActivated);
    };
  }, [initializeCurrentPageContext]);

  // Update proactive service when editor context changes
  useEffect(() => {
    console.log('[SidePanel] Editor state changed:', isInEditor);
    proactiveService.updateContext({ isInEditor });
  }, [isInEditor]);

  // Initialize proactive service
  useEffect(() => {
    // Set up proactive service listeners
    proactiveService.onSuggestionsChange((newSuggestions) => {
      console.log('[SidePanel] 📥 Received suggestion update from service:', {
        count: newSuggestions.length,
        suggestionIds: newSuggestions.map(s => s.id),
        suggestionMessages: newSuggestions.map(s => s.message.substring(0, 50) + '...'),
        timestamp: new Date().toISOString()
      });
      setSuggestions(newSuggestions);
      
      // Check current generation state when suggestions are received
      const serviceState = proactiveService.getGenerationState();
      console.log('[SidePanel] 📥 Service generation state when suggestions received:', serviceState);
      
      // NOTE: Do NOT set isGeneratingSuggestions here - let the generation state callback handle it
      // This allows proper micro/macro state coordination
    });

    // Periodic sync to prevent UI/service state drift
    const syncInterval = setInterval(() => {
      const serviceSuggestions = proactiveService.getCurrentSuggestions();
      setSuggestions(prev => {
        const prevIds = prev.map(s => s.id).sort();
        const serviceIds = serviceSuggestions.map(s => s.id).sort();
        
        // Only update if there's a difference
        if (JSON.stringify(prevIds) !== JSON.stringify(serviceIds)) {
          console.log('[SidePanel] Syncing suggestions - UI had:', prevIds, 'Service has:', serviceIds);
          return serviceSuggestions;
        }
        return prev;
      });
    }, 5000); // Check every 5 seconds

    proactiveService.onSuggestionAccept((suggestion) => {
      // Handle suggestion acceptance - apply instance changes
      setInstances(currentInstances => {
        const updatedInstances = [...currentInstances];
        updateInstances(updatedInstances, suggestion.instances, (newInstances) => {
          Object.assign(updatedInstances, newInstances);
        });
        return updatedInstances;
      });
      
      // Check if any tables were modified and mark them as dirty in the editor
      if (suggestion.instances) {
        const modifiedTableIds = new Set<string>();
        
        suggestion.instances.forEach(instanceEvent => {
          if (instanceEvent.action === 'update' && instanceEvent.targetId) {
            // Find the instance being updated to check if it's a table
            const targetInstance = instances.find(inst => inst.id === instanceEvent.targetId);
            if (targetInstance && targetInstance.type === 'table') {
              modifiedTableIds.add(instanceEvent.targetId);
            }
          } else if (instanceEvent.action === 'add' && instanceEvent.instance?.type === 'table') {
            // New table created
            if (instanceEvent.instance.id) {
              modifiedTableIds.add(instanceEvent.instance.id);
            }
          }
        });
        
        // Mark all modified tables as dirty
        modifiedTableIds.forEach(tableId => {
          console.log(`[SidePanel] Suggestion modified table ${tableId}, marking as dirty`);
          handleTableModified(tableId);
        });
      }
      
      // Only log for suggestions that don't have tool sequences (to avoid duplicate logs)
      // Tool sequence suggestions will be logged when the sequence executes successfully
      if (!suggestion.toolSequence) {
        // Log the operation with updated cell details
        const updatedCells = suggestion.instances
          .filter(event => event.action === 'update' && event.instance?.type === 'table')
          .map(event => {
            const table = event.instance as any;
            const cellUpdates: string[] = [];
            if (table?.cells) {
              table.cells.forEach((row: any[], rowIndex: number) => {
                if (row && Array.isArray(row)) {
                  row.forEach((cell: any, colIndex: number) => {
                    if (cell) {
                      cellUpdates.push(`R${rowIndex}C${colIndex}`);
                    }
                  });
                }
              });
            }
            return cellUpdates;
          })
          .flat();
        
        addLog(`Applied suggestion${updatedCells.length > 0 ? ` - Updated cells: ${updatedCells.join(', ')}` : ''}`);
        
        // System logging for suggestion acceptance
        systemLogger.logUserAction('suggestion_accepted', 'proactive_suggestions', {
          suggestionId: suggestion.id,
          suggestionScope: suggestion.scope,
          suggestionModality: suggestion.modality,
          suggestionCategory: suggestion.category,
          confidence: suggestion.confidence,
          updatedCellsCount: updatedCells.length,
          hasToolSequence: !!suggestion.toolSequence,
          hasToolCall: !!suggestion.toolCall,
          instancesAffected: suggestion.instances?.length || 0
        }, {
          instanceCount: instances.length,
          tableCount: instances.filter(i => i.type === 'table').length
        });
      }
    });

    proactiveService.onGenerationStateChange((isGenerating) => {
      console.log('[SidePanel] 🎯 Generation state callback received:', {
        isGenerating,
        timestamp: new Date().toISOString(),
        previousReactState: isGeneratingSuggestionsRef.current
      });
      setIsGeneratingSuggestions(isGenerating);
      isGeneratingSuggestionsRef.current = isGenerating; // Update ref immediately
      
      // Also log the service's internal state for comparison
      const serviceState = proactiveService.getGenerationState();
      console.log('[SidePanel] 🎯 Service internal state when callback fired:', serviceState);
    });

    return () => {
      clearInterval(syncInterval);
      proactiveService.destroy();
    };
  }, []);

  // Update context for proactive suggestions
  useEffect(() => {
    proactiveService.updateContext({
      instances,
      messages,
      htmlContexts: htmlContext,
      htmlLoadingStates,
      editingTableId
    });
  }, [instances, messages, htmlContext, htmlLoadingStates, editingTableId]);

  useEffect(() => {
    logsRef.current = logs;
  }, [logs]);

  useEffect(() => {
    htmlContextRef.current = htmlContext;
  }, [htmlContext]);

  // Connect websocket on mount, cleanup on unmount
  useEffect(() => {
    websocketService.connect();
    return () => {
      websocketService.disconnect();
    };
  }, []);

  // Set up global undo/redo system
  useEffect(() => {
    console.log('[SidePanel] Setting up global undo/redo system');
    console.log('[SidePanel] Current state:', { 
      instancesCount: instances.length, 
      logsCount: logs.length 
    });
    
    // Only initialize if not already initialized (prevent overwriting existing history)
    if (globalUndoManager.getHistoryLength() === 0) {
      console.log('[SidePanel] Initializing with current state as baseline');
      globalUndoManager.initializeWithState(instances, logs, 'Initial application state');
    } else {
      console.log('[SidePanel] Global undo manager already initialized with', globalUndoManager.getHistoryLength(), 'entries');
    }

    // Register global keyboard shortcuts
    const cleanupShortcuts = globalUndoManager.registerGlobalKeyboardShortcuts();

    // Listen for global state changes from undo/redo
    const handleGlobalStateChange = (event: CustomEvent) => {
      console.log('[SidePanel] Applying global state from undo/redo:', event.detail.description);
      console.log('[SidePanel] Event detail:', {
        instancesCount: event.detail.instances.length,
        logsCount: event.detail.logs?.length || 0,
        logs: event.detail.logs
      });
      
      console.log('[SidePanel] Current state before applying:', {
        currentInstancesCount: instances.length,
        currentLogsCount: logs.length,
        currentLogs: logs
      });
      
      // Save the undo state to survive potential component remounting
      try {
        sessionStorage.setItem('pendingUndoState', JSON.stringify({
          instances: event.detail.instances,
          logs: event.detail.logs
        }));
      } catch (error) {
        console.log('[SidePanel] Failed to save pending undo state:', error);
      }
      
      // Use setTimeout to ensure this happens after any component re-mounting
      setTimeout(() => {
        console.log('[SidePanel] Applying undo/redo state after component stabilization');
        setInstancesInternal(event.detail.instances);
        if (event.detail.logs) {
          console.log('[SidePanel] Setting logs to:', event.detail.logs);
          setLogsInternal(event.detail.logs);
          logsRef.current = event.detail.logs;
        }
        
        // Check if the currently editing table still exists after state restoration
        if (editingTableId && !event.detail.instances.find((inst: Instance) => inst.id === editingTableId)) {
          console.log('[SidePanel] Clearing editingTableId as table no longer exists after undo/redo:', editingTableId);
          setEditingTableId(null);
        }
        
        console.log('[SidePanel] Global state change applied');
        
        // Clear the pending state since we applied it successfully
        try {
          sessionStorage.removeItem('pendingUndoState');
        } catch (error) {
          console.log('[SidePanel] Failed to clear pending undo state:', error);
        }
      }, 0);
    };    // Listen for instance operations from undo/redo system
    const handleInstanceOperations = (event: CustomEvent) => {
      console.log('[SidePanel] Applying instance operations from undo/redo:', event.detail.operations);
      const operations = event.detail.operations;
      
      if (operations && operations.length > 0) {
        // Apply operations by updating instances state directly (don't record this as it's from undo/redo)
        setInstancesInternal(currentInstances => {
          const newInstances = [...currentInstances];
          const modifiedTableIds = new Set<string>();
          
          operations.forEach((operation: any) => {
            console.log('[SidePanel] Processing operation:', operation);
            
            // Handle different operation types
            if (operation.type === 'create' && operation.instance) {
              // Add new instance
              newInstances.push(operation.instance);
              if (operation.instance.type === 'table') {
                modifiedTableIds.add(operation.instance.id);
              }
            } else if (operation.type === 'update' && operation.instanceId) {
              // Update existing instance
              const index = newInstances.findIndex(inst => inst.id === operation.instanceId);
              if (index !== -1) {
                if (operation.instance) {
                  newInstances[index] = operation.instance;
                } else if (operation.updates) {
                  newInstances[index] = { ...newInstances[index], ...operation.updates };
                }
                if (newInstances[index].type === 'table') {
                  modifiedTableIds.add(operation.instanceId);
                }
              }
            } else if (operation.type === 'delete' && operation.instanceId) {
              // Remove instance
              const index = newInstances.findIndex(inst => inst.id === operation.instanceId);
              if (index !== -1) {
                if (newInstances[index].type === 'table') {
                  modifiedTableIds.add(operation.instanceId);
                }
                newInstances.splice(index, 1);
              }
            }
          });
          
          // Mark affected tables as dirty
          if (modifiedTableIds.size > 0) {
            console.log('[SidePanel] Instance operations modified tables:', Array.from(modifiedTableIds));
            modifiedTableIds.forEach(tableId => {
              handleTableModified(tableId);
            });
          }
          
          return newInstances;
        });
      }
    };

    document.addEventListener('applyGlobalState', handleGlobalStateChange as EventListener);
    document.addEventListener('applyInstanceOperations', handleInstanceOperations as EventListener);

    return () => {
      cleanupShortcuts();
      document.removeEventListener('applyGlobalState', handleGlobalStateChange as EventListener);
      document.removeEventListener('applyInstanceOperations', handleInstanceOperations as EventListener);
    };
  }, []);

  // Create a wrapper function for recording state changes
  const recordableSetInstances = useCallback((
    newStateOrUpdater: React.SetStateAction<Instance[]>,
    description: string = 'State change',
    logMessage?: string,
    recordInUndo: boolean = true // Add parameter to control undo recording
  ) => {
    const callId = Math.random().toString(36).substr(2, 9);
    console.log(`[SidePanel] recordableSetInstances called [${callId}]:`, {
      description,
      logMessage,
      currentInstancesCount: instances.length,
      timestamp: Date.now()
    });
    console.trace(`[SidePanel] Stack trace for recordableSetInstances call [${callId}]:`);
    
    setInstancesInternal(prevInstances => {
      console.log(`[SidePanel] Inside setInstancesInternal callback [${callId}]:`, {
        previousCount: prevInstances.length,
        logMessage,
        description
      });

      const newInstances = typeof newStateOrUpdater === 'function' 
        ? newStateOrUpdater(prevInstances) 
        : newStateOrUpdater;

      // If a log message is provided, add it first (without recording in undo)
      let finalLogs = logsRef.current;
      let previousLogs = logsRef.current; // Save the original logs before modification
      
      if (logMessage) {
        finalLogs = [...logsRef.current, logMessage];
        console.log(`[SidePanel] Adding log as part of instance change [${callId}]:`, logMessage);
        setLogsInternal(finalLogs);
        logsRef.current = finalLogs;
        
        // Record action for monitoring (similar to addLog fallback parsing)
        recordUserActionFromLog(logMessage);
        
        // Trigger proactive service since we're bypassing addLog function
        console.log("Triggering proactive suggestions due to log update in recordableSetInstances", finalLogs);
        proactiveService.triggerLogsUpdate(finalLogs);
      }

      console.log('[SidePanel] About to record in undo manager:', {
        description,
        previousInstancesCount: prevInstances.length,
        newInstancesCount: newInstances.length,
        previousLogsCount: previousLogs.length,
        finalLogsCount: finalLogs.length
      });

      // Record the state change for global undo/redo (including any log change) only if recordInUndo is true
      if (recordInUndo) {
        try {
          globalUndoManager.recordStateChange({
            previousState: prevInstances,
            newState: newInstances,
            previousLogs: previousLogs, // Use the logs before modification
            newLogs: finalLogs,
            description: logMessage || description, // Use log message as description if provided
            undoable: true
          });
          console.log('[SidePanel] Successfully recorded state change in undo manager');
        } catch (error) {
          console.error('[SidePanel] Error recording state change:', error);
        }
      } else {
        console.log('[SidePanel] Skipping undo recording for trivial interaction');
      }

      return newInstances;
    });
  }, []);  // History restoration handler
  const handleRestoreToCheckpoint = useCallback((logIndex: number) => {
    console.log(`[SidePanel] Restoring to checkpoint at log index: ${logIndex}`);
    
    const success = globalUndoManager.restoreToLogCheckpoint(
      logIndex, 
      logs, 
      () => instances,
      () => logs
    );
    
    if (success) {
      addLog(`Restored system to checkpoint: "${logs[logIndex]}"`);
      console.log(`[SidePanel] Successfully restored to checkpoint: "${logs[logIndex]}"`);
    } else {
      addLog(`Failed to restore to checkpoint at index ${logIndex}`);
      console.warn(`[SidePanel] Failed to restore to checkpoint at index ${logIndex}`);
    }
  }, [logs, instances, addLog]);

  // Suggestion handlers
  const handleAcceptSuggestion = useCallback(async (suggestionId: string) => {
    console.log('[SidePanel] handleAcceptSuggestion called with:', suggestionId);
    
    // Double-check that the suggestion still exists in our local state
    const localSuggestion = suggestions.find(s => s.id === suggestionId);
    if (!localSuggestion) {
      console.log('[SidePanel] Warning: Suggestion not found in local state:', suggestionId);
      console.log('[SidePanel] Available local suggestions:', suggestions.map(s => s.id));
      // Try to refresh suggestions from service
      const currentServiceSuggestions = proactiveService.getCurrentSuggestions();
      console.log('[SidePanel] Service suggestions:', currentServiceSuggestions.map(s => s.id));
      setSuggestions(currentServiceSuggestions);
      return;
    }
    
    const success = await proactiveService.acceptSuggestion(suggestionId);
    console.log('[SidePanel] Acceptance result:', success);
    if (!success) {
      console.log('[SidePanel] Acceptance failed, stopping generation indicator');
      setIsGeneratingSuggestions(false);
      // Refresh suggestions to sync with service state
      const currentServiceSuggestions = proactiveService.getCurrentSuggestions();
      setSuggestions(currentServiceSuggestions);
    }
  }, [suggestions]);

  const handleDismissSuggestion = useCallback((suggestionId: string) => {
    proactiveService.dismissSuggestion(suggestionId);
  }, []);

  // Function to request LLM refinement for failed tool suggestions
  const requestSuggestionRefinement = useCallback(async (
    originalSuggestionId: string, 
    failedToolCall: { function: string; parameters: any }, 
    errorMessage: string
  ) => {
    try {
      console.log('[SidePanel] Requesting suggestion refinement for failed tool:', failedToolCall, 'Error:', errorMessage);
      
      // Defensive coding: Check if current active tab is in htmlContext
      if (currentPageInfo && currentPageInfo.pageId) {
        const currentPageInContext = htmlContext[currentPageInfo.pageId];
        if (!currentPageInContext) {
          console.warn(`[SidePanel] Current active tab ${currentPageInfo.pageId} not found in htmlContext for suggestion refinement. Available pages:`, Object.keys(htmlContext));
          // Show a warning but continue with refinement since it might still work with other pages
          console.log('[SidePanel] Proceeding with refinement using available HTML context');
        } else {
          console.log(`[SidePanel] Current active tab ${currentPageInfo.pageId} found in htmlContext with URL: ${currentPageInContext.pageURL}`);
        }
      }
      
      // Find the original suggestion
      const originalSuggestion = suggestions.find(s => s.id === originalSuggestionId);
      if (!originalSuggestion) {
        console.warn('[SidePanel] Original suggestion not found for refinement:', originalSuggestionId, 'Available suggestions:', suggestions.map(s => s.id));
        return;
      }

      console.log('[SidePanel] Found original suggestion for refinement:', originalSuggestion.message);

      // Set loading state for the refinement
      setSuggestions(prev => prev.map(s => 
        s.id === originalSuggestionId 
          ? { ...s, isLoading: true, loadingMessage: 'Refining suggestion...' }
          : s
      ));

      // Send refinement request to specialized refinement API
      console.log('[SidePanel] Sending refinement request to specialized refinement API...');
      setAgentLoading(true);

      try {
        const refinementResult = await refinementAPI(
          {
            id: originalSuggestion.id,
            message: originalSuggestion.message,
            category: originalSuggestion.category
          },
          failedToolCall,
          errorMessage,
          {
            messages,
            instances,
            htmlContext,
            logs
          }
        );

        console.log('[SidePanel] Refinement API result:', refinementResult);

        if (refinementResult.success && refinementResult.refinedSuggestion) {
          console.log('[SidePanel] Received refined suggestion from API:', refinementResult.refinedSuggestion);
          
          // Create the refined ProactiveSuggestion using the SAME ID as the original
          const refinedSuggestion = {
            id: originalSuggestionId, // Keep the same ID to maintain consistency
            message: refinementResult.refinedSuggestion.message,
            instances: originalSuggestion.instances || [],
            scope: refinementResult.refinedSuggestion.scope as any,
            modality: refinementResult.refinedSuggestion.modality as any,
            priority: refinementResult.refinedSuggestion.priority as any,
            confidence: refinementResult.refinedSuggestion.confidence,
            category: refinementResult.refinedSuggestion.category,
            timestamp: Date.now(),
            undoable: refinementResult.refinedSuggestion.scope === 'micro',
            toolCall: refinementResult.refinedSuggestion.toolCall,
            toolSequence: refinementResult.refinedSuggestion.toolSequence,
            isRefinement: true,
            originalSuggestionId: originalSuggestionId,
            isLoading: false
          };
          
          console.log('[SidePanel] Created refined suggestion with same ID:', {
            originalId: originalSuggestionId,
            refinedId: refinedSuggestion.id,
            originalToolSequence: originalSuggestion.toolSequence,
            refinedToolSequence: refinedSuggestion.toolSequence
          });
          
          // Replace the original suggestion with the refined one (same ID)
          setSuggestions(prev => prev.map(s => 
            s.id === originalSuggestionId ? refinedSuggestion : s
          ));
          
          console.log('[SidePanel] Successfully processed refinement - replaced suggestion with refined version (same ID)');
        } else {
          console.warn('[SidePanel] Refinement API failed:', refinementResult.error || refinementResult.message);
          // Remove loading state and restore original suggestion
          setSuggestions(prev => prev.map(s => 
            s.id === originalSuggestionId 
              ? { ...s, isLoading: false, loadingMessage: undefined }
              : s
          ));
        }
      } catch (error) {
        console.error('[SidePanel] Error in refinement API request:', error);
        // Remove loading state on error
        setSuggestions(prev => prev.map(s => 
          s.id === originalSuggestionId 
            ? { ...s, isLoading: false, loadingMessage: undefined }
            : s
        ));
      } finally {
        setAgentLoading(false);
      }
      
    } catch (error) {
      console.error('[SidePanel] Error requesting suggestion refinement:', error);
      setAgentLoading(false);
      // Remove loading state on outer error
      setSuggestions(prev => prev.map(s => 
        s.id === originalSuggestionId 
          ? { ...s, isLoading: false, loadingMessage: undefined }
          : s
      ));
    }
  }, [suggestions, setSuggestions, setAgentLoading, messages, instances, htmlContext, logs]);

  // Tool execution handler for macro suggestions
  const handleExecuteTool = useCallback(async (toolCall: { function: string; parameters: any }, suggestionId: string) => {
    console.log('[SidePanel] Executing tool:', toolCall, 'for suggestion:', suggestionId);
    
    // Find the suggestion and capture state before for logging
    const suggestion = suggestions.find(s => s.id === suggestionId);
    let stateBefore: any = null;
    
    if (suggestion) {
      stateBefore = {
        timestamp: new Date().toISOString(),
        instances: JSON.parse(JSON.stringify(instances)),
        messages: JSON.parse(JSON.stringify(messages)),
        htmlContexts: Object.keys(htmlContext),
        logs: [...logs].slice(-50),
        editingTableId: editingTableId,
        currentPageInfo: currentPageInfo,
        suggestions: JSON.parse(JSON.stringify(suggestions))
      };
    }
    
    // Special handling for createVisualization when in table editor mode
    if (toolCall.function === 'createVisualization' && editingTableId) {
      console.log('[SidePanel] createVisualization requested while in table editor, checking for confirmation');
      
      // For now, we'll execute directly but in the future this could trigger a confirmation modal
      // The modal implementation would go here
      const shouldContinue = window.confirm(
        `You are currently editing a table. Creating a visualization will save your current work and close the table editor. Continue?`
      );
      
      if (!shouldContinue) {
        console.log('[SidePanel] User cancelled visualization creation');
        return;
      }
      
      console.log('[SidePanel] User confirmed visualization creation, proceeding');
    }

    // Special handling for createVisualization when in visualization editor mode
    // TODO: Implement when visualization editor callbacks are available
    /*
    if (toolCall.function === 'createVisualization' && 
        instanceViewCallbacks.current?.isInVisualizationEditor && 
        instanceViewCallbacks.current.isInVisualizationEditor()) {
      console.log('[SidePanel] createVisualization requested while in visualization editor, checking for confirmation');
      
      let shouldContinue = true;
      
      // Check if current visualization is non-empty
      if (instanceViewCallbacks.current?.hasNonEmptyVisualization && 
          instanceViewCallbacks.current.hasNonEmptyVisualization()) {
        shouldContinue = window.confirm(
          `You are currently editing a visualization. Creating a new visualization will save your current work and replace it with the new one. Continue?`
        );
      } else {
        console.log('[SidePanel] Current visualization is empty, proceeding without confirmation');
      }
      
      if (!shouldContinue) {
        console.log('[SidePanel] User cancelled visualization creation');
        return;
      }
      
      // Save current visualization if it exists
      if (instanceViewCallbacks.current?.saveCurrentVisualization) {
        const saved = instanceViewCallbacks.current.saveCurrentVisualization();
        console.log('[SidePanel] Current visualization saved:', saved);
      }
      
      console.log('[SidePanel] User confirmed visualization creation, proceeding');
    }
    */
    
    try {
      console.log('[SidePanel] Current instances before tool execution:', instances.length);
      
      // Create a wrapper for recordableSetInstances that provides proper undo descriptions
      const wrappedUpdateInstances = (newInstances: Instance[]) => {
        console.log('[SidePanel] wrappedUpdateInstances called with:', {
          toolName: toolCall.function,
          currentInstancesCount: instances.length,
          newInstancesCount: newInstances.length,
          instancesChanged: instances !== newInstances,
          areArraysEqual: JSON.stringify(instances) === JSON.stringify(newInstances)
        });
        
        // Call recordableSetInstances with a description based on the tool being executed
        const toolName = toolCall.function;
        const description = `Execute ${toolName} macro tool`;
        const logMessage = `Applied macro tool: ${toolName}`;
        recordableSetInstances(newInstances, description, logMessage);
        
        // Check if any tables were modified and notify MultiTableEditor
        if (handleTableModified && instances !== newInstances) {
          const oldTables = instances.filter(inst => inst.type === 'table');
          const newTables = newInstances.filter(inst => inst.type === 'table');
          
          // Check for modified or new tables
          const modifiedTableIds = new Set<string>();
          
          // Check for new tables
          newTables.forEach(newTable => {
            const oldTable = oldTables.find(old => old.id === newTable.id);
            if (!oldTable || JSON.stringify(oldTable) !== JSON.stringify(newTable)) {
              modifiedTableIds.add(newTable.id);
            }
          });
          
          // Notify for all modified tables
          modifiedTableIds.forEach(tableId => {
            handleTableModified(tableId);
          });
        }
      };
      
      const result = await executeMacroTool(toolCall, instances, wrappedUpdateInstances);
      console.log('[SidePanel] Tool execution result:', result);
      console.log('[SidePanel] Current instances after tool execution:', instances.length);
      
      if (result.success) {
        // Remove the applied suggestion first
        proactiveService.dismissSuggestion(suggestionId);
        
        // Force immediate UI update by syncing with service state
        const currentServiceSuggestions = proactiveService.getCurrentSuggestions();
        setSuggestions(currentServiceSuggestions);
        
        // Small delay to ensure suggestion dismissal is processed before log triggers new generation
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Log combined before/after state
        if (suggestion && stateBefore) {
          const stateAfter = {
            timestamp: new Date().toISOString(),
            instances: JSON.parse(JSON.stringify(instances)),
            messages: JSON.parse(JSON.stringify(messages)),
            htmlContexts: Object.keys(htmlContext),
            logs: [...logs].slice(-50),
            editingTableId: editingTableId,
            currentPageInfo: currentPageInfo,
            suggestions: JSON.parse(JSON.stringify(suggestions))
          };
          await logMacroSuggestionApplicationCombined(suggestion, stateBefore, stateAfter);
        } else {
          console.error('[SidePanel] Cannot log suggestion application - missing:', {
            hasSuggestion: !!suggestion,
            hasStateBefore: !!stateBefore
          });
        }
        
        // Special handling for createVisualization: auto-save table and switch to visualization editor
        if (toolCall.function === 'createVisualization' && editingTableId && result.result?.newInstanceId) {
          console.log('[SidePanel] createVisualization succeeded, auto-switching to visualization editor');
          console.log('[SidePanel] New visualization ID:', result.result.newInstanceId);
          console.log('[SidePanel] instanceViewCallbacks available:', !!instanceViewCallbacks.current);
          
          // Auto-save the table first
          if (instanceViewCallbacks.current?.saveTable) {
            console.log('[SidePanel] Auto-saving table:', editingTableId);
            instanceViewCallbacks.current.saveTable();
          } else {
            console.log('[SidePanel] saveTable callback not available');
          }
          
          // Close the table editor
          if (instanceViewCallbacks.current?.closeTableEditor) {
            console.log('[SidePanel] Auto-closing table editor');
            instanceViewCallbacks.current.closeTableEditor();
          } else {
            console.log('[SidePanel] closeTableEditor callback not available');
          }
          
          // Open the visualization editor with the new visualization
          if (instanceViewCallbacks.current?.openVisualizationEditor && result.result?.newVisualizationSpec) {
            console.log('[SidePanel] Auto-opening visualization editor with spec from result');
            // Small delay to ensure table editor is closed first
            setTimeout(() => {
              instanceViewCallbacks.current?.openVisualizationEditor(result.result.newVisualizationSpec);
            }, 150);
          } else {
            console.log('[SidePanel] openVisualizationEditor callback not available or no spec in result');
            // Fallback: try to find the visualization in updated instances after a delay
            setTimeout(() => {
              const newVisualization = instances.find(inst => inst.id === result.result.newInstanceId);
              if (newVisualization && newVisualization.type === 'visualization' && instanceViewCallbacks.current?.openVisualizationEditor) {
                console.log('[SidePanel] Found new visualization instance, opening editor');
                instanceViewCallbacks.current.openVisualizationEditor(newVisualization.spec);
              } else {
                console.log('[SidePanel] Could not find new visualization instance or callback not available');
              }
            }, 200);
          }
        } else if (toolCall.function === 'createVisualization' && result.result?.newVisualizationSpec) {
          // Handle createVisualization when not in table editor (e.g., from visualization editor or main view)
          console.log('[SidePanel] createVisualization succeeded from non-table context, handling visualization editor transition');
          console.log('[SidePanel] editingTableId:', editingTableId, 'newInstanceId:', result.result.newInstanceId);
          
          if (instanceViewCallbacks.current?.openVisualizationEditor) {
            console.log('[SidePanel] Calling openVisualizationEditor with new spec');
            // Small delay to ensure any state updates are processed
            setTimeout(() => {
              instanceViewCallbacks.current?.openVisualizationEditor(result.result.newVisualizationSpec);
            }, 100);
          } else {
            console.log('[SidePanel] openVisualizationEditor callback not available');
          }
        }
        
        // Special handling for createVisualization: switch to visualization editor with new spec
        // TODO: Implement when visualization editor callbacks are available
        /*
        if (toolCall.function === 'createVisualization' && 
            instanceViewCallbacks.current?.isInVisualizationEditor &&
            instanceViewCallbacks.current.isInVisualizationEditor() && 
            result.result?.newVisualizationSpec) {
          console.log('[SidePanel] createVisualization succeeded while in visualization editor, switching to new spec');
          console.log('[SidePanel] New visualization ID:', result.result.newInstanceId);
          
          // Open the visualization editor with the new visualization spec
          if (instanceViewCallbacks.current?.openVisualizationEditor) {
            console.log('[SidePanel] Auto-opening visualization editor with new spec from result');
            // Small delay to ensure any state updates are processed
            setTimeout(() => {
              instanceViewCallbacks.current?.openVisualizationEditor(result.result.newVisualizationSpec);
            }, 100);
          } else {
            console.log('[SidePanel] openVisualizationEditor callback not available');
          }
        }
        */
        
        // Log already added by wrappedUpdateInstances - no need to add another log here
        
        console.log('[SidePanel] Successfully executed tool and removed suggestion:', suggestionId);
      } else {
        // Tool execution failed - show loading state and request LLM refinement
        console.log('[SidePanel] Tool execution failed, showing loading state and requesting LLM refinement:', result.message);
        
        // Update the suggestion to show loading state
        setSuggestions(prev => prev.map(s => 
          s.id === suggestionId 
            ? { 
                ...s, 
                isLoading: true, 
                loadingMessage: 'Processing...',
              }
            : s
        ));
        
        // Don't dismiss the suggestion yet - keep it visible until refinement arrives
        // Request refined suggestion from LLM (don't add to logs to avoid noise)
        await requestSuggestionRefinement(suggestionId, toolCall, result.message);
      }
    } catch (error) {
      console.error('[SidePanel] Tool execution error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Update the suggestion to show loading state
      setSuggestions(prev => prev.map(s => 
        s.id === suggestionId 
          ? { 
              ...s, 
              isLoading: true, 
              loadingMessage: 'Processing...',
            }
          : s
      ));
      
      // Don't dismiss the suggestion yet - keep it visible until refinement arrives
      // Request refined suggestion from LLM for execution errors too (don't add to logs)
      await requestSuggestionRefinement(suggestionId, toolCall, errorMessage);
    }
  }, [addLog, instances, requestSuggestionRefinement, editingTableId]);

  // Remove the complex forwarding system
  const handleToolExecutionWithConfirmation = handleExecuteTool;

  const handleExecuteToolSequence = useCallback(async (toolSequence: { goal: string; steps: Array<{ description: string; toolCall: { function: string; parameters: any } }> }, suggestionId: string) => {
    console.log('[SidePanel] ⚡ TOOL SEQUENCE EXECUTION STARTED:', toolSequence, 'for suggestion:', suggestionId);
    console.log('[SidePanel] ⚡ Current instances count:', instances.length);
    console.log('[SidePanel] ⚡ Tool sequence goal:', toolSequence.goal);
    console.log('[SidePanel] ⚡ Number of steps:', toolSequence.steps.length);
    
    // Find the suggestion and capture state before for logging
    const suggestion = suggestions.find(s => s.id === suggestionId);
    let stateBefore: any = null;
    let updatedInstances: Instance[] | null = null; // Track the updated instances
    
    if (suggestion) {
      stateBefore = {
        timestamp: new Date().toISOString(),
        instances: JSON.parse(JSON.stringify(instances)),
        messages: JSON.parse(JSON.stringify(messages)),
        htmlContexts: Object.keys(htmlContext),
        logs: [...logs].slice(-50),
        editingTableId: editingTableId,
        currentPageInfo: currentPageInfo,
        suggestions: JSON.parse(JSON.stringify(suggestions))
      };
    }
    
    try {
      const { executeCompositeSuggestion } = await import('./macro-tool-executor');
      
      // Create a wrapper for recordableSetInstances that provides proper undo descriptions
      const wrappedUpdateInstances = (newInstances: Instance[]) => {
        updatedInstances = newInstances; // Capture the updated instances
        const description = `Execute composite suggestion: ${toolSequence.goal}`;
        recordableSetInstances(newInstances, description);
        
        // Check if any tables were modified and notify MultiTableEditor
        if (handleTableModified && instances !== newInstances) {
          const oldTables = instances.filter(inst => inst.type === 'table');
          const newTables = newInstances.filter(inst => inst.type === 'table');
          
          // Check for modified or new tables
          const modifiedTableIds = new Set<string>();
          
          // Check for new tables
          newTables.forEach(newTable => {
            const oldTable = oldTables.find(old => old.id === newTable.id);
            if (!oldTable || JSON.stringify(oldTable) !== JSON.stringify(newTable)) {
              modifiedTableIds.add(newTable.id);
            }
          });
          
          // Notify for all modified tables
          modifiedTableIds.forEach(tableId => {
            handleTableModified(tableId);
          });
        }
      };
      
      const result = await executeCompositeSuggestion({ toolSequence }, instances, wrappedUpdateInstances);
      console.log('[SidePanel] Tool sequence execution result:', result);
      
      if (result.success) {
        // Remove the applied suggestion first
        proactiveService.dismissSuggestion(suggestionId);
        
        // Force immediate UI update by syncing with service state
        const currentServiceSuggestions = proactiveService.getCurrentSuggestions();
        setSuggestions(currentServiceSuggestions);
        
        // Small delay to ensure suggestion dismissal is processed before log triggers new generation
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Log combined before/after state
        if (suggestion && stateBefore) {
          // Use updatedInstances if available, otherwise fall back to current instances
          const finalInstances = updatedInstances || instances;
          if (!updatedInstances) {
            console.warn('[SidePanel] updatedInstances is null in tool sequence, using current instances for state logging');
          }
          const stateAfter = {
            timestamp: new Date().toISOString(),
            instances: JSON.parse(JSON.stringify(finalInstances)),
            messages: JSON.parse(JSON.stringify(messages)),
            htmlContexts: Object.keys(htmlContext),
            logs: [...logs].slice(-50),
            editingTableId: editingTableId,
            currentPageInfo: currentPageInfo,
            suggestions: JSON.parse(JSON.stringify(suggestions))
          };
          await logMacroSuggestionApplicationCombined(suggestion, stateBefore, stateAfter);
        } else {
          console.error('[SidePanel] Cannot log tool sequence application - missing:', {
            hasSuggestion: !!suggestion,
            hasStateBefore: !!stateBefore,
            hasUpdatedInstances: !!updatedInstances
          });
        }
        
        // Add log for the successful execution with comprehensive details
        addLog(`Applied suggestion - ${result.message}`, {
          type: 'tool-sequence-executed',
          context: { toolSequence, result },
          metadata: { goal: toolSequence.goal, steps: toolSequence.steps.length }
        });
        
        // System logging for macro tool execution
        systemLogger.logAIInteraction('macro_execution', {
          toolSequenceGoal: toolSequence.goal,
          stepsCount: toolSequence.steps.length,
          success: result.success,
          suggestionId,
          executionResult: result.message
        }, {
          startTime: Date.now(), // This would ideally be captured at the start
          endTime: Date.now()
        });
        
        console.log('[SidePanel] Successfully executed tool sequence and removed suggestion:', suggestionId);
      } else {
        // Tool sequence execution failed - request LLM refinement
        console.log('[SidePanel] Tool sequence execution failed, requesting LLM refinement:', result.message);
        
        // Create a simplified tool call representation for refinement
        const simplifiedToolCall = {
          function: 'executeToolSequence',
          parameters: { toolSequence }
        };
        
        // Don't dismiss the suggestion yet - keep it visible until refinement arrives
        // Request refined suggestion from LLM (don't add to logs to avoid noise)
        await requestSuggestionRefinement(suggestionId, simplifiedToolCall, result.message);
      }
    } catch (error) {
      console.error('[SidePanel] Tool sequence execution error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Create a simplified tool call representation for refinement
      const simplifiedToolCall = {
        function: 'executeToolSequence',
        parameters: { toolSequence }
      };
      
      // Don't dismiss the suggestion yet - keep it visible until refinement arrives
      // Request refined suggestion from LLM for execution errors too (don't add to logs)
      await requestSuggestionRefinement(suggestionId, simplifiedToolCall, errorMessage);
    }
  }, [addLog, instances, requestSuggestionRefinement]);

  const handleDismissAllSuggestions = useCallback(() => {
    proactiveService.clearSuggestions();
  }, []);

  const handleDismissMicroSuggestions = useCallback(() => {
    proactiveService.clearMicroSuggestions();
  }, []);

  // Tool view height mode toggle
  const handleToggleToolViewHeightMode = useCallback(() => {
    setToolViewHeightMode(prev => {
      switch (prev) {
        case 'minimum': return 'small';
        case 'small': return 'large';
        case 'large': return 'minimum';
        default: return 'small';
      }
    });
  }, []);

  // Global keyboard event handler for suggestion acceptance and dismissal
  const handleGlobalKeyDown = useCallback((e: KeyboardEvent) => {
    if (suggestions.length > 0) {
      if (e.key === 'Tab') {
        // Only accept micro suggestions with Tab key, not macro suggestions
        const microSuggestions = suggestions
          .filter(s => s.scope === 'micro')
          .sort((a, b) => b.confidence - a.confidence);
        if (microSuggestions.length > 0) {
          console.log('[SidePanel] Tab key pressed - accepting highest confidence micro suggestion:', microSuggestions[0].id, microSuggestions[0].message, `(${Math.round(microSuggestions[0].confidence * 100)}%)`);
          e.preventDefault();
          e.stopPropagation();
          // Accept the highest confidence micro suggestion
          handleAcceptSuggestion(microSuggestions[0].id);
        } else {
          console.log('[SidePanel] Tab key pressed but no micro suggestions available (only macro suggestions)');
        }
      } else if (e.key === 'Escape') {
        // Prioritize exiting capture mode over dismissing suggestions
        if (isInCaptureMode) {
          // Let the capture handlers in instanceview/multitableeditor handle the escape
          console.log('[SidePanel] Escape in capture mode - letting component handlers handle it');
          return;
        }
        
        // If not in capture mode, dismiss micro suggestions
        e.preventDefault();
        e.stopPropagation();
        // Only dismiss micro suggestions (ghost previews), keep macro suggestions in peripheral view
        // This allows users to dismiss distracting ghost instances while keeping helpful macro suggestions visible
        handleDismissMicroSuggestions();
      }
    }
  }, [suggestions, handleAcceptSuggestion, handleDismissMicroSuggestions, isInCaptureMode]);

  // Add global keyboard event listener
  useEffect(() => {
    document.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown, true);
    };
  }, [handleGlobalKeyDown]);

  return (
    <div 
      className="side-panel"
    >
      {/* ToolView now appears first/above */}
      <ToolView 
        logs={logs} 
        htmlContext={htmlContext} 
        messages={messages} 
        addMessage={addMessage} 
        setMessages={setMessages} 
        agentLoading={agentLoading} 
        setAgentLoading={setAgentLoading} 
        instances={instances} 
        setInstances={recordableSetInstances}
        heightMode={toolViewHeightMode}
        onToggleHeightMode={handleToggleToolViewHeightMode}
        suggestions={suggestions}
        onAcceptSuggestion={handleAcceptSuggestion}
        onDismissSuggestion={handleDismissSuggestion}
        onDismissAllSuggestions={handleDismissAllSuggestions}
        onExecuteTool={handleToolExecutionWithConfirmation}
        onExecuteToolSequence={handleExecuteToolSequence}
        onRestoreToCheckpoint={handleRestoreToCheckpoint}
        currentPageInfo={currentPageInfo}
        isInEditor={isInEditor}
        editingTableId={editingTableId}
        onTableModified={handleTableModified}
        updateHTMLContext={setHtmlContexts}
      />
      
      {/* InstanceView now appears second/below */}
      <InstanceView 
        instances={instances} 
        setInstances={recordableSetInstances} 
        logs={logs} 
        htmlContextRef={htmlContextRef} 
        messages={messages} 
        workspaceName={workspaceName}
        onWorkspaceNameChange={handleWorkspaceNameChange}
        onOperation={addLog} 
        updateHTMLContext={setHtmlContexts} 
        addMessage={addMessage} 
        setAgentLoading={setAgentLoading}
        setIsInEditor={setIsInEditor}
        setIsInCaptureMode={setIsInCaptureMode}
        onEditingTableIdChange={setEditingTableId}
        onHTMLLoadingStatesChange={handleHTMLLoadingStatesChange}
        currentSuggestion={
          // Prioritize suggestions with instance updates (usually micro suggestions) for ghost rendering
          // Sort by confidence to ensure highest confidence suggestion is shown
          suggestions
            .sort((a, b) => b.confidence - a.confidence)
            .find(s => s.instances && s.instances.length > 0) || 
          (suggestions.length > 0 ? suggestions.sort((a, b) => b.confidence - a.confidence)[0] : undefined)
        }
        callbackRef={instanceViewCallbacks}
        onRegisterMultiTableCallbacks={(callbacks) => {
          console.log(`[SidePanel] Registering MultiTableEditor callbacks`);
          multiTableEditorCallbacks.current = callbacks;
        }}
        onTableModified={handleTableModified}
      />
      
      <SuggestionIndicator
        isVisible={isGeneratingSuggestions || suggestions.length > 0}
        isGenerating={isGeneratingSuggestions}
      />

      {/* Workspace Name Modal */}
      <WorkspaceNameModal
        isOpen={showWorkspaceNameModal}
        initialName={workspaceName}
        onSave={handleSaveWorkspaceName}
        onCancel={handleCancelWorkspaceNaming}
        onSkip={handleSkipWorkspaceNaming}
      />
      
      {/* Testing Export Button - only show in development */}
      {import.meta.env.DEV && (
        <TestingExportButton
          instances={instances}
          htmlContext={htmlContext}
          messages={messages}
          logs={logs}
          suggestions={suggestions}
          currentPageInfo={currentPageInfo}
          isInEditor={isInEditor}
          editingTableId={editingTableId}
          proactiveService={proactiveService}
        />
      )}
    </div>
  );
};

export default SidePanel;