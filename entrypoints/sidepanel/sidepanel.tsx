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
import MacroSuggestionPanel from './components/MacroSuggestionPanel.tsx';
import { executeMacroTool } from './macro-tool-executor';
import { chatWithAgent } from './apis';
import WorkspaceNameModal from './components/WorkspaceNameModal.tsx';
import { updateInstances } from './utils';

const SidePanel = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const logsRef = useRef<string[]>([]);
  const [htmlContext, setHtmlContexts] = useState<Record<string, {pageURL: string, htmlContent: string}>>({});
  const htmlContextRef = useRef<Record<string, {pageURL: string, htmlContent: string}>>({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [agentLoading, setAgentLoading] = useState(false);
  const [instances, setInstances] = useState<Instance[]>([]);
  
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
    console.log('[SidePanel] Instances state changed:', instances.length, instances.map(i => ({ id: i.id, type: i.type })));
  }, [instances]);
  
  // AI suggestion panel collapse state
  const [isSuggestionPanelCollapsed, setIsSuggestionPanelCollapsed] = useState(false);
  
  // Editor context state - tracks if user is currently in any editor
  const [isInEditor, setIsInEditor] = useState(false);
  
  // Currently editing table ID - for constraining suggestions to only the editing table
  const [editingTableId, setEditingTableId] = useState<string | null>(null);
  
  // Capture mode state - tracks if user is currently in element capture mode
  const [isInCaptureMode, setIsInCaptureMode] = useState(false);

  // Current page info for HTML context fetching
  const [currentPageInfo, setCurrentPageInfo] = useState<{pageId: string, url: string} | null>(null);

  const addLog = (message: string, actionDetails?: {
    type: string;
    context?: any;
    instanceId?: string;
    metadata?: any;
  }) => {
    const updatedLogs = [...logsRef.current, message];
    setLogs(updatedLogs);
    
    // Record action directly if provided, otherwise fall back to parsing
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
              const fetchResponse = await fetch(`http://localhost:8000/api/snapshots/${response.pageId}`);
              if (fetchResponse.ok) {
                const snapshotData = await fetchResponse.json();
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
              } else if (fetchResponse.status === 404 && retryCount < 3) {
                // Snapshot not ready yet, retry after delay
                console.log(`[SidePanel] Snapshot not ready, retrying in ${(retryCount + 1) * 1000}ms...`);
                setTimeout(() => fetchHtmlContent(retryCount + 1), (retryCount + 1) * 1000);
              } else {
                console.warn('[SidePanel] Failed to fetch snapshot:', fetchResponse.status);
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
      editingTableId
    });
  }, [instances, messages, htmlContext, editingTableId]);

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

      // Create a refined prompt for the LLM
      const refinementPrompt = `The following tool suggestion failed to execute:

Original Suggestion: ${originalSuggestion.message}
Tool Call: ${JSON.stringify(failedToolCall, null, 2)}
Error Message: ${errorMessage}

Please analyze the error and provide a refined suggestion with corrected tool parameters. Consider:
1. What went wrong with the original tool call
2. How to fix the parameters or approach
3. Alternative tools that might work better

Provide a new suggestion that addresses the same goal but avoids the error.`;

      // Send refinement request to LLM via API
      console.log('[SidePanel] Sending refinement request to LLM via API...');
      setAgentLoading(true);
      
      // Create a specialized refinement prompt
      const refinementUserMessage = `Please refine the following failed suggestion:

ORIGINAL SUGGESTION: "${originalSuggestion.message}"

FAILED TOOL CALL:
${JSON.stringify(failedToolCall, null, 2)}

ERROR MESSAGE: "${errorMessage}"

ANALYSIS REQUESTED:
1. Identify what went wrong with the tool parameters
2. Suggest corrected parameters or alternative approaches  
3. Provide a refined suggestion that addresses the same goal but avoids the error

Please provide a refined suggestion with corrected tool calls that will succeed.`;

      try {
        console.log("refinementUserMessage: ", refinementUserMessage);
        console.log("messages: ", messages);
        console.log("instances: ", instances);
        console.log("htmlContext: ", htmlContext);
        console.log("logs: ", logs);

        // Call the LLM API for suggestion refinement
        const result = await chatWithAgent(
          'suggest', // Use suggest ChatType for proactive suggestions
          refinementUserMessage,
          messages, // Include conversation history
          JSON.stringify(instances), // Current instance context
          [], // No image context needed for refinement
          htmlContext, // Include HTML context
          logs // Include recent logs
        );

        console.log("Refined result: ", result);

        if (result.suggestions && result.suggestions.length > 0) {
          console.log('[SidePanel] Received refined suggestions from LLM:', result.suggestions);
          
          // Convert to ProactiveSuggestion format and add to proactive service
          const refinedSuggestions = result.suggestions.map((suggestion: any, index: number) => ({
            id: `refined-suggestion-${originalSuggestionId}-${Date.now()}-${index}`,
            message: suggestion.message || 'Refined suggestion',
            instances: suggestion.instances || [],
            scope: suggestion.scope || 'macro',
            modality: suggestion.modality || 'peripheral',
            priority: suggestion.priority || 'medium',
            confidence: suggestion.confidence || 0.8, // Higher confidence for refined suggestions
            category: suggestion.category || originalSuggestion.category || 'general',
            timestamp: Date.now(),
            undoable: suggestion.scope === 'micro',
            toolCall: suggestion.toolCall,
            toolSequence: suggestion.toolSequence,
            isRefinement: true,
            originalSuggestionId: originalSuggestionId
          }));
          
          // Add the refined suggestions to the proactive service
          (proactiveService as any).addSuggestions(refinedSuggestions);
          
          // Now dismiss the original failed suggestion
          proactiveService.dismissSuggestion(originalSuggestionId);
          
          console.log('[SidePanel] Successfully processed refinement - added', refinedSuggestions.length, 'new suggestions and removed original');
        } else {
          console.warn('[SidePanel] LLM did not provide refined suggestions');
        }
      } catch (error) {
        console.error('[SidePanel] Error in LLM refinement request:', error);
      } finally {
        setAgentLoading(false);
      }
      
    } catch (error) {
      console.error('[SidePanel] Error requesting suggestion refinement:', error);
      setAgentLoading(false);
    }
  }, [suggestions, addMessage, setAgentLoading]);

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
      const result = await executeMacroTool(toolCall, instances, setInstances);
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
        addLog(`Tool executed successfully: ${result.message}`, {
          type: 'tool-executed',
          context: { toolCall, result },
          metadata: { toolFunction: toolCall.function }
        });
        
        console.log('[SidePanel] Successfully executed tool and removed suggestion:', suggestionId);
      } else {
        // Tool execution failed - request LLM refinement
        console.log('[SidePanel] Tool execution failed, requesting LLM refinement:', result.message);
        
        // Don't dismiss the suggestion yet - keep it visible until refinement arrives
        // Request refined suggestion from LLM (don't add to logs to avoid noise)
        await requestSuggestionRefinement(suggestionId, toolCall, result.message);
      }
    } catch (error) {
      console.error('[SidePanel] Tool execution error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      
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
      const result = await executeCompositeSuggestion({ toolSequence }, instances, setInstances);
      console.log('[SidePanel] Tool sequence execution result:', result);
      
      if (result.success) {
        // Remove the applied suggestion first
        proactiveService.dismissSuggestion(suggestionId);
        
        // Force immediate UI update by syncing with service state
        const currentServiceSuggestions = proactiveService.getCurrentSuggestions();
        setSuggestions(currentServiceSuggestions);
        
        // Small delay to ensure suggestion dismissal is processed before log triggers new generation
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Add log for the successful execution
        addLog(`Tool sequence executed successfully: ${result.message}`, {
          type: 'tool-sequence-executed',
          context: { toolSequence, result },
          metadata: { goal: toolSequence.goal }
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

  // AI suggestion panel collapse toggle
  const handleToggleSuggestionPanelCollapse = useCallback(() => {
    setIsSuggestionPanelCollapsed(prev => !prev);
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
      <InstanceView 
        instances={instances} 
        setInstances={setInstances} 
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
        currentSuggestion={
          // Prioritize suggestions with instance updates (usually micro suggestions) for ghost rendering
          // Sort by confidence to ensure highest confidence suggestion is shown
          suggestions
            .sort((a, b) => b.confidence - a.confidence)
            .find(s => s.instances && s.instances.length > 0) || 
          (suggestions.length > 0 ? suggestions.sort((a, b) => b.confidence - a.confidence)[0] : undefined)
        }
      />
      <ToolView 
        logs={logs} 
        htmlContext={htmlContext} 
        messages={messages} 
        addMessage={addMessage} 
        setMessages={setMessages} 
        agentLoading={agentLoading} 
        setAgentLoading={setAgentLoading} 
        instances={instances} 
        setInstances={setInstances}
        isCollapsed={isToolViewCollapsed}
        onToggleCollapse={handleToggleToolViewCollapse}
      />
      
      {/* Enhanced Proactive Suggestions UI */}
      <MacroSuggestionPanel
        suggestions={suggestions}
        onAccept={handleAcceptSuggestion}
        onDismiss={handleDismissSuggestion}
        onExecuteTool={handleToolExecutionWithConfirmation}
        onExecuteToolSequence={handleExecuteToolSequence}
        isCollapsed={isSuggestionPanelCollapsed}
        onToggleCollapse={handleToggleSuggestionPanelCollapse}
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