// historytab.tsx
import React, { useMemo, ReactElement } from 'react';
import './historytab.css';

interface HistoryEntry {
  timestamp: Date;
  action: string;
  index: number;
}

interface HistoryTabProps {
  logs: string[];
  onRestoreToCheckpoint?: (logIndex: number) => void;
}

const HistoryTab: React.FC<HistoryTabProps> = ({ 
  logs = [], 
  onRestoreToCheckpoint 
}) => {
  // Convert logs to history entries with timestamps (latest first)
  const historyEntries = useMemo((): HistoryEntry[] => {
    return logs
      .map((log, index) => ({
        timestamp: new Date(Date.now() - (logs.length - index - 1) * 1000), // Mock timestamps
        action: log,
        index: index
      }))
      .reverse(); // Show latest first
  }, [logs]);

  const handleRestoreClick = (logIndex: number) => {
    const confirmMessage = `Are you sure you want to restore the system to this checkpoint?\n\nThis will revert all changes made after: "${logs[logIndex]}"\n\nThis action cannot be undone.`;
    
    if (window.confirm(confirmMessage)) {
      onRestoreToCheckpoint?.(logIndex);
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatAction = (action: string) => {
    // Clean up action text for better display
    if (action.length > 60) {
      return action.substring(0, 60) + '...';
    }
    return action;
  };

  const renderActionWithLinks = (action: string) => {
    // Regex to match markdown-style links: [text](url)
    const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    
    // Check if the action contains markdown links
    if (!markdownLinkRegex.test(action)) {
      // No links found, return formatted text as is
      return <span>{formatAction(action)}</span>;
    }
    
    // Reset regex lastIndex for reuse
    markdownLinkRegex.lastIndex = 0;
    
    const elements: (string | ReactElement)[] = [];
    let lastIndex = 0;
    let match;
    
    // Process the formatted action text
    const formattedAction = formatAction(action);
    
    while ((match = markdownLinkRegex.exec(formattedAction)) !== null) {
      const [fullMatch, linkText, url] = match;
      const matchStart = match.index!;
      
      // Add text before the link
      if (matchStart > lastIndex) {
        elements.push(formattedAction.substring(lastIndex, matchStart));
      }
      
      // Add the link element
      elements.push(
        <a 
          key={`link-${matchStart}`}
          href={url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="history-link"
          onClick={(e) => e.stopPropagation()}
        >
          {linkText}
        </a>
      );
      
      lastIndex = matchStart + fullMatch.length;
    }
    
    // Add any remaining text after the last link
    if (lastIndex < formattedAction.length) {
      elements.push(formattedAction.substring(lastIndex));
    }
    
    return <span>{elements}</span>;
  };

  return (
    <div className="history-tab">
      <div className="history-list">
        {historyEntries.length === 0 ? (
          <div className="history-empty-state">
            <div className="history-empty-icon">📜</div>
            <div className="history-empty-text">
              <p>No interaction history yet</p>
              <small>Actions will appear here as you use the system</small>
            </div>
          </div>
        ) : (
          historyEntries.map((entry, displayIndex) => (
            <div 
              key={`${entry.index}-${displayIndex}`}
              className="history-card"
            >
              <div className="history-card-content">
                <span className="history-index">#{logs.length - displayIndex}</span>
                <span className="history-action">
                  {renderActionWithLinks(entry.action)}
                </span>
                {/* Only show restore button for non-latest items */}
                {displayIndex > 0 && (
                  <button 
                    className="restore-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRestoreClick(entry.index);
                    }}
                    disabled={!onRestoreToCheckpoint}
                    title="Restore to this checkpoint"
                  >
                    ↶
                  </button>
                )}
                <span className="history-timestamp">
                  {formatTimestamp(entry.timestamp)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default HistoryTab;
