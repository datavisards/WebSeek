// visualizationeditor.tsx
import React, { useState, useEffect } from 'react';
import VisualizationRenderer from './visualizationrenderer';
import { Instance, ProactiveSuggestion } from '../types';
import GhostInstance from './GhostInstance';
import './visualizationeditor.css'; // Import the new CSS file

interface VisualizationEditorProps {
  initialSpec: object | string;
  onSave: (spec: object, imageUrl: string) => void;
  onCancel: () => void;
  availableInstances: Instance[];
  currentSuggestion?: ProactiveSuggestion;
}

const VisualizationEditor: React.FC<VisualizationEditorProps> = ({
  initialSpec,
  onSave,
  onCancel,
  availableInstances,
  currentSuggestion,
}) => {
  const [spec, setSpec] = useState(
    typeof initialSpec === 'string'
      ? initialSpec
      : JSON.stringify(initialSpec, null, 2)
  );
  const [parsedSpec, setParsedSpec] = useState<object | null>(null);
  const [importedData, setImportedData] = useState<any | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // Validate the spec whenever it changes and update the parsedSpec state.
  useEffect(() => {
    try {
      const parsed = JSON.parse(spec);
      setParsedSpec(parsed); // Store the valid object
      setParseError(null);
    } catch (error: any) {
      setParsedSpec(null); // Clear the object on error
      setParseError(error.message);
    }
  }, [spec]);

  const handleImportData = (instance: Instance) => {
    // ... (logic is unchanged, but included for completeness)
    if (instance.type === 'table') {
      const data: any[] = [];
      for (let i = 0; i < instance.rows; i++) {
        const row: any = {};
        for (let j = 0; j < instance.cols; j++) {
          const cell = instance.cells[i][j];
          row[`col${j + 1}`] =
            cell && cell.type === 'text' ? cell.content : null;
        }
        data.push(row);
      }
      setImportedData(data);
    } else if (instance.type === 'text') {
      setImportedData([{ value: instance.content }]);
    } else if (instance.type === 'image') {
      setImportedData([{ src: instance.src }]);
    }
  };

  const handleInsertData = () => {
    if (!importedData || !parsedSpec) return;
    const newSpec = { ...parsedSpec, data: { values: importedData } };
    setSpec(JSON.stringify(newSpec, null, 2));
  };

  const handleSave = () => {
    if (parseError || !imageUrl) return;
    // Try to pass a parsed object, fall back to string if needed
    try {
      onSave(JSON.parse(spec), imageUrl);
    } catch {
      // onSave(spec, imageUrl);
      console.error('Error saving visualization:', spec);
    }
  };

  const handleImageUrlReady = (url: string) => {
    console.log('Image URL ready:', url);
    setImageUrl(url);
  };

  return (
    <div className="view-container" style={{ position: 'relative' }}>
      <div className="view-title-container">
        <h3 style={{ margin: 0 }}>Edit Visualization (Vega-Lite)</h3>
        <div className="vis-editor-actions">
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!!parseError}
          >
            Save
          </button>
        </div>
      </div>

      <main className="vis-editor-main">
        {/* Left Panel: Editor and Data Controls */}
        <div className="vis-editor-panel">
          <div className="vis-editor-code-area">
            <label htmlFor="spec-textarea" className="vis-editor-label">Vega-Lite JSON Spec</label>
            <textarea
              id="spec-textarea"
              value={spec}
              onChange={(e) => setSpec(e.target.value)}
              className={`vis-editor-textarea ${parseError ? 'is-invalid' : ''}`}
              autoFocus
            />
            {parseError && (
              <div className="vis-editor-error">Invalid JSON: {parseError}</div>
            )}
          </div>

          <section className="vis-editor-data-importer">
            <h4 className="vis-editor-label">Import Data from Instance</h4>
            <div className="vis-editor-instance-list">
              {availableInstances.length === 0 ? (
                <span className="vis-editor-no-instances">No available instances to import from.</span>
              ) : (
                availableInstances.map((inst) => (
                  <button
                    key={inst.id}
                    className="btn btn-tertiary"
                    onClick={() => handleImportData(inst)}
                  >
                    {inst.type}: {inst.id}
                  </button>
                ))
              )}
            </div>
            {importedData && (
              <div className="vis-editor-data-preview">
                <p>Data imported. Press "Insert" to add to spec.</p>
                <pre>
                  <code>{JSON.stringify(importedData, null, 2)}</code>
                </pre>
                <button
                  className="btn btn-secondary"
                  onClick={handleInsertData}
                  disabled={!!parseError}
                >
                  Insert as data.values
                </button>
              </div>
            )}
          </section>
        </div>

        {/* Right Panel: Visualization Preview */}
        <div className="vis-editor-preview-panel">
           <h4 className="vis-editor-label">Live Preview</h4>
           <div className="vis-editor-renderer-wrapper">
             {parsedSpec ? (
               <VisualizationRenderer spec={parsedSpec} onImageUrlReady={handleImageUrlReady}/>
             ) : (
               <div style={{ padding: '1rem', color: '#777' }}>
                 Enter valid Vega-Lite JSON to see a live preview.
               </div>
             )}
           </div>
        </div>
      </main>
      
      {/* Render ghost instances for proactive suggestions */}
      {currentSuggestion && currentSuggestion.instances.map((instanceEvent, index) => (
        <div key={`ghost-${index}`} style={{ position: 'absolute', top: '50%', left: '60%', transform: 'translate(-50%, -50%)', zIndex: 1000, pointerEvents: 'none' }}>
          <GhostInstance
            instanceEvent={instanceEvent}
            existingInstances={availableInstances}
          />
        </div>
      ))}
    </div>
  );
};

export default VisualizationEditor;