import React from 'react';

interface InstanceViewHeaderProps {
  webToolsOpen: boolean;
  setWebToolsOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
  instanceToolsOpen: boolean;
  setInstanceToolsOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
  isCaptureEnabled: boolean;
  mode: string;
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
  handleCaptureStart,
  handleScreenshotStart,
  handleCreateSketch,
  handleCreateTable,
  handleCreateVisualization,
  handleModeSwitch,
}) => {
  return (
    <div className="view-title-container">
      <h3 style={{ margin: 0 }}>Instances</h3>
      
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
        {mode === 'select' ? 'Selection Mode' : 'Hand Tool'}
      </button>
    </div>
  );
};

export default InstanceViewHeader;