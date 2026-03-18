import React, { useState } from 'react';
import { Message, Instance, ProactiveSuggestion, ToolCall } from '../types';
import './toolview.css';
import ChatTab from './chattab';
import HistoryTab from './historytab';
import MacroSuggestionPanel from './MacroSuggestionPanel';
import SystemLogsViewer from './SystemLogsViewer';

interface ToolViewProps {
    logs: string[];
    htmlContext: Record<string, {pageURL: string, htmlContent: string}>;
    messages: Message[];
    addMessage: (message: Message) => void;
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
    agentLoading: boolean;
    setAgentLoading: React.Dispatch<React.SetStateAction<boolean>>;
    instances: Instance[];
    setInstances: React.Dispatch<React.SetStateAction<Instance[]>>;
    heightMode?: 'minimum' | 'small' | 'large';
    onToggleHeightMode?: () => void;
    // New props for suggestions
    suggestions?: ProactiveSuggestion[];
    onAcceptSuggestion?: (suggestionId: string) => void;
    onDismissSuggestion?: (suggestionId: string) => void;
    onDismissAllSuggestions?: () => void; // Add dismiss all callback
    onExecuteTool?: (toolCall: ToolCall, suggestionId: string) => void;
    onExecuteToolSequence?: (toolSequence: { goal: string; steps: Array<{ description: string; toolCall: ToolCall }> }, suggestionId: string) => void;
    // History restoration callback
    onRestoreToCheckpoint?: (logIndex: number) => void;
    // Application state context
    currentPageInfo?: {pageId: string, url: string} | null;
    isInEditor?: boolean;
    editingTableId?: string | null;
    onTableModified?: (tableId: string) => void; // Add callback for table modifications
    updateHTMLContext?: React.Dispatch<React.SetStateAction<Record<string, { pageURL: string, htmlContent: string }>>>;
    onOpenApiSettings?: () => void;
}

const ToolView: React.FC<ToolViewProps> = ({
    logs,
    htmlContext,
    messages,
    addMessage,
    setMessages,
    agentLoading,
    setAgentLoading,
    instances,
    setInstances,
    heightMode = 'small',
    onToggleHeightMode,
    suggestions = [],
    onAcceptSuggestion,
    onDismissSuggestion,
    onDismissAllSuggestions,
    onExecuteTool,
    onExecuteToolSequence,
    onRestoreToCheckpoint,
    currentPageInfo,
    isInEditor,
    editingTableId,
    onTableModified,
    updateHTMLContext,
    onOpenApiSettings
}) => {
    const [activeRightTab, setActiveRightTab] = useState<'chat' | 'history' | 'logs'>('chat');
    const [showSystemLogs, setShowSystemLogs] = useState(false);

    const isMinimized = heightMode === 'minimum';
    
    // Function to get height mode display text
    const getHeightModeDisplay = () => {
        switch (heightMode) {
            case 'minimum': return 'Min';
            case 'small': return '33%';
            case 'large': return '66%';
            default: return '33%';
        }
    };

    // Function to get toggle button icon
    const getToggleIcon = () => {
        switch (heightMode) {
            case 'minimum': return '▲';
            case 'small': return '◐';
            case 'large': return '▼';
            default: return '◐';
        }
    };

    return (
        <div className={`view-container tool-view height-${heightMode}`}>
            <div className="view-title-container">
                <div className="left-pane-header">
                    <h3 className={`pane-title ${isMinimized ? 'disabled' : ''}`}>
                        AI Suggestions {suggestions.filter(s => s.scope === 'macro').length > 0 && `(${suggestions.filter(s => s.scope === 'macro').length})`}
                    </h3>
                    {onDismissAllSuggestions && suggestions.filter(s => s.scope === 'macro').length > 0 && (
                        <button
                            className="dismiss-all-btn"
                            onClick={onDismissAllSuggestions}
                            title="Dismiss all AI suggestions"
                            disabled={isMinimized}
                        >
                            Dismiss All
                        </button>
                    )}
                </div>
                <div className="right-pane-header">
                    <h3
                        className={`tab-button ${activeRightTab === 'chat' ? 'active' : ''} ${isMinimized ? 'disabled' : ''}`}
                        onClick={() => !isMinimized && setActiveRightTab('chat')}
                    >
                        Chat
                    </h3>
                    <h3
                        className={`tab-button ${activeRightTab === 'history' ? 'active' : ''} ${isMinimized ? 'disabled' : ''}`}
                        onClick={() => !isMinimized && setActiveRightTab('history')}
                    >
                        History {logs.length > 0 && `(${logs.length})`}
                    </h3>
                    {onOpenApiSettings && (
                        <button
                            onClick={onOpenApiSettings}
                            title="API Settings"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', padding: '0 4px', color: '#666', marginLeft: 4 }}
                        >⚙</button>
                    )}
                </div>
                <div className="collapse-toggle-container">
                    <span className="height-mode-indicator">{getHeightModeDisplay()}</span>
                    <button
                        className="collapse-toggle"
                        onClick={onToggleHeightMode}
                        title={`Switch height mode (current: ${getHeightModeDisplay()})`}
                    >
                        {getToggleIcon()}
                    </button>
                </div>
            </div>

            {!isMinimized && (
                <div className="view-content split-pane-layout">
                    {/* Left Pane: AI Suggestions */}
                    <div className="left-pane">
                        <MacroSuggestionPanel
                            suggestions={suggestions}
                            onAccept={onAcceptSuggestion || (() => {})}
                            onDismiss={onDismissSuggestion || (() => {})}
                            onDismissAll={onDismissAllSuggestions}
                            onExecuteTool={onExecuteTool || (() => {})}
                            onExecuteToolSequence={onExecuteToolSequence}
                            className="embedded-suggestions-panel"
                            isCollapsed={false}
                        />
                    </div>
                    
                    {/* Right Pane: Chat, History, System Logs */}
                    <div className="right-pane">
                        {activeRightTab === 'chat' && (
                            <ChatTab
                                messages={messages}
                                addMessage={addMessage}
                                setMessages={setMessages}
                                agentLoading={agentLoading}
                                setAgentLoading={setAgentLoading}
                                instances={instances}
                                htmlContext={htmlContext}
                                setInstances={setInstances}
                                logs={logs}
                                currentToolViewTab={activeRightTab}
                                currentPageInfo={currentPageInfo}
                                isInEditor={isInEditor}
                                editingTableId={editingTableId}
                                onTableModified={onTableModified}
                                updateHTMLContext={updateHTMLContext}
                            />
                        )}
                        {activeRightTab === 'history' && (
                            <HistoryTab
                                logs={logs}
                                onRestoreToCheckpoint={onRestoreToCheckpoint}
                            />
                        )}
                    </div>
                </div>
            )}
            
            {/* System Logs Viewer Modal */}
            <SystemLogsViewer
                isOpen={showSystemLogs}
                onClose={() => setShowSystemLogs(false)}
            />
        </div>
    );
};

export default ToolView;