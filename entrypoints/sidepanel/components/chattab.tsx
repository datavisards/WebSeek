import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Message, Instance } from '../types';
import './chattab.css';

interface ChatTabProps {
    messages: Message[];
    addMessage: (message: Message) => void;
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
    agentLoading: boolean;
    setAgentLoading: React.Dispatch<React.SetStateAction<boolean>>;
    instances: Instance[];
}

const ChatTab: React.FC<ChatTabProps> = ({
    messages,
    addMessage,
    setMessages,
    agentLoading,
    setAgentLoading,
    instances,
}) => {
    const [inputValue, setInputValue] = useState('');
    const [showAutocomplete, setShowAutocomplete] = useState(false);
    const [autoCompleteList, setAutoCompleteList] = useState<string[]>([]);
    const [autoCompleteIndex, setAutoCompleteIndex] = useState(0);
    const [autoCompleteStartPos, setAutoCompleteStartPos] = useState(0);
    const messagesEndRef = useRef<null | HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Handle autocomplete visibility and filtering
    useEffect(() => {
        if (!inputValue.includes('@')) {
            setShowAutocomplete(false);
            return;
        }

        const cursorPos = inputRef.current?.selectionStart || 0;
        const textBeforeCursor = inputValue.substring(0, cursorPos);
        const lastAtPos = textBeforeCursor.lastIndexOf('@');
        
        if (lastAtPos === -1) {
            setShowAutocomplete(false);
            return;
        }

        const textAfterAt = textBeforeCursor.substring(lastAtPos + 1);
        const hasSpace = /\s/.test(textAfterAt);
        
        if (hasSpace) {
            setShowAutocomplete(false);
            return;
        }

        setAutoCompleteStartPos(lastAtPos);
        setShowAutocomplete(true);
        
        // Filter instances based on text after '@'
        const searchTerm = textAfterAt.toLowerCase();
        const instanceIds = instances.map(item => item.id);
        const filteredIds = instanceIds.filter(id => 
            id.toLowerCase().includes(searchTerm)
        );
        
        setAutoCompleteList(filteredIds);
        setAutoCompleteIndex(0);
    }, [inputValue, instances]);

    // Close autocomplete when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (showAutocomplete && !(e.target as Element).closest('.autocomplete-container')) {
                setShowAutocomplete(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showAutocomplete]);

    const selectAutocompleteItem = (id: string) => {
        const textBefore = inputValue.substring(0, autoCompleteStartPos);
        const textAfter = inputValue.substring(autoCompleteStartPos).replace(/@[^\s]*/, `@${id}`);
        setInputValue(textBefore + textAfter);
        setShowAutocomplete(false);
        
        // Focus input after selection
        setTimeout(() => {
            inputRef.current?.focus();
            const cursorPos = (textBefore + `@${id}`).length;
            inputRef.current?.setSelectionRange(cursorPos, cursorPos);
        }, 0);
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (!showAutocomplete) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setAutoCompleteIndex(prev => 
                    Math.min(prev + 1, autoCompleteList.length - 1)
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setAutoCompleteIndex(prev => Math.max(prev - 1, 0));
                break;
            case 'Enter':
                if (autoCompleteList.length > 0) {
                    e.preventDefault();
                    selectAutocompleteItem(autoCompleteList[autoCompleteIndex]);
                }
                break;
            case 'Escape':
                setShowAutocomplete(false);
                break;
            case 'Tab':
                if (autoCompleteList.length > 0) {
                    e.preventDefault();
                    selectAutocompleteItem(autoCompleteList[autoCompleteIndex]);
                }
                break;
        }
    };

    const sendMsg = () => {
        if (!inputValue.trim()) return;
        
        addMessage({ role: 'user', message: inputValue });
        setInputValue('');
        setAgentLoading(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        sendMsg();
    };

    return (
        <>
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
                {agentLoading && (
                    <div className="message-bubble agent loading-indicator">
                        <div className="loading-dot"></div>
                        <div className="loading-dot"></div>
                        <div className="loading-dot"></div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handleSubmit} className="message-input-form">
                <div className="input-container">
                    <input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type your message..."
                        className="message-input"
                    />
                    {showAutocomplete && autoCompleteList.length > 0 && (
                        <div className="autocomplete-container">
                            {autoCompleteList.map((id, index) => (
                                <div
                                    key={id}
                                    className={`autocomplete-item ${index === autoCompleteIndex ? 'selected' : ''}`}
                                    onClick={() => selectAutocompleteItem(id)}
                                >
                                    {id}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <button type="submit" className="send-button">
                    Send
                </button>
            </form>
        </>
    );
};

export default ChatTab;