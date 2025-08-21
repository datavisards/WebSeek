import React, { useState } from 'react';
import { Message, Instance } from '../types';
import './toolview.css';
import ChatTab from './chattab';
import CodeTab from './codetab';

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
    onToggleCollapse
}) => {
    const [activeTab, setActiveTab] = useState<'chat' | 'code'>('chat');

    return (
        <div className={`view-container tool-view ${isCollapsed ? 'collapsed' : ''}`}>
            <div className="view-title-container">
                <h3
                    className={`tab-button ${activeTab === 'chat' ? 'active' : ''} ${isCollapsed ? 'disabled' : ''}`}
                    onClick={() => !isCollapsed && setActiveTab('chat')}
                >
                    Chat
                </h3>
                <h3
                    className={`tab-button ${activeTab === 'code' ? 'active' : ''} ${isCollapsed ? 'disabled' : ''}`}
                    onClick={() => !isCollapsed && setActiveTab('code')}
                >
                    Code
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
                        />
                    )}
                    {activeTab === 'code' && (
                        <CodeTab instances={instances} setInstances={setInstances} />
                    )}
                </div>
            )}
        </div>
    );
};

export default ToolView;