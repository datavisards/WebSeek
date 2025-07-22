import React, { useState, useRef, useEffect } from 'react';
import { parseLogWithAgent } from "../apis_old";
import './operationview.css';

interface ParsedSummary {
  indices: number[];
  summary: string;
  results: any[];
}

interface OperationViewProps {
  logs: string[];
  htmlContexts: Record<string, string>;
}

const OperationView: React.FC<OperationViewProps> = ({ logs, htmlContexts }) => {
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<number | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [parsedSummaries, setParsedSummaries] = useState<ParsedSummary[]>([]);
  const [collapsedSummaries, setCollapsedSummaries] = useState<string[]>([]); // Changed to string[] for summary IDs
  const [rejectedIndices, setRejectedIndices] = useState<number[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);

  const selectedIndices = (() => {
    if (selectionStart === null || selectionEnd === null) return [];

    const start = Math.min(selectionStart, selectionEnd);
    const end = Math.max(selectionStart, selectionEnd);
    const newIndices = Array.from({ length: end - start + 1 }, (_, i) => start + i);

    const isOverlapping = parsedSummaries.some(({ indices }) =>
      newIndices.some(i => indices.includes(i))
    );

    if (isOverlapping) return [];

    return newIndices;
  })();

  const isParsed = (index: number): boolean => {
    return parsedSummaries.some(({ indices }) => indices.includes(index));
  };

  const isRejected = (index: number): boolean => {
    return rejectedIndices.includes(index);
  };

  const isSelectable = (index: number): boolean => {
    return !isParsed(index) || isRejected(index);
  };

  const handleMouseDown = (index: number) => {
    if (!isSelectable(index)) return;
    setSelectionStart(index);
    setSelectionEnd(index);
    setIsSelecting(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isSelecting || !containerRef.current) return;

    const elements = document.elementsFromPoint(e.clientX, e.clientY);
    const logElement = elements.find(el => el.hasAttribute('data-index'));

    if (logElement) {
      const dataIndex = logElement.getAttribute('data-index');
      if (dataIndex !== null) {
        const index = parseInt(dataIndex, 10);
        if (isSelectable(index)) {
          setSelectionEnd(index);
        }
      }
    }
  };

  const handleMouseUp = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (isSelecting) {
      setTimeout(() => {
        setIsSelecting(false);
      }, 100);
    }
  };

  const handleMouseLeave = () => {
    if (isSelecting) {
      setIsSelecting(false);
    }
  };

  const handleParse = async () => {
    if (selectedIndices.length === 0) return;

    const selectedLogs = selectedIndices.map(i => logs[i]);
    const res = await parseLogWithAgent(
      selectedLogs,
      "",  // instanceContexts 
      [],  // imageContexts
      htmlContexts,
      null, // currentInstanceId
      parsedSummaries.map(s => s.summary)  // use summary instead of code
    );

    setParsedSummaries([
      ...parsedSummaries,
      { indices: selectedIndices, summary: res.summary, results: res.results }
    ]);
    
    // Reset collapse state for the new summary
    const newSummaryId = selectedIndices.join('-');
    setCollapsedSummaries(prev => prev.filter(id => id !== newSummaryId));

    setSelectionStart(null);
    setSelectionEnd(null);
  };

  const handleReject = (indexInParsedSummaries: number) => {
    const rejectedSummary = parsedSummaries[indexInParsedSummaries];
    const summaryId = rejectedSummary.indices.join('-');
    
    setParsedSummaries(
      parsedSummaries.filter((_, idx) => idx !== indexInParsedSummaries)
    );
    setRejectedIndices([...rejectedIndices, ...rejectedSummary.indices]);
    setCollapsedSummaries(prev => prev.filter(id => id !== summaryId));
  };

  const handleRerun = async (indexInParsedSummaries: number) => {
    const existingSummary = parsedSummaries[indexInParsedSummaries];
    const existingId = existingSummary.indices.join('-');
    
    // Remove existing summary
    const updatedSummaries = parsedSummaries.filter(
      (_, idx) => idx !== indexInParsedSummaries
    );
    setParsedSummaries(updatedSummaries);
    
    // Clear collapse state
    setCollapsedSummaries(prev => prev.filter(id => id !== existingId));
    
    // Re-parse with same indices
    const selectedLogs = existingSummary.indices.map(i => logs[i]);
    const res = await parseLogWithAgent(
      selectedLogs,
      "",  // instanceContexts 
      [],  // imageContexts
      htmlContexts,
      null, // currentInstanceId
      updatedSummaries.map(s => s.summary)
    );

    // Add new summary
    const newSummary = {
      indices: existingSummary.indices,
      summary: res.summary,
      results: res.results
    };
    setParsedSummaries([...updatedSummaries, newSummary]);

    // Unfold by default
    const newId = newSummary.indices.join('-');
    setCollapsedSummaries(prev => prev.filter(id => id !== newId));
  };

  const toggleSummaryCollapse = (id: string) => {
    if (collapsedSummaries.includes(id)) {
      setCollapsedSummaries(collapsedSummaries.filter(i => i !== id));
    } else {
      setCollapsedSummaries([...collapsedSummaries, id]);
    }
  };

  const parseLog = (log: string) => {
    const elements = [];
    let currentPosition = 0;
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;

    while ((match = linkRegex.exec(log)) !== null) {
      const textBefore = log.substring(currentPosition, match.index);
      if (textBefore.trim()) {
        elements.push(<span key={elements.length}>{textBefore}</span>);
      }

      const linkText = match[1];
      const url = match[2];
      elements.push(
        <a
          key={elements.length}
          href={url}
          className="operation-link"
          target={url.startsWith('http') ? '_blank' : undefined}
          rel={url.startsWith('http') ? 'noopener noreferrer' : undefined}
        >
          {linkText.length > 10 ? `${linkText.substring(0, 10)}...` : linkText}
        </a>
      );

      currentPosition = linkRegex.lastIndex;
    }

    const remainingText = log.substring(currentPosition);
    if (remainingText.trim()) {
      elements.push(<span key={elements.length}>{remainingText}</span>);
    }

    return <span>{elements}</span>;
  };

  const handleExportCode = () => {
    // Map the parsed summaries to their code content, and add the log as comment before each code block
    const codeContent = parsedSummaries.map(s => {
      const logSnippet = s.indices.map(i => logs[i]).join('\n');
      return `# Log Snippet: ${logSnippet}\n\n${s.summary}`;
    }
    ).join('\n\n');

    const blob = new Blob([codeContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'exported_code.py';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (isSelecting) {
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.userSelect = '';
    }
  }, [isSelecting]);

  return (
    <div className="view-container operation-view">
      <div className="view-title-container">
        <h3 style={{ margin: 0 }}>Operations</h3>
        <button disabled={selectedIndices.length == 0} onClick={handleParse}>
          Infer
        </button>
        <button disabled={parsedSummaries.length === 0} onClick={() => {handleExportCode()}}>
          Export Code
        </button>
      </div>
      <div
        className="view-content"
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onClick={(e) => {
          if (isSelecting) return;
          const target = e.target as HTMLElement;
          if (!target.closest('[data-index]')) {
            setSelectionStart(null);
            setSelectionEnd(null);
          }
        }}
      >
        {logs.length > 0 ? (
          <>
            {logs.map((log, index) => {
              const isCurrentlySelected = selectedIndices.includes(index);
              const isCurrentlyParsed = parsedSummaries.some(s => s.indices.includes(index));
              const isCurrentlyRejected = isRejected(index);

              return (
                <React.Fragment key={index}>
                  <div
                    data-index={index}
                    className={`operation-log
                      ${isCurrentlySelected ? 'selected' : ''}
                      ${isCurrentlyParsed && !isCurrentlyRejected ? 'parsed' : ''}
                      ${isCurrentlyRejected ? 'rejected' : ''}
                    `}
                    onMouseDown={() => handleMouseDown(index)}
                  >
                    {parseLog(log)}
                  </div>

                  {parsedSummaries.map((summary, i) => {
                    const summaryId = summary.indices.join('-');
                    const isCollapsed = collapsedSummaries.includes(summaryId);
                    if (summary.indices[summary.indices.length - 1] === index) {
                      return (
                        <div className="parsed-summary" key={`summary-${i}`}>
                          <div className="parsed-summary-header" onClick={() => toggleSummaryCollapse(summaryId)}>
                            <div className="collapse-toggle">
                              {isCollapsed ? '▼' : '▶'}
                            </div>
                            <h4 style={{ margin: 0 }}>Agent</h4>
                          </div>
                          {!isCollapsed && (
                            <>
                              <p>{summary.summary}</p>
                              <button onClick={() => handleReject(i)}>Reject</button>
                              <button onClick={() => handleRerun(i)}>Rerun</button>
                            </>
                          )}
                        </div>
                      );
                    }
                    return null;
                  })}
                </React.Fragment>
              );
            })}
          </>
        ) : (
          <p>No operations yet.</p>
        )}
      </div>
    </div>
  );
};

export default OperationView;