import React, { useState, useEffect } from 'react';
import { Instance } from '../types';
import './renamemodal.css'; 

interface RenameModalProps {
  instance: Instance | null;
  instances: Instance[];
  onConfirm: (oldId: string, newId: string) => void;
  onCancel: () => void;
}

const RenameModal = ({ instance, instances, onConfirm, onCancel }: RenameModalProps) => {
  const [newInstanceName, setNewInstanceName] = useState('');
  const [renameError, setRenameError] = useState('');

  useEffect(() => {
    setNewInstanceName(instance?.id || '');
    setRenameError('');
  }, [instance]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRenameConfirm();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  const validateName = useCallback(() => {
    if (!newInstanceName.trim()) {
      setRenameError("Name cannot be empty");
      return false;
    }
    
    // Check for duplicates across all instances and embedded instances
    const isDuplicate = instances.some(inst => {
      // Check against top-level instances
      if (inst.id === newInstanceName) return true;
      
      // Check for embedded instances in sketches
      if (inst.type === 'sketch') {
        const hasEmbeddedDuplicate = inst.content.some(item => 
          item.type === 'instance' && item.instance.id === newInstanceName
        );
        if (hasEmbeddedDuplicate) return true;
      }
      
      // Check for embedded instances in tables
      if (inst.type === 'table') {
        const hasTableDuplicate = inst.cells.some(cell => 
          cell.content && cell.content.id === newInstanceName
        );
        if (hasTableDuplicate) return true;
      }
      
      return false;
    });
    
    if (isDuplicate) {
      setRenameError("This name already exists. Please choose a unique name.");
      return false;
    }
    
    return true;
  }, [newInstanceName, instances]);

  const handleRenameConfirm = () => {
    if (!instance || !validateName()) return;
    onConfirm(instance.id, newInstanceName);
  };

  if (!instance) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h3>Rename Instance: {instance.id}</h3>
        <div className="modal-input-group">
          <input
            type="text"
            value={newInstanceName}
            onChange={(e) => setNewInstanceName(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          {renameError && <p className="modal-error">{renameError}</p>}
        </div>
        <div className="modal-button-group">
          <button onClick={handleRenameConfirm}>Confirm</button>
          <button onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default RenameModal;