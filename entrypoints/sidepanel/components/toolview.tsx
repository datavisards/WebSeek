import React, { useState, useRef, useEffect } from 'react';
import { Message } from '../types.tsx';
import './toolview.css';

interface ToolViewProps {
    logs: string[];
    htmlContexts: Record<string, string>;
    messages: Message[];
    addMessage: (message: Message) => void;
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
    agentLoading: boolean;
    setAgentLoading: React.Dispatch<React.SetStateAction<boolean>>;
}

const ToolView: React.FC<ToolViewProps> = ({ logs, htmlContexts, messages, addMessage, setMessages, agentLoading, setAgentLoading }) => {
    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef<null | HTMLDivElement>(null);

    const sendMsg = () => {
        addMessage({ role: 'user', message: inputValue });
        setInputValue('');
        setAgentLoading(true);
    }

    // Scroll to bottom whenever messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim()) return;

        // Add user message
        const newMessages = [...messages, { role: 'user', message: inputValue.trim() }];
        setMessages(newMessages);
        setInputValue('');

        // Simulate agent response after delay
        setTimeout(() => {
            setMessages(prev => [...prev, { role: 'agent', message: 'Thanks for your message!' }]);
        }, 500);
    };

    return (
        <div className="view-container chat-view">
            <div className="view-title-container">
                <h3 style={{ margin: 0 }}>Chat</h3>
            </div>
            <div className="view-content" style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
            }}>
                {/* Messages container */}
                <div className="messages-container">
                    {messages.length === 0 ? (
                        <div className="empty-message">No messages yet. Start a conversation!</div>
                    ) : (
                        messages.map((msg, index) => (
                            <div
                                key={index}
                                className={`message-bubble ${msg.role === 'user' ? 'user' : 'agent'}`}
                            >
                                {msg.message}
                            </div>
                        ))
                    )}
                    {/* Loading indicator */}
                    {agentLoading && (
                        <div className="message-bubble agent loading-indicator">
                            <div className="loading-dot"></div>
                            <div className="loading-dot"></div>
                            <div className="loading-dot"></div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input form */}
                <form onSubmit={handleSubmit} className="message-input-form">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Type your message..."
                        className="message-input"
                    />
                    <button type="submit" className="send-button" onClick={sendMsg}>
                        Send
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ToolView;