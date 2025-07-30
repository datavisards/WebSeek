import React from 'react';
import { Instance, InstanceEvent, EmbeddedInstance } from '../types';
import { areInstancesContentEqual } from '../utils';
import './InlineSuggestion.css';

// Helper function to create a simple diff between two text strings
const createTextDiff = (oldText: string, newText: string) => {
  const oldWords = oldText.split(/(\s+)/);
  const newWords = newText.split(/(\s+)/);
  
  // Simple word-level diff - could be enhanced with a proper diff algorithm
  const maxLength = Math.max(oldWords.length, newWords.length);
  const diffs = [];
  
  for (let i = 0; i < maxLength; i++) {
    const oldWord = oldWords[i] || '';
    const newWord = newWords[i] || '';
    
    if (oldWord !== newWord) {
      if (oldWord && newWord) {
        // Changed word
        diffs.push({ type: 'changed', old: oldWord, new: newWord });
      } else if (oldWord) {
        // Deleted word
        diffs.push({ type: 'deleted', old: oldWord });
      } else if (newWord) {
        // Added word
        diffs.push({ type: 'added', new: newWord });
      }
    } else if (oldWord) {
      // Unchanged word
      diffs.push({ type: 'unchanged', text: oldWord });
    }
  }
  
  return diffs;
};

interface InlineSuggestionProps {
  instanceEvent: InstanceEvent;
  existingContent?: Instance | null;
  onAccept: () => void;
  onDismiss: () => void;
}

// Helper function to render instance content properly
const renderInstanceContent = (instance: Instance) => {
  switch (instance.type) {
    case 'text':
      return (
        <p className="cell-text" style={{ margin: 0, fontSize: '12px' }}>
          {instance.content}
        </p>
      );
    case 'image':
      return (
        <img
          src={instance.src}
          alt="content"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            pointerEvents: 'none',
          }}
        />
      );
    case 'sketch':
      return instance.thumbnail ? (
        <img
          src={instance.thumbnail}
          alt="sketch"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            pointerEvents: 'none',
          }}
        />
      ) : (
        <div className="sketch-thumb-icon">✏️</div>
      );
    case 'table':
      const tableInstance = instance as any;
      return (
        <div className="table-thumbnail" style={{ fontSize: '10px', padding: '2px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gridTemplateRows: 'repeat(2, 1fr)', gap: '1px', height: '100%' }}>
            {Array(4).fill(0).map((_, i) => (
              <div key={i} style={{ border: '1px solid #ccc', backgroundColor: '#f9f9f9' }}></div>
            ))}
          </div>
        </div>
      );
    case 'visualization':
      return instance.thumbnail ? (
        <img
          src={instance.thumbnail}
          alt="visualization"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            pointerEvents: 'none',
          }}
        />
      ) : (
        <div className="viz-thumb-icon">📊</div>
      );
    default:
      return <div>Unknown content</div>;
  }
};

const InlineSuggestion: React.FC<InlineSuggestionProps> = ({
  instanceEvent,
  existingContent,
  onAccept,
  onDismiss
}) => {
  const { action, instance } = instanceEvent;

  // Don't render suggestion if content is actually the same (ignoring source differences)
  if (action === 'update' && existingContent && instance && 
      areInstancesContentEqual(existingContent, instance)) {
    return null;
  }

  const renderSuggestionContent = () => {
    if (action === 'remove') {
      if (!existingContent) return null;
      
      return (
        <>
          <div className={`suggestion-content ${action}`}>
            {renderInstanceContent(existingContent)}
          </div>
          <div className={`suggestion-mark ${action}`}>×</div>
          <div className="suggestion-controls">
            <kbd>Tab</kbd> accept • <kbd>Esc</kbd> dismiss
          </div>
        </>
      );
    }

    if (!instance) return null;

    if (action === 'update' && existingContent) {
      // Show diff for updates - enhanced for text content
      if (existingContent.type === 'text' && instance.type === 'text') {
        const oldText = existingContent.content || '';
        const newText = instance.content || '';
        const diffs = createTextDiff(oldText, newText);
        
        return (
          <>
            <div className="suggestion-text-diff">
              {diffs.map((diff, index) => {
                switch (diff.type) {
                  case 'unchanged':
                    return <span key={index} className="diff-unchanged">{diff.text}</span>;
                  case 'deleted':
                    return <span key={index} className="diff-deleted">{diff.old}</span>;
                  case 'added':
                    return <span key={index} className="diff-added">{diff.new}</span>;
                  case 'changed':
                    return (
                      <span key={index} className="diff-changed">
                        <span className="diff-deleted">{diff.old}</span>
                        <span className="diff-added">{diff.new}</span>
                      </span>
                    );
                  default:
                    return null;
                }
              })}
            </div>
            <div className={`suggestion-mark ${action}`}>↻</div>
            <div className="suggestion-controls">
              <kbd>Tab</kbd> accept • <kbd>Esc</kbd> dismiss
            </div>
          </>
        );
      } else {
        // Non-text content - show side by side
        return (
          <>
            <div className="suggestion-diff">
              <div className="suggestion-old">
                {renderInstanceContent(existingContent)}
              </div>
              <div className="suggestion-new">
                {renderInstanceContent(instance)}
              </div>
            </div>
            <div className={`suggestion-mark ${action}`}>↻</div>
            <div className="suggestion-controls">
              <kbd>Tab</kbd> accept • <kbd>Esc</kbd> dismiss
            </div>
          </>
        );
      }
    }

    if (action === 'add') {
      return (
        <>
          <div className={`suggestion-content ${action}`}>
            {renderInstanceContent(instance)}
          </div>
          <div className="suggestion-controls">
            <kbd>Tab</kbd> accept • <kbd>Esc</kbd> dismiss
          </div>
        </>
      );
    }

    return null;
  };

  return (
    <div className={`suggestion-cell ${action}`}>
      {renderSuggestionContent()}
    </div>
  );
};

export default InlineSuggestion;