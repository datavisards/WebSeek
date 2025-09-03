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
  selectedInstanceIds: string[];
  selectedInstanceId: string | null;
  handleInfer: (instanceIds: string[]) => void;
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
  selectedInstanceIds,
  selectedInstanceId,
  handleInfer,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editingName, setEditingName] = useState(workspaceName);

  // Determine what instances are selected
  const getSelectedInstanceIds = (): string[] => {
    if (mode === 'select' && selectedInstanceIds.length > 0) {
      // In select mode, use multiple selection
      return selectedInstanceIds;
    } else if (mode === 'hand' && selectedInstanceId) {
      // In hand mode, use single selection
      return [selectedInstanceId];
    }
    return [];
  };

  const currentSelection = getSelectedInstanceIds();

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
      {/* <div style={{ display: 'inline-block', position: 'relative' }}>
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
      </div> */}

      {/* <button
        onClick={() => handleCaptureStart()}
        style={{
          borderRadius: 4,
          marginLeft: 12,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
        disabled={!isCaptureEnabled}
      >
        <img 
          src="/icon/capture.svg" 
          alt="Capture" 
          style={{ 
            width: '12px', 
            height: '12px',
            opacity: isCaptureEnabled ? 1 : 0.5
          }} 
        />
        Capture
      </button> */}

      {/* Instance Tools Dropdown */}
      <button
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
        onClick={() => {
          handleCreateTable();
          setInstanceToolsOpen(false);
        }}
      >
        Table
      </button>
      <button
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
        onClick={() => {
          handleCreateVisualization();
          setInstanceToolsOpen(false);
        }}
      >
        Visualization
      </button>

      {/* <button
        onClick={() => handleModeSwitch(mode === 'hand' ? 'select' : 'hand')}
        style={{
          background: mode === 'select' ? '#0078ff' : undefined,
          color: mode === 'select' ? 'white' : undefined,
          borderRadius: 4,
          marginLeft: 12,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
        title={mode === 'select' ? 'Switch to Hand Tool' : 'Switch to Selection Tool'}
      >
        <img
          src={mode === 'select' ? '/icon/select.svg' : '/icon/hand.svg'}
          alt={mode === 'select' ? 'Select' : 'Hand'}
          style={{
            width: '12px',
            height: '12px',
            filter: mode === 'select' ? 'invert(1)' : undefined
          }}
        />
        {mode === 'select' ? 'Select' : 'Hand'}
      </button> */}

      {/* Infer Button - only visible when instances are selected */}
      {/* {currentSelection.length > 0 && (
        <button
          onClick={() => handleInfer(currentSelection)}
          style={{
            color: 'white',
            borderRadius: 4,
            marginLeft: 12,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
          title={`Infer ${currentSelection.length} selected instance${currentSelection.length === 1 ? '' : 's'}`}
        >
          <img
            src="/icon/robot.svg"
            alt="Infer"
            style={{
              width: '12px',
              height: '12px',
            }}
          />
          Infer
        </button>
      )} */}
    </div>
  );
};

export default InstanceViewHeader;