import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Message, Instance, ChatType } from '../types';
import { chatWithAgent } from '../api-selector';
import { generateInstanceContext, detectMarkdown, renderMarkdown, generateId, updateInstances } from '../utils';
import { proactiveService } from '../proactive-service-enhanced';
import './chattab.css';

interface ChatTabProps {
    messages: Message[];
    addMessage: (message: Message) => void;
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
    agentLoading: boolean;
    setAgentLoading: React.Dispatch<React.SetStateAction<boolean>>;
    instances: Instance[];
    htmlContext: Record<string, { pageURL: string, htmlContent: string }>;
    setInstances: React.Dispatch<React.SetStateAction<Instance[]>>;
    logs: string[];
    currentToolViewTab?: 'chat' | 'code' | 'suggestions' | 'history';
    currentPageInfo?: {pageId: string, url: string} | null;
    isInEditor?: boolean;
    editingTableId?: string | null;
}

const ChatTab: React.FC<ChatTabProps> = ({
    messages,
    addMessage,
    setMessages,
    agentLoading,
    setAgentLoading,
    instances,
    htmlContext,
    setInstances,
    logs,
    currentToolViewTab,
    currentPageInfo,
    isInEditor,
    editingTableId
}) => {
    const [inputValue, setInputValue] = useState('');
    const [showAutocomplete, setShowAutocomplete] = useState(false);
    const [autoCompleteList, setAutoCompleteList] = useState<string[]>([]);
    const [autoCompleteIndex, setAutoCompleteIndex] = useState(0);
    const [autoCompleteStartPos, setAutoCompleteStartPos] = useState(0);
    const messagesEndRef = useRef<null | HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const [isRetrying, setIsRetrying] = useState(false);

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

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        // Handle Enter key for form submission
        if (e.key === 'Enter' && !e.shiftKey && !showAutocomplete) {
            e.preventDefault();
            sendMsg();
            return;
        }

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
                if (autoCompleteList.length > 0 && !e.shiftKey) {
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

    // Generate operation logs from instance changes
    const generateOperationLogs = (oldInstances: Instance[], newInstanceEvents: any[]): string[] => {
        const logs: string[] = [];
        
        newInstanceEvents.forEach(event => {
            if (event.action === 'add' && event.instance) {
                logs.push(`Created ${event.instance.type} "${event.instance.id}"`);
            } else if (event.action === 'update' && event.instance && event.originalId) {
                logs.push(`Updated ${event.instance.type} "${event.originalId}"`);
            } else if (event.action === 'remove' && event.originalId) {
                const oldInstance = oldInstances.find(inst => inst.id === event.originalId);
                if (oldInstance) {
                    logs.push(`Removed ${oldInstance.type} "${event.originalId}"`);
                }
            }
        });
        
        return logs;
    };

    // Common function to call the LLM API
    const callLLMApi = async (
        chatType: ChatType,
        userMessage: string, 
        conversationHistory: Message[], 
        currentInstances: Instance[]
    ): Promise<{ message: string; instances: any[] }> => {
        let message: string = "", newInstances: any[] = [];
        
        if (import.meta.env.WXT_USE_LLM == "true") {
            const { imageContext, textContext } = await generateInstanceContext(currentInstances);
            
            // Construct application context
            const applicationContext = {
                currentToolViewTab,
                currentPageInfo,
                isInEditor,
                editingTableId
            };
            
            let result = await chatWithAgent(chatType, userMessage,
                conversationHistory,
                textContext,
                imageContext,
                htmlContext,
                logs,
                applicationContext
            );
            message = result.message;
            newInstances = result.instances || [];
        } else {
            // Construct application context even when LLM is disabled
            const applicationContext = {
                currentToolViewTab,
                currentPageInfo,
                isInEditor,
                editingTableId
            };
            
            const result = await chatWithAgent(chatType, userMessage, [], '', [], {}, [], applicationContext);
            message = result.message;
            newInstances = result.instances || [];
        }
        
        return { message, instances: newInstances };
    };

    const sendMsg = async (retryMessageId?: string) => {
        const userMessage = retryMessageId ?
            messages.find(m => m.id === retryMessageId && m.role === 'user')?.message || '' :
            inputValue.trim();

        if (!userMessage || agentLoading) return;
        
        // Stop proactive suggestions when user sends a message
        proactiveService.stopSuggestions();

        let conversationHistory = structuredClone(messages);

        if (!retryMessageId) {
            setInputValue('');
            // Create instances checkpoint before sending user message
            const checkpoint = JSON.parse(JSON.stringify(instances));
            // Add user message to chat with checkpoint
            addMessage({
                role: 'user',
                message: userMessage,
                chatType: 'chat',
                id: generateId(),
                instancesCheckpoint: checkpoint
            });
        }

        setAgentLoading(true);

        try {
            const { message, instances: newInstances } = await callLLMApi('chat', userMessage, conversationHistory, instances);

            // Generate operation logs before updating instances
            const operationLogs = generateOperationLogs(instances, newInstances);

            // Add agent response to chat with operation logs
            addMessage({
                role: 'agent',
                message: message,
                id: generateId(),
                isRetrying: false,
                operations: operationLogs
            });

            // Update the instances
            updateInstances(instances, newInstances, setInstances);
        } catch (error) {
            console.error('Error in chat:', error);
            addMessage({
                role: 'agent',
                message: 'Sorry, I encountered an error while processing your request. Please try again.',
                id: generateId(),
                isRetrying: false
            });
        } finally {
            setAgentLoading(false);
            // Resume proactive suggestions after chat response completes
            proactiveService.resumeSuggestions();
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        sendMsg();
    };

    const handleRetry = async (agentMessageId: string) => {
        // Find the agent message and corresponding user message
        const agentMessageIndex = messages.findIndex(m => m.id === agentMessageId);
        if (agentMessageIndex === -1) return;

        // Find the user message that triggered this agent response
        let userMessageIndex = agentMessageIndex - 1;
        while (userMessageIndex >= 0 && messages[userMessageIndex].role !== 'user') {
            userMessageIndex--;
        }

        if (userMessageIndex === -1) return;

        const userMessage = messages[userMessageIndex];
        console.log("Retrying user message:", userMessage);

        // Set the agent message to retrying state
        setMessages(prev =>
            prev.map(m =>
                m.id === agentMessageId
                    ? { ...m, isRetrying: true, message: '' }
                    : m
            )
        );

        // Restore instances to checkpoint if available
        const currentInstances = userMessage.instancesCheckpoint || instances;
        if (userMessage.instancesCheckpoint) {
            setInstances(userMessage.instancesCheckpoint);
        }

        // Stop proactive suggestions when user retries a message
        proactiveService.stopSuggestions();
        
        setIsRetrying(true);
        setAgentLoading(true);

        try {
            // Call the LLM API with retry context
            const { message, instances: newInstances } = await callLLMApi(
                userMessage.chatType || 'chat',
                userMessage.message,
                messages.slice(0, userMessageIndex), // Only include conversation up to the retry point
                currentInstances
            );

            // Generate operation logs before updating instances
            const operationLogs = generateOperationLogs(currentInstances, newInstances);

            // Update the retrying message with new response and operation logs
            setMessages(prev =>
                prev.map(m =>
                    m.id === agentMessageId
                        ? { ...m, isRetrying: false, message: message, operations: operationLogs }
                        : m
                )
            );

            // Update the instances
            updateInstances(currentInstances, newInstances, setInstances);
        } catch (error) {
            console.error('Error in retry:', error);
            setMessages(prev =>
                prev.map(m =>
                    m.id === agentMessageId
                        ? { ...m, isRetrying: false, message: 'Sorry, I encountered an error while processing your request. Please try again.' }
                        : m
                )
            );
        } finally {
            setIsRetrying(false);
            setAgentLoading(false);
            // Resume proactive suggestions after retry completes
            proactiveService.resumeSuggestions();
        }
    };

    const renderMessage = (msg: Message) => {
        const messageContent = msg.role === 'agent' && detectMarkdown(msg.message) ? (
            <div
                className="markdown-content"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.message) }}
            />
        ) : msg.message;

        return (
            <div className="message-content-wrapper">
                {msg.isRetrying ? (
                    <div className="retry-loading-indicator">
                        <div className="loading-dot"></div>
                        <div className="loading-dot"></div>
                        <div className="loading-dot"></div>
                    </div>
                ) : messageContent}
                {msg.role === 'agent' && !msg.isRetrying && msg.message && (
                    <button
                        className="retry-button"
                        onClick={() => handleRetry(msg.id!)}
                        title="Retry this response"
                        disabled={agentLoading}
                    >
                        ↻
                    </button>
                )}
            </div>
        );
    };

    return (
        <>
            <div className="messages-container">
                {messages.length === 0 ? (
                    <div className="chat-empty-state">
                        <div className="empty-icon">💬</div>
                        <div className="empty-text">
                            <p>No messages yet. Start a conversation!</p>
                            <small>Ask questions about your data or get AI assistance</small>
                        </div>
                    </div>
                ) : (
                    messages.map((msg, index) => (
                        <div
                            key={msg.id || index}
                            className={`message-bubble ${msg.role === 'user' ? 'user' : 'agent'}`}
                        >
                            {renderMessage(msg)}
                        </div>
                    ))
                )}
                {agentLoading && !isRetrying && (
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
                    <textarea
                        ref={inputRef}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type your message... (Use '@' to mention existing instances)"
                        className="message-input"
                        disabled={agentLoading}
                        rows={1}
                        style={{ resize: 'vertical', minHeight: '40px' }}
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
                {agentLoading ? (
                    <button
                        type="button"
                        className="stop-button"
                        onClick={() => {
                            setAgentLoading(false);
                        }}
                    >
                        Stop
                    </button>
                ) : <button type="submit" className="send-button" disabled={agentLoading || !inputValue.trim()}>
                    Send
                </button>}
            </form>
        </>
    );
};

export default ChatTab;