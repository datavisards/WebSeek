// TrashView.tsx
import React from 'react';
import { Instance } from '../types';
import './trashview.css';

interface TrashViewProps {
  deletedInstances: Instance[];
  onRestore: (instanceId: string) => void;
  onClose: () => void;
}

const TrashView: React.FC<TrashViewProps> = ({
  deletedInstances,
  onRestore,
  onClose
}) => (
  <>
    <div className="view-title-container">
      <h3 style={{ margin: 0 }}>Trash Bin ({deletedInstances.length})</h3>
      <button onClick={onClose}>Return</button>
    </div>

    <div className="view-content">
      {deletedInstances.length === 0 ? (
        <p className="empty-trash">Trash is empty</p>
      ) : (
        <div className="trash-list">
          {deletedInstances.map(instance => (
            <div key={instance.id} className="trash-item">
              <div className="trash-preview">
                {instance.type === 'text' ? (
                  <p>{instance.content}</p>
                ) : instance.type === 'image' ? (
                  <img
                    src={instance.src}
                    alt="deleted"
                    style={{ maxWidth: '100px', maxHeight: '100px' }}
                  />
                ) : instance.type === 'sketch' && instance.thumbnail ? (
                  <img
                    src={instance.thumbnail}
                    alt="sketch preview"
                    style={{ width: '100px', height: '80px' }}
                  />
                ) : (
                  <span>Sketch</span>
                )}
              </div>
              <div className="trash-actions">
                <button onClick={() => onRestore(instance.id)}>
                  Restore
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  </>
);

export default TrashView;