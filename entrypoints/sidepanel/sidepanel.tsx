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

const SidePanel = () => {
  console.log('[SidePanel] Component mounting/re-mounting');
  
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
  const [showSettings, setShowSettings] = useState(false);
  
  // Workspace naming state
  const [workspaceName, setWorkspaceName] = useState<string>('');
  const [showWorkspaceNameModal, setShowWorkspaceNameModal] = useState(false);
  const [hasShownWorkspaceModal, setHasShownWorkspaceModal] = useState(false);
  
  // Tool view collapse state
  const [isToolViewCollapsed, setIsToolViewCollapsed] = useState(false);
  
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
    
    // Only keep essential parsing for any remaining cases
    // Most actions should now be recorded directly
    if (message.includes('Selected') && !message.includes('table-selected')) {
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
          setCurrentPageInfo({ pageId: response.pageId, url: tab.url });
          
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

  // Update proactive service when editor context changes
  useEffect(() => {
    console.log('[SidePanel] Editor state changed:', isInEditor);
    proactiveService.updateContext({ isInEditor });
  }, [isInEditor]);

  // Initialize proactive service
  useEffect(() => {
    // Set up proactive service listeners
    proactiveService.onSuggestionsChange((newSuggestions) => {
      console.log('[SidePanel] Received suggestion update from service:', newSuggestions.map(s => s.id));
      setSuggestions(newSuggestions);
      setIsGeneratingSuggestions(false);
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
                row.forEach((cell: any, colIndex: number) => {
                  if (cell) {
                    cellUpdates.push(`R${rowIndex}C${colIndex}`);
                  }
                });
              });
            }
            return cellUpdates;
          })
          .flat();
        
        addLog(`Applied suggestion${updatedCells.length > 0 ? ` - Updated cells: ${updatedCells.join(', ')}` : ''}`);
      }
    });

    proactiveService.onGenerationStateChange((isGenerating) => {
      setIsGeneratingSuggestions(isGenerating);
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
      // Apply operations by updating instances state directly
      // For now, we'll implement basic operations - this can be extended
      event.detail.operations.forEach((operation: any) => {
        console.log('[SidePanel] Processing operation:', operation);
        // Operations will be applied through the existing state management
      });
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
    logMessage?: string
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
      }

      console.log('[SidePanel] About to record in undo manager:', {
        description,
        previousInstancesCount: prevInstances.length,
        newInstancesCount: newInstances.length,
        previousLogsCount: previousLogs.length,
        finalLogsCount: finalLogs.length
      });

      // Record the state change for global undo/redo (including any log change)
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
    
    try {
      console.log('[SidePanel] Current instances before tool execution:', instances.length);
      const result = await executeMacroTool(toolCall, instances, recordableSetInstances);
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
        
        // Add log for the successful execution
        addLog(`Applied suggestion - ${result.message}`, {
          type: 'tool-executed',
          context: { toolCall, result },
          metadata: { toolFunction: toolCall.function }
        });
        
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
    console.log('[SidePanel] Executing tool sequence:', toolSequence, 'for suggestion:', suggestionId);
    
    try {
      const { executeCompositeSuggestion } = await import('./macro-tool-executor');
      const result = await executeCompositeSuggestion({ toolSequence }, instances, recordableSetInstances);
      console.log('[SidePanel] Tool sequence execution result:', result);
      
      if (result.success) {
        // Remove the applied suggestion first
        proactiveService.dismissSuggestion(suggestionId);
        
        // Force immediate UI update by syncing with service state
        const currentServiceSuggestions = proactiveService.getCurrentSuggestions();
        setSuggestions(currentServiceSuggestions);
        
        // Small delay to ensure suggestion dismissal is processed before log triggers new generation
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Add log for the successful execution with comprehensive details
        addLog(`Applied suggestion - ${result.message}`, {
          type: 'tool-sequence-executed',
          context: { toolSequence, result },
          metadata: { goal: toolSequence.goal, steps: toolSequence.steps.length }
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

  // Tool view collapse toggle
  const handleToggleToolViewCollapse = useCallback(() => {
    setIsToolViewCollapsed(prev => !prev);
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
        isCollapsed={isToolViewCollapsed}
        onToggleCollapse={handleToggleToolViewCollapse}
        suggestions={suggestions}
        onAcceptSuggestion={handleAcceptSuggestion}
        onDismissSuggestion={handleDismissSuggestion}
        onExecuteTool={handleToolExecutionWithConfirmation}
        onExecuteToolSequence={handleExecuteToolSequence}
        onRestoreToCheckpoint={handleRestoreToCheckpoint}
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
    </div>
  );
};

export default SidePanel;