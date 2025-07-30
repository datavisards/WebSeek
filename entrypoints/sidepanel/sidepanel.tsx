// sidepanel.tsx
import { useState, useEffect, useCallback } from 'react';
import InstanceView from './components/instanceview.tsx';
import { Instance, ProactiveSuggestion } from './types.tsx';
import './sidepanel.css';
import { Message } from './types.tsx';
import ToolView from './components/toolview.tsx';
import websocketService from './websocket';
import { proactiveService } from './proactive-service';
import SuggestionIndicator from './components/SuggestionIndicator.tsx';
import ProactiveSettings from './components/ProactiveSettings.tsx';
import { updateInstances } from './utils';

const SidePanel = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const [htmlContext, setHtmlContexts] = useState<Record<string, {pageURL: string, htmlContent: string}>>({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [agentLoading, setAgentLoading] = useState(false);
  const [instances, setInstances] = useState<Instance[]>([]);
  
  // Proactive suggestion state
  const [suggestions, setSuggestions] = useState<ProactiveSuggestion[]>([]);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, message]);
  };

  const addMessage = (message: Message) => {
    setMessages(prev => [...prev, message]);
  };

  // Initialize proactive service
  useEffect(() => {
    // Set up proactive service listeners
    proactiveService.onSuggestionsChange((newSuggestions) => {
      setSuggestions(newSuggestions);
      setIsGeneratingSuggestions(false);
    });

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

  // Trigger proactive suggestions on logs update
  useEffect(() => {
    console.log("Triggering proactive suggestions due to logs update", logs);
    if (logs.length > 0 && Object.keys(htmlContext).length > 0) {
      proactiveService.triggerLogsUpdate(logs);
    }
  }, [logs]);

  // Connect websocket on mount, cleanup on unmount
  useEffect(() => {
    websocketService.connect();
    return () => {
      websocketService.disconnect();
    };
  }, []);

  // Suggestion handlers
  const handleAcceptSuggestion = useCallback(async (suggestionId: string) => {
    setIsGeneratingSuggestions(true);
    const success = await proactiveService.acceptSuggestion(suggestionId);
    if (!success) {
      setIsGeneratingSuggestions(false);
    }
  }, []);

  const handleDismissSuggestion = useCallback((suggestionId: string) => {
    proactiveService.dismissSuggestion(suggestionId);
  }, []);

  const handleDismissAllSuggestions = useCallback(() => {
    proactiveService.clearSuggestions();
  }, []);

  // Global keyboard event handler for suggestion acceptance and dismissal
  const handleGlobalKeyDown = useCallback((e: KeyboardEvent) => {
    if (suggestions.length > 0) {
      if (e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        // Accept the first suggestion
        handleAcceptSuggestion(suggestions[0].id);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        // Dismiss all suggestions
        handleDismissAllSuggestions();
      }
    }
  }, [suggestions, handleAcceptSuggestion, handleDismissAllSuggestions]);

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
      {/* <OperationView logs={logs} htmlContext={htmlContext}/> */}
      <InstanceView 
        instances={instances} 
        setInstances={setInstances} 
        logs={logs} 
        htmlContext={htmlContext} 
        messages={messages} 
        onOperation={addLog} 
        updateHTMLContext={setHtmlContexts} 
        addMessage={addMessage} 
        setAgentLoading={setAgentLoading}
        currentSuggestion={suggestions.length > 0 ? suggestions[0] : undefined}
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
      />
      
      {/* Proactive Suggestions UI - SuggestionOverlay removed */}
      
      <SuggestionIndicator
        isVisible={isGeneratingSuggestions || suggestions.length > 0}
        isGenerating={isGeneratingSuggestions}
      />
      
      <ProactiveSettings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </div>
  );
};

export default SidePanel;