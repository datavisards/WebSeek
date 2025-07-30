// TextEditor.tsx
import React, { useState } from 'react';
import { ProactiveSuggestion } from '../types';
import GhostInstance from './GhostInstance';

interface TextEditorProps {
  editingTextContent: string;
  onSave: (content: string) => void;
  onCancel: () => void;
  currentSuggestion?: ProactiveSuggestion;
}

const TextEditor: React.FC<TextEditorProps> = ({
  editingTextContent,
  onSave,
  onCancel,
  currentSuggestion
}) => {
  const [content, setContent] = useState(editingTextContent);

  return (
    <>
      <div className="view-title-container">
        <h3 style={{ margin: 0 }}>Edit Text</h3>
        <button onClick={() => onSave(content)}>Save</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
      <div className="view-content" style={{ position: 'relative' }}>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          style={{ width: '100%', height: '100%' }}
          autoFocus
        />
        
        {/* Render ghost instances for proactive suggestions */}
        {currentSuggestion && currentSuggestion.instances.map((instanceEvent, index) => (
          <div key={`ghost-${index}`} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1000, pointerEvents: 'none' }}>
            <GhostInstance
              instanceEvent={instanceEvent}
              existingInstances={[]}
            />
          </div>
        ))}
      </div>
    </>
  )
}

export default TextEditor;