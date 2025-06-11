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
                ) : instance.type === 'table' ? (
                  <div
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      display: 'grid',
                      gridTemplateRows: `repeat(${instance.rows}, 1fr)`,
                      gridTemplateColumns: `repeat(${instance.cols}, 1fr)`,
                      gap: '1px',
                      border: '1px solid #ccc',
                      boxSizing: 'border-box',
                    }}
                  >
                    {instance.cells.map(cell => (
                      <div
                        key={`${cell.row}-${cell.col}`}
                        style={{
                          border: '1px solid #ddd',
                          padding: '2px',
                          boxSizing: 'border-box',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px',
                        }}
                      >
                        {!cell.content ? (
                          <div
                            style={{
                              width: '100%',
                              height: '100%',
                              background: '#f0f0f0',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#aaa',
                              fontSize: '8px',
                            }}
                          >
                            Empty
                          </div>) :
                          cell.content.type === 'text' ? (
                            <p
                              key={cell.content.id}
                              style={{
                                margin: 0,
                                fontSize: '10px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {cell.content.content.length > 10
                                ? `${cell.content.content.slice(0, 10)}...`
                                : cell.content.content}
                            </p>
                          )
                            : cell.content.type === 'image' ?
                              (
                                <img
                                  key={cell.content.id}
                                  src={cell.content.src}
                                  alt="thumbnail"
                                  style={{
                                    maxWidth: '100%',
                                    maxHeight: '100%',
                                    objectFit: 'contain',
                                    pointerEvents: 'none',
                                  }}
                                />
                              ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
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