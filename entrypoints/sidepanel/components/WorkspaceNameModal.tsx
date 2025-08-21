/**
 * WorkspaceNameModal - Modal for naming the workspace before entering instance view
 */

import React, { useState, useEffect } from 'react';
import './WorkspaceNameModal.css';

interface WorkspaceNameModalProps {
  isOpen: boolean;
  initialName?: string;
  onSave: (name: string) => void;
  onCancel: () => void;
  onSkip?: () => void;
}

const WorkspaceNameModal: React.FC<WorkspaceNameModalProps> = ({
  isOpen,
  initialName = '',
  onSave,
  onCancel,
  onSkip
}) => {
  const [workspaceName, setWorkspaceName] = useState(initialName);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setWorkspaceName(initialName);
      setError('');
      
      // Add global keyboard event listener
      const handleGlobalKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        }
        if (e.key === 'Tab') {
          // Allow tab navigation within the modal
          const modal = document.querySelector('.workspace-name-modal');
          if (modal && !modal.contains(e.target as Node)) {
            e.preventDefault();
          }
        }
      };
      
      document.addEventListener('keydown', handleGlobalKeyDown, true);
      
      // Focus the input after a brief delay to ensure proper focus
      const focusTimeout = setTimeout(() => {
        const input = document.getElementById('workspace-name-input');
        if (input) {
          input.focus();
        }
      }, 100);
      
      return () => {
        document.removeEventListener('keydown', handleGlobalKeyDown, true);
        clearTimeout(focusTimeout);
      };
    }
  }, [isOpen, initialName, onCancel]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedName = workspaceName.trim();
    if (!trimmedName) {
      setError('Please enter a workspace name');
      return;
    }
    
    if (trimmedName.length > 100) {
      setError('Workspace name must be 100 characters or less');
      return;
    }
    
    onSave(trimmedName);
  };

  if (!isOpen) return null;

  return (
    <div className="workspace-name-modal-overlay" onClick={onCancel}>
      <div className="workspace-name-modal" onClick={e => e.stopPropagation()}>
        <div className="workspace-name-modal-header">
          <h3>Name Your Workspace</h3>
          <button 
            className="workspace-name-modal-close"
            onClick={onCancel}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        
        <div className="workspace-name-modal-content">
          <p>Give your workspace a descriptive name to help organize your work and enable relevant webpage suggestions.</p>
          
          <form onSubmit={handleSubmit}>
            <div className="workspace-name-input-group">
              <label htmlFor="workspace-name-input">Workspace Name:</label>
              <input
                id="workspace-name-input"
                type="text"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder="e.g., Product Research, Market Analysis, Content Collection..."
                maxLength={100}
              />
              {error && <div className="workspace-name-error">{error}</div>}
            </div>
            
            <div className="workspace-name-modal-actions">
              <button 
                type="button" 
                className="workspace-name-btn-secondary"
                onClick={onCancel}
              >
                Cancel
              </button>
              {onSkip && (
                <button 
                  type="button" 
                  className="workspace-name-btn-tertiary"
                  onClick={onSkip}
                >
                  Skip for Now
                </button>
              )}
              <button 
                type="submit" 
                className="workspace-name-btn-primary"
              >
                Save Name
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default WorkspaceNameModal;
