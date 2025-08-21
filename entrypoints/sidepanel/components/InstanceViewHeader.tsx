import React, { useState } from 'react';

interface InstanceViewHeaderProps {
  webToolsOpen: boolean;
  setWebToolsOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
  instanceToolsOpen: boolean;
  setInstanceToolsOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
  isCaptureEnabled: boolean;
  mode: string;
  workspaceName: string;
  onWorkspaceNameChange: (newName: string) => void;
  handleCaptureStart: () => void;
  handleScreenshotStart: () => void;
  handleCreateSketch: () => void;
  handleCreateTable: () => void;
  handleCreateVisualization: () => void;
  handleModeSwitch: (newMode: 'hand' | 'select') => void;
}

const InstanceViewHeader: React.FC<InstanceViewHeaderProps> = ({
  webToolsOpen,
  setWebToolsOpen,
  instanceToolsOpen,
  setInstanceToolsOpen,
  isCaptureEnabled,
  mode,
  workspaceName,
  onWorkspaceNameChange,
  handleCaptureStart,
  handleScreenshotStart,
  handleCreateSketch,
  handleCreateTable,
  handleCreateVisualization,
  handleModeSwitch,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editingName, setEditingName] = useState(workspaceName);

  const handleStartEdit = () => {
    setEditingName(workspaceName);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    const trimmedName = editingName.trim();
    if (trimmedName && trimmedName !== workspaceName) {
      onWorkspaceNameChange(trimmedName);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditingName(workspaceName);
    setIsEditing(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const displayName = workspaceName || 'Instance View';

  return (
    <div className="view-title-container" style={{ paddingRight: '50px' }}>
      {isEditing ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="text"
            value={editingName}
            onChange={(e) => setEditingName(e.target.value.slice(0, 30))}
            onKeyDown={handleKeyPress}
            onBlur={handleSaveEdit}
            autoFocus
            style={{
              fontSize: '1.17em',
              fontWeight: 'bold',
              border: '1px solid #ccc',
              borderRadius: '4px',
              padding: '2px 6px',
              margin: 0,
              minWidth: '150px',
              maxWidth: '300px'
            }}
            placeholder="Workspace name (max 30 chars)"
          />
          <span style={{ fontSize: '0.8em', color: '#666' }}>
            {editingName.length}/30
          </span>
        </div>
      ) : (
        <h3 
          style={{ 
            margin: 0, 
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
          onClick={handleStartEdit}
          title="Click to rename workspace"
        >
          {displayName}
        </h3>
      )}
      
      {/* Web Tools Dropdown */}
      <div style={{ display: 'inline-block', position: 'relative' }}>
        <button
          onClick={e => {
            e.stopPropagation();
            e.preventDefault();
            setWebToolsOpen(v => !v);
          }}
          disabled={!isCaptureEnabled}
          style={{ minWidth: 90 }}
        >
          Web Tools ▾
        </button>
        {webToolsOpen && (
          <div
            style={{
              position: 'absolute',
              top: '110%',
              left: 0,
              background: 'white',
              border: '1px solid #ddd',
              borderRadius: '4px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
              zIndex: 1000,
              minWidth: '120px',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div
              className="contextmenuoption"
              onClick={() => {
                handleCaptureStart();
                setWebToolsOpen(false);
              }}
              style={{ color: isCaptureEnabled ? undefined : '#ccc', pointerEvents: isCaptureEnabled ? 'auto' : 'none' }}
            >
              Capture
            </div>
            <div
              className="contextmenuoption"
              onClick={() => {
                handleScreenshotStart();
                setWebToolsOpen(false);
              }}
              style={{ color: isCaptureEnabled ? undefined : '#ccc', pointerEvents: isCaptureEnabled ? 'auto' : 'none' }}
            >
              Screenshot
            </div>
          </div>
        )}
      </div>
      
      {/* Instance Tools Dropdown */}
      <div style={{ display: 'inline-block', position: 'relative' }}>
        <button
          onClick={e => {
            e.stopPropagation();
            e.preventDefault();
            setInstanceToolsOpen(v => !v);
          }}
          style={{ minWidth: 110 }}
        >
          Instance Tools ▾
        </button>
        {instanceToolsOpen && (
          <div
            style={{
              position: 'absolute',
              top: '110%',
              left: 0,
              background: 'white',
              border: '1px solid #ddd',
              borderRadius: '4px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
              zIndex: 1000,
              minWidth: '140px',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div
              className="contextmenuoption"
              onClick={() => {
                handleCreateSketch();
                setInstanceToolsOpen(false);
              }}
            >
              Sketch
            </div>
            <div
              className="contextmenuoption"
              onClick={() => {
                handleCreateTable();
                setInstanceToolsOpen(false);
              }}
            >
              Table
            </div>
            <div
              className="contextmenuoption"
              onClick={() => {
                handleCreateVisualization();
                setInstanceToolsOpen(false);
              }}
            >
              Visualization
            </div>
          </div>
        )}
      </div>
      
      <button
        onClick={() => handleModeSwitch(mode === 'hand' ? 'select' : 'hand')}
        style={{
          background: mode === 'select' ? '#0078ff' : undefined,
          color: mode === 'select' ? 'white' : undefined,
          borderRadius: 4,
          marginLeft: 12
        }}
        title={mode === 'select' ? 'Switch to Hand Tool' : 'Switch to Selection Tool'}
      >
        {mode === 'select' ? 'Select' : 'Hand'}
      </button>
    </div>
  );
};

export default InstanceViewHeader;