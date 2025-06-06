import React from 'react';
import './operationview.css';

interface OperationViewProps {
  logs: string[];
}

const OperationView = ({ logs }: OperationViewProps) => {
  const parseLog = (log: string) => {
    const elements = [];
    let currentPosition = 0;
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;

    while ((match = linkRegex.exec(log)) !== null) {
      // Add text before the link
      const textBefore = log.substring(currentPosition, match.index);
      if (textBefore.trim()) {
        elements.push(<span key={elements.length}>{textBefore}</span>);
      }

      // Add the link
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
          {linkText}
        </a>
      );

      // Move position to end of current match
      currentPosition = linkRegex.lastIndex;
    }

    // Add remaining text after last link
    const remainingText = log.substring(currentPosition);
    if (remainingText.trim()) {
      elements.push(<span key={elements.length}>{remainingText}</span>);
    }

    return <span>{elements}</span>;
  };

  return (
    <div className="view-container operation-view">
      <h3 className="view-title-container">Operations</h3>
      <div className="view-content">
        {logs.length > 0 ? (
          logs.map((log, index) => (
            <div key={index} className="operation-log">
              {parseLog(log)}
            </div>
          ))
        ) : (
          <p>No operations yet.</p>
        )}
      </div>
    </div>
  );
};

export default OperationView;