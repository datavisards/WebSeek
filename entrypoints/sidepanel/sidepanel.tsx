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
      htmlContexts: htmlContext
    });
  }, [instances, messages, htmlContext]);

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

  // Tool execution handler for macro suggestions
  const handleExecuteTool = useCallback(async (toolCall: { function: string; parameters: any }) => {
    console.log('[SidePanel] Executing tool:', toolCall);
    
    try {
      const result = await executeMacroTool(toolCall, instances, setInstances);
      console.log('[SidePanel] Tool execution result:', result);
      
      if (result.success) {
        // Show success message or handle the result as needed
        addLog(`Tool executed successfully: ${result.message}`, {
          type: 'tool-executed',
          context: { toolCall, result },
          metadata: { toolFunction: toolCall.function }
        });
      } else {
        // Show error message
        addLog(`Tool execution failed: ${result.message}`, {
          type: 'tool-execution-error',
          context: { toolCall, result },
          metadata: { toolFunction: toolCall.function }
        });
      }
    } catch (error) {
      console.error('[SidePanel] Tool execution error:', error);
      addLog(`Tool execution error: ${error instanceof Error ? error.message : String(error)}`, {
        type: 'tool-execution-error',
        context: { toolCall, error: String(error) },
        metadata: { toolFunction: toolCall.function }
      });
    }
  }, [addLog, instances]);

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
        const microSuggestions = suggestions.filter(s => s.scope === 'micro');
        if (microSuggestions.length > 0) {
          console.log('[SidePanel] Tab key pressed - accepting micro suggestion:', microSuggestions[0].id, microSuggestions[0].message);
          e.preventDefault();
          e.stopPropagation();
          // Accept the first micro suggestion
          handleAcceptSuggestion(microSuggestions[0].id);
        } else {
          console.log('[SidePanel] Tab key pressed but no micro suggestions available (only macro suggestions)');
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        // Only dismiss micro suggestions (ghost previews), keep macro suggestions in peripheral view
        // This allows users to dismiss distracting ghost instances while keeping helpful macro suggestions visible
        handleDismissMicroSuggestions();
      }
    }
  }, [suggestions, handleAcceptSuggestion, handleDismissMicroSuggestions]);

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
        currentSuggestion={
          // Prioritize suggestions with instance updates (usually micro suggestions) for ghost rendering
          suggestions.find(s => s.instances && s.instances.length > 0) || 
          (suggestions.length > 0 ? suggestions[0] : undefined)
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
        onExecuteTool={handleExecuteTool}
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