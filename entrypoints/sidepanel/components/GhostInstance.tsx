import React from 'react';
import { Instance, InstanceEvent, SketchInstance, VisualizationInstance } from '../types';
import { getInstanceGeometry } from '../utils';
import './GhostInstance.css';

interface GhostInstanceProps {
  instanceEvent: InstanceEvent;
  existingInstances: Instance[];
  zoom?: number;
  pan?: { x: number; y: number };
}

const GhostInstance: React.FC<GhostInstanceProps> = ({
  instanceEvent,
  existingInstances
}) => {
  if (instanceEvent.action === 'remove') {
    // For remove actions, show existing instance with deletion overlay
    const existingInstance = existingInstances.find(inst => inst.id === instanceEvent.targetId);
    if (!existingInstance) return null;
    
    return (
      <div
        className="ghost-instance ghost-remove"
        style={{
          position: 'absolute',
          left: getInstanceGeometry(existingInstance).x,
          top: getInstanceGeometry(existingInstance).y,
          width: getInstanceGeometry(existingInstance).width,
          height: getInstanceGeometry(existingInstance).height,
        }}
      >
        <div className="ghost-content">
          <div className="deletion-overlay">
            <span className="deletion-icon">🗑️</span>
            <span className="deletion-text">Will be removed</span>
          </div>
        </div>
      </div>
    );
  }

  if (!instanceEvent.instance) return null;

  const instance = instanceEvent.instance;
  const isUpdate = instanceEvent.action === 'update';
  const baseClass = isUpdate ? 'ghost-update' : 'ghost-add';

  const renderInstanceContent = (inst: Instance) => {
    switch (inst.type) {
      case 'text':
        return (
          <p className="ghost-text-content">
            {inst.content}
          </p>
        );
      
      case 'image':
        return (
          <img
            src={inst.src}
            alt="Ghost preview"
            className="ghost-image-content"
          />
        );
      
      case 'table':
        return (
          <div className="ghost-table-content">
            <div 
              className="ghost-table-grid"
              style={{
                gridTemplateRows: `repeat(${inst.rows}, 1fr)`,
                gridTemplateColumns: `repeat(${inst.cols}, 1fr)`,
              }}
            >
              {inst.cells.flat().map((cell, index) => (
                <div key={index} className="ghost-table-cell">
                  {cell?.type === 'text' ? (cell.content?.slice(0, 10) || '') + '...' : 
                   cell?.type === 'image' ? '🖼️' : ''}
                </div>
              ))}
            </div>
          </div>
        );
      
      case 'sketch':
        return (
          <div className="ghost-sketch-content">
            {(instance as SketchInstance).thumbnail ? (
              <img src={(instance as SketchInstance).thumbnail} alt="Sketch preview" className="ghost-sketch-thumb" />
            ) : (
              <div className="ghost-sketch-placeholder">✏️ Sketch</div>
            )}
          </div>
        );
      
      case 'visualization':
        return (
          <div className="ghost-viz-content">
            {(instance as VisualizationInstance).thumbnail ? (
              <img src={(instance as VisualizationInstance).thumbnail} alt="Viz preview" className="ghost-viz-thumb" />
            ) : (
              <div className="ghost-viz-placeholder">📊 Chart</div>
            )}
          </div>
        );
      
      default:
        return <div className="ghost-unknown">Unknown type</div>;
    }
  };

  return (
    <div
      className={`ghost-instance ${baseClass}`}
      style={{
        position: 'absolute',
        left: getInstanceGeometry(instance).x,
        top: getInstanceGeometry(instance).y,
        width: getInstanceGeometry(instance).width,
        height: getInstanceGeometry(instance).height,
      }}
    >
      <div className="ghost-content">
        {renderInstanceContent(instance)}
        <div className="ghost-overlay">
          <div className="ghost-action-label">
            {isUpdate ? 'Update' : 'Add'}
          </div>
          <div className="ghost-hint">
            Press <kbd>Tab</kbd> to apply
          </div>
        </div>
      </div>
      
      {/* Instance ID label */}
      <div className="ghost-id-label">
        {instance.id}
      </div>
    </div>
  );
};

export default GhostInstance;