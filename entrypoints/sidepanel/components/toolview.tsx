import React, { useState } from 'react';
import { Message, Instance, ProactiveSuggestion } from '../types';
import './toolview.css';
import ChatTab from './chattab';
import CodeTab from './codetab';
import HistoryTab from './historytab';
import MacroSuggestionPanel from './MacroSuggestionPanel';

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
    onExecuteTool?: (toolCall: { function: string; parameters: any }, suggestionId: string) => void;
    onExecuteToolSequence?: (toolSequence: { goal: string; steps: Array<{ description: string; toolCall: { function: string; parameters: any } }> }, suggestionId: string) => void;
    // History restoration callback
    onRestoreToCheckpoint?: (logIndex: number) => void;
    // Application state context
    currentPageInfo?: {pageId: string, url: string} | null;
    isInEditor?: boolean;
    editingTableId?: string | null;
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
    editingTableId
}) => {
    const [activeTab, setActiveTab] = useState<'chat' | 'code' | 'suggestions' | 'history'>('suggestions');

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
                <h3
                    className={`tab-button ${activeTab === 'suggestions' ? 'active' : ''} ${isMinimized ? 'disabled' : ''}`}
                    onClick={() => !isMinimized && setActiveTab('suggestions')}
                >
                    AI Suggestions {suggestions.filter(s => s.scope === 'macro').length > 0 && `(${suggestions.filter(s => s.scope === 'macro').length})`}
                </h3>
                <h3
                    className={`tab-button ${activeTab === 'chat' ? 'active' : ''} ${isMinimized ? 'disabled' : ''}`}
                    onClick={() => !isMinimized && setActiveTab('chat')}
                >
                    Chat
                </h3>
                <h3
                    className={`tab-button ${activeTab === 'history' ? 'active' : ''} ${isMinimized ? 'disabled' : ''}`}
                    onClick={() => !isMinimized && setActiveTab('history')}
                >
                    History {logs.length > 0 && `(${logs.length})`}
                </h3>
                {activeTab === 'suggestions' && onDismissAllSuggestions && suggestions.filter(s => s.scope === 'macro').length > 0 && (
                    <button
                        className="dismiss-all-btn"
                        onClick={onDismissAllSuggestions}
                        title="Dismiss all AI suggestions"
                    >
                        Dismiss All
                    </button>
                )}
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
                <div className="view-content" style={{
                    display: 'flex',
                    flexDirection: 'column',
                    flex: 1,
                }}>
                    {activeTab === 'suggestions' && (
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
                    )}
                    {activeTab === 'chat' && (
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
                            currentToolViewTab={activeTab}
                            currentPageInfo={currentPageInfo}
                            isInEditor={isInEditor}
                            editingTableId={editingTableId}
                        />
                    )}
                    {activeTab === 'history' && (
                        <HistoryTab
                            logs={logs}
                            onRestoreToCheckpoint={onRestoreToCheckpoint}
                        />
                    )}
                </div>
            )}
        </div>
    );
};

export default ToolView;