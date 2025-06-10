// TextEditor.tsx
import React, { useState } from 'react';

interface TextEditorProps {
  editingTextContent: string;
  onSave: (content: string) => void;
  onCancel: () => void;
}

const TextEditor: React.FC<TextEditorProps> = ({
  editingTextContent,
  onSave,
  onCancel
}) => {
  const [content, setContent] = useState(editingTextContent);

  return (
    <>
      <div className="view-title-container">
        <h3 style={{ margin: 0 }}>Edit Text</h3>
        <button onClick={() => onSave(content)}>Save</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
      <div className="view-content">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          style={{ width: '100%', height: '100%' }}
          autoFocus
        />
      </div>
    </>
  );
};

export default TextEditor;