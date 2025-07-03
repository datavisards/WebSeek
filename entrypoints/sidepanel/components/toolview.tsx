import React, { useState, useRef, useEffect } from 'react';
import { Message, Instance } from '../types.tsx';
import './toolview.css';
import CodeMirror from '@uiw/react-codemirror';
import { autocompletion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { python } from '@codemirror/lang-python';
import { loadPyodide } from 'pyodide';

interface ToolViewProps {
    logs: string[];
    htmlContexts: Record<string, string>;
    messages: Message[];
    addMessage: (message: Message) => void;
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
    agentLoading: boolean;
    setAgentLoading: React.Dispatch<React.SetStateAction<boolean>>;
    instances: Instance[];
}

interface CodeCell {
    id: number;
    content: string;
    outputs: CodeOutput[];
    isExecuting: boolean;
}

interface CodeOutput {
    type: 'stdout' | 'stderr' | 'error';
    content: string;
    timestamp: Date;
}

const ToolView: React.FC<ToolViewProps> = ({ logs, htmlContexts, messages, addMessage, setMessages, agentLoading, setAgentLoading, instances }) => {
    const [inputValue, setInputValue] = useState('');
    const [activeTab, setActiveTab] = useState<'chat' | 'code'>('chat');
    const [codeOutputs, setCodeOutputs] = useState<CodeOutput[]>([]);
    const messagesEndRef = useRef<null | HTMLDivElement>(null);
    const outputsEndRef = useRef<null | HTMLDivElement>(null);
    const [prevInstanceIds, setPrevInstanceIds] = useState<string[]>([]);
    const [instanceIds, setInstanceIds] = useState<string[]>([]);
    const [cells, setCells] = useState<CodeCell[]>([
        {
            id: 0,
            content: '# Write your Python code here\nprint("Hello, World!")',
            outputs: [],
            isExecuting: false,
        },
    ]);

    const pyodide = useRef<any>(null); // To store the loaded Pyodide instance
    const [isPyodideLoading, setIsPyodideLoading] = useState(true);

    // Load Pyodide on component mount
    useEffect(() => {
        const initPyodide = async () => {
            setIsPyodideLoading(true); // Set loading true at the start
            try {
                // This path is now relative to the root of your built extension,
                // because WXT copied the `public/pyodide` folder there.
                const loadedPyodide = await loadPyodide({
                    indexURL: chrome.runtime.getURL('pyodide'),
                });

                // LOAD PANDAS PACKAGE
                await loadedPyodide.loadPackage('pandas');
                console.log('Pyodide and pandas loaded successfully!');
                pyodide.current = loadedPyodide;
                console.log('Pyodide loaded successfully!');
            } catch (error) {
                console.error('Failed to load Pyodide:', error);
            } finally {
                setIsPyodideLoading(false);
            }
        };
        initPyodide();
    }, []);

    const sendMsg = () => {
        addMessage({ role: 'user', message: inputValue });
        setInputValue('');
        setAgentLoading(true);
    }

    // Scroll to bottom whenever messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        outputsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [codeOutputs]);

    // Update global environment with current instances
    const updateGlobalEnvironment = () => {
        if (!pyodide.current) return;

        const allInstances = instances.reduce<Record<string, Instance>>((acc, instance) => {
            acc[instance.id] = instance;
            return acc;
        }, {});
        const currentIds = Object.keys(allInstances);
        setInstanceIds(currentIds);

        // Remove instances that no longer exist
        prevInstanceIds.forEach(id => {
            if (!allInstances[id] && pyodide.current.globals.has(id)) {
                pyodide.current.globals.delete(id);
            }
        });

        // Add/update current instances
        Object.entries(allInstances).forEach(([id, instance]) => {
            pyodide.current.globals.set(id, pyodide.current.toPy(instance));
        });

        // Store current IDs for next comparison
        setPrevInstanceIds(currentIds);
    };

    // Custom autocompletion for instance IDs
    const instanceCompletions = useMemo(() => {
        return (context: CompletionContext): CompletionResult | null => {
            const word = context.matchBefore(/\w*/);
            if (!word || (word.from === word.to && !context.explicit)) {
                return null;
            }

            return {
                from: word.from,
                options: instanceIds.map(id => ({
                    label: id,
                    type: "variable",
                    info: "Instance variable",
                    boost: 1.0
                }))
            };
        };
    }, [instanceIds]);

    // Combine Python completions with our instance completions
    const customCompletions = useMemo(() => {
        return [
            python(),
            autocompletion({
                override: [instanceCompletions]
            })
        ];
    }, [instanceCompletions]);

    // Update environment when tab changes to code
    useEffect(() => {
        if (activeTab === 'code') {
            updateGlobalEnvironment();
        }
    }, [activeTab]);

    const executeCell = async (cellId: number) => {
        setCells((prevCells) =>
            prevCells.map((cell) =>
                cell.id === cellId ? { ...cell, isExecuting: true, outputs: [] } : cell // Clear previous output
            )
        );

        const cell = cells.find((c) => c.id === cellId);
        if (!cell || !pyodide.current) {
            // Handle case where Pyodide is not loaded yet or cell is not found
            setCells((prevCells) =>
                prevCells.map((c) =>
                    c.id === cellId ? { ...c, isExecuting: false } : c
                )
            );
            return;
        }

        const timestamp = new Date();
        const capturedOutputs: CodeOutput[] = [];

        try {
            // --- THIS IS THE CORE LOGIC ---

            // 1. Set up stdout and stderr handlers to capture Python's print statements
            pyodide.current.setStdout({
                batched: (msg: string) => {
                    capturedOutputs.push({
                        type: 'stdout',
                        content: msg,
                        timestamp: new Date(),
                    });
                },
            });
            pyodide.current.setStderr({
                batched: (msg: string) => {
                    capturedOutputs.push({
                        type: 'stderr',
                        content: msg,
                        timestamp: new Date(),
                    });
                },
            });

            // 2. SETUP GLOBAL ENVIRONMENT
            updateGlobalEnvironment();


            // 3. Execute the Python code
            const result = await pyodide.current.runPythonAsync(cell.content);

            // If the python code returns a value, display it
            if (result !== undefined) {
                capturedOutputs.push({
                    type: 'stdout',
                    content: `=> ${result}`, // A common convention for return values
                    timestamp: new Date(),
                });
            }

        } catch (err) {
            // Capture execution errors (e.g., Python syntax errors)
            capturedOutputs.push({
                type: 'error',
                content: (err as Error).message,
                timestamp,
            });
        } finally {
            // 4. Reset handlers and update state
            pyodide.current.setStdout({});
            pyodide.current.setStderr({});

            setCells((prevCells) =>
                prevCells.map((c) =>
                    c.id === cellId
                        ? {
                            ...c,
                            outputs: capturedOutputs,
                            isExecuting: false,
                        }
                        : c
                )
            );
        }
    };

    const addCell = () => {
        setCells((prevCells) => [
            ...prevCells,
            {
                id: prevCells.length,
                content: '',
                outputs: [],
                isExecuting: false,
            },
        ]);
    };

    const removeCell = (cellId: number) => {
        setCells((prevCells) => prevCells.filter((cell) => cell.id !== cellId));
    };

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
        <div className="view-container">
            <div className="view-title-container">
                <h3
                    className={`tab-button ${activeTab === 'chat' ? 'active' : ''}`}
                    onClick={() => setActiveTab('chat')}
                >
                    Chat
                </h3>
                <h3
                    className={`tab-button ${activeTab === 'code' ? 'active' : ''}`}
                    onClick={() => setActiveTab('code')}
                >
                    Code
                </h3>
            </div>

            <div className="view-content" style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
            }}>
                {/* Messages container - only visible in chat tab */}
                {activeTab === 'chat' && (
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
                )}

                {/* Code editor - only visible in code tab */}
                {activeTab === 'code' && (
                    <div className="code-editor-container">
                        {cells.map((cell) => (
                            <div key={cell.id} className="code-cell">
                                <div className="code-toolbar">
                                    <button
                                        className="run-button"
                                        onClick={() => executeCell(cell.id)}
                                        disabled={cell.isExecuting}
                                    >
                                        {cell.isExecuting ? 'Running...' : '▶ Run'}
                                    </button>
                                    <button
                                        className="remove-button"
                                        onClick={() => removeCell(cell.id)}
                                    >
                                        Remove
                                    </button>
                                </div>
                                <CodeMirror
                                    value={cell.content}
                                    height="auto"
                                    extensions={customCompletions}
                                    onChange={(value) =>
                                        setCells((prevCells) =>
                                            prevCells.map((c) =>
                                                c.id === cell.id ? { ...c, content: value } : c
                                            )
                                        )
                                    }
                                    basicSetup={{
                                        lineNumbers: true,
                                        highlightActiveLine: true,
                                        highlightSelectionMatches: true,
                                        autocompletion: true,
                                        closeBrackets: true,
                                    }}
                                    theme="light"
                                />
                                <div className="code-output-container">
                                    {cell.outputs.map((output, idx) => (
                                        <pre
                                            key={idx}
                                            className={`output-item ${output.type === 'stdout'
                                                ? 'stdout'
                                                : output.type === 'stderr'
                                                    ? 'stderr'
                                                    : 'error'
                                                }`}
                                        >
                                            {output.content}
                                        </pre>
                                    ))}
                                    <div ref={outputsEndRef} />
                                </div>
                            </div>
                        ))}
                        <button className="add-cell-button" onClick={addCell}>
                            ➕ Add Cell
                        </button>
                    </div>
                )}

                {/* Input form - only visible in chat tab */}
                {activeTab === 'chat' && (
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
                )}
            </div>
        </div>
    );
};

export default ToolView;