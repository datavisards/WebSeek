/**
 * VisualizationConfirmModal - Confirmation modal for creating visualizations while in table editor
 */

import React from 'react';

interface VisualizationConfirmModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  message?: string;
  tableName?: string;
}

const VisualizationConfirmModal: React.FC<VisualizationConfirmModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  message = "Create visualization from table",
  tableName
}) => {
  if (!isOpen) return null;

  return (
    <div 
      className="modal-overlay" 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
      onClick={onCancel}
    >
      <div 
        className="modal-content" 
        style={{
          backgroundColor: 'white',
          padding: '24px',
          borderRadius: '8px',
          minWidth: '400px',
          maxWidth: '500px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ marginBottom: '16px' }}>
          <h3 style={{ margin: '0 0 12px 0', color: '#333' }}>
            Save Table and Create Visualization
          </h3>
          <p style={{ margin: '0', color: '#666', lineHeight: 1.5 }}>
            You are currently editing a table{tableName ? ` "${tableName}"` : ''}. 
            To create a visualization, your current work will be saved and the table editor will close.
          </p>
          {message && message !== "Create visualization from table" && (
            <p style={{ margin: '12px 0 0 0', color: '#555', fontStyle: 'italic' }}>
              "{message}"
            </p>
          )}
        </div>
        
        <div style={{ 
          display: 'flex', 
          gap: '12px', 
          justifyContent: 'flex-end',
          borderTop: '1px solid #eee',
          paddingTop: '16px'
        }}>
          <button 
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              border: '1px solid #ddd',
              backgroundColor: 'white',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          
          <button 
            onClick={onConfirm}
            style={{
              padding: '8px 16px',
              backgroundColor: '#007acc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Save & Create Visualization
          </button>
        </div>
      </div>
    </div>
  );
};

export default VisualizationConfirmModal;
