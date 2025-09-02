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
    isCollapsed?: boolean;
    onToggleCollapse?: () => void;
    // New props for suggestions
    suggestions?: ProactiveSuggestion[];
    onAcceptSuggestion?: (suggestionId: string) => void;
    onDismissSuggestion?: (suggestionId: string) => void;
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
    isCollapsed = false,
    onToggleCollapse,
    suggestions = [],
    onAcceptSuggestion,
    onDismissSuggestion,
    onExecuteTool,
    onExecuteToolSequence,
    onRestoreToCheckpoint,
    currentPageInfo,
    isInEditor,
    editingTableId
}) => {
    const [activeTab, setActiveTab] = useState<'chat' | 'code' | 'suggestions' | 'history'>('suggestions');

    return (
        <div className={`view-container tool-view ${isCollapsed ? 'collapsed' : ''}`}>
            <div className="view-title-container">
                <h3
                    className={`tab-button ${activeTab === 'suggestions' ? 'active' : ''} ${isCollapsed ? 'disabled' : ''}`}
                    onClick={() => !isCollapsed && setActiveTab('suggestions')}
                >
                    AI Suggestions {suggestions.filter(s => s.scope === 'macro').length > 0 && `(${suggestions.filter(s => s.scope === 'macro').length})`}
                </h3>
                <h3
                    className={`tab-button ${activeTab === 'chat' ? 'active' : ''} ${isCollapsed ? 'disabled' : ''}`}
                    onClick={() => !isCollapsed && setActiveTab('chat')}
                >
                    Chat
                </h3>
                <h3
                    className={`tab-button ${activeTab === 'history' ? 'active' : ''} ${isCollapsed ? 'disabled' : ''}`}
                    onClick={() => !isCollapsed && setActiveTab('history')}
                >
                    History {logs.length > 0 && `(${logs.length})`}
                </h3>
                <div className="collapse-toggle-container">
                    <button
                        className="collapse-toggle"
                        onClick={onToggleCollapse}
                        title={isCollapsed ? 'Expand tool view' : 'Collapse tool view'}
                    >
                        {isCollapsed ? '▲' : '▼'}
                    </button>
                </div>
            </div>

            {!isCollapsed && (
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