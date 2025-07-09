import React, { useState, useRef, useEffect, useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { autocompletion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { python } from '@codemirror/lang-python';
import { loadPyodide } from 'pyodide';
import { Instance } from '../types';
import './codetab.css';
import { mapToObject, parseInstance } from '../utils';

interface CodeTabProps {
    instances: Instance[];
    setInstances: React.Dispatch<React.SetStateAction<Instance[]>>;
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

const CodeTab: React.FC<CodeTabProps> = ({ instances, setInstances }) => {
    const [cells, setCells] = useState<CodeCell[]>([
        {
            id: 0,
            content: '# Write your Python code here\nprint("Hello, World!")',
            outputs: [],
            isExecuting: false,
        },
    ]);
    const [prevInstanceIds, setPrevInstanceIds] = useState<string[]>([]);
    const [instanceIds, setInstanceIds] = useState<string[]>([]);
    const pyodide = useRef<any>(null);
    const [isPyodideLoading, setIsPyodideLoading] = useState(true);
    const outputsEndRef = useRef<null | HTMLDivElement>(null);

    // Define the render function to be exposed to Pyodide
    const render = (data: any) => {
        console.log("render", data);
        const parsed = parseInstance(data);
        console.log("parsed", parsed);
        // If the id exists, update the instance; otherwise, add it
        setInstances(prev => {
            const existingIndex = prev.findIndex(inst => inst.id === parsed.id);
            if (existingIndex !== -1) {
                return [...prev.slice(0, existingIndex), parsed as Instance, ...prev.slice(existingIndex + 1)];
            }
            return [...prev, parsed as Instance];
        });
    };

    useEffect(() => {
        const initPyodide = async () => {
            setIsPyodideLoading(true);
            try {
                const loadedPyodide = await loadPyodide({
                    indexURL: "/pyodide/pyodide/",
                });
                // Load numpy first as pandas depends on it
                await loadedPyodide.loadPackage('numpy');
                // Then load pandas
                await loadedPyodide.loadPackage('pandas');
                // Verify pandas is loaded
                await loadedPyodide.runPythonAsync('import pandas as pd; print("Pandas version:", pd.__version__)');
                pyodide.current = loadedPyodide;

                // Expose the render function to Pyodide
                loadedPyodide.globals.set("render", (data: any) => {
                    // data is a PyProxy, convert to JS object if possible
                    let jsData;
                    if (data && typeof data.toJs === "function") {
                        jsData = data.toJs({ dict_converter: Object.fromEntries });
                        if (typeof data.destroy === "function") {
                            data.destroy();
                        }
                        // Ensure all nested Maps are converted to objects
                        jsData = mapToObject(jsData);
                    } else {
                        jsData = data;
                    }
                    render(jsData);
                });

            } catch (error) {
                console.error('Failed to load Pyodide:', error);
            } finally {
                setIsPyodideLoading(false);
            }
        };
        initPyodide();
    }, []);

    const updateGlobalEnvironment = () => {
        if (!pyodide.current) return;

        const allInstances = instances.reduce<Record<string, Instance>>((acc, instance) => {
            acc[instance.id] = instance;
            return acc;
        }, {});
        const currentIds = Object.keys(allInstances);
        setInstanceIds(currentIds);

        prevInstanceIds.forEach(id => {
            if (!allInstances[id] && pyodide.current.globals.has(id)) {
                pyodide.current.globals.delete(id);
            }
        });

        Object.entries(allInstances).forEach(([id, instance]) => {
            pyodide.current.globals.set(id, pyodide.current.toPy(instance));
        });

        setPrevInstanceIds(currentIds);
    };

    const instanceCompletions = useMemo(() => {
        return (context: CompletionContext): CompletionResult | null => {
            const word = context.matchBefore(/\w*/);
            if (!word || (word.from === word.to && !context.explicit)) return null;

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

    const customCompletions = useMemo(() => {
        return [
            python(),
            autocompletion({
                override: [instanceCompletions]
            })
        ];
    }, [instanceCompletions]);

    const executeCell = async (cellId: number) => {
        setCells(prev => prev.map(cell =>
            cell.id === cellId ? { ...cell, isExecuting: true, outputs: [] } : cell
        ));

        const cell = cells.find(c => c.id === cellId);
        if (!cell || !pyodide.current) {
            setCells(prev => prev.map(c =>
                c.id === cellId ? { ...c, isExecuting: false } : c
            ));
            return;
        }

        const capturedOutputs: CodeOutput[] = [];
        const timestamp = new Date();

        try {
            pyodide.current.setStdout({
                batched: (msg: string) => {
                    capturedOutputs.push({ type: 'stdout', content: msg, timestamp: new Date() });
                },
            });
            pyodide.current.setStderr({
                batched: (msg: string) => {
                    capturedOutputs.push({ type: 'stderr', content: msg, timestamp: new Date() });
                },
            });

            updateGlobalEnvironment();

            const result = await pyodide.current.runPythonAsync(cell.content);

            if (result !== undefined) {
                capturedOutputs.push({
                    type: 'stdout',
                    content: `=> ${result}`,
                    timestamp: new Date(),
                });
            }
        } catch (err) {
            capturedOutputs.push({
                type: 'error',
                content: (err as Error).message,
                timestamp,
            });
        } finally {
            pyodide.current.setStdout({});
            pyodide.current.setStderr({});

            setCells(prev => prev.map(c =>
                c.id === cellId ? { ...c, outputs: capturedOutputs, isExecuting: false } : c
            ));
        }
    };

    const addCell = () => {
        setCells(prev => [
            ...prev,
            { id: prev.length, content: '', outputs: [], isExecuting: false }
        ]);
    };

    const removeCell = (cellId: number) => {
        setCells(prev => prev.filter(cell => cell.id !== cellId));
    };

    return (
        <div className="code-editor-container">
            {cells.map((cell) => (
                <div key={cell.id} className="code-cell">
                    <div className="code-toolbar">
                        <button
                            className="run-button"
                            onClick={() => executeCell(cell.id)}
                            disabled={cell.isExecuting || isPyodideLoading}
                        >
                            {isPyodideLoading ? 'Loading...' : cell.isExecuting ? 'Running...' : '▶ Run'}
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
                        onChange={(value) => setCells(prev =>
                            prev.map(c => c.id === cell.id ? { ...c, content: value } : c)
                        )}
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
                                className={`output-item ${output.type}`}
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
    );
};

export default CodeTab;