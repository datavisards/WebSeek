// TableEditor.tsx
import React from 'react';
import TableGrid from './tablegrid';
import { TableInstance, Instance } from '../types';
import './tableeditor.css';

interface TableEditorProps {
  tableId: string | null;
  instances: Instance[];
  onSaveTable: () => void;
  onCancel: () => void;
  onAddToTable: (instance: Instance, row: number, col: number) => void;
  onRemoveCellContent: (row: number, col: number) => void;
  onEditCellContent: (row: number, col: number, newValue: string) => void;
  draggingInstanceId: string | null;
  setDraggingInstanceId: React.Dispatch<React.SetStateAction<string | null>>;
  availableInstances: Instance[];
  onCaptureToCell?: (row: number, col: number) => void;
  isCaptureEnabled?: boolean;
  onAddRow?: (position: 'before' | 'after', rowIndex: number) => void;
  onRemoveRow?: (rowIndex: number) => void;
  onAddColumn?: (position: 'before' | 'after', colIndex: number) => void;
  onRemoveColumn?: (colIndex: number) => void;
}

const TableEditor: React.FC<TableEditorProps> = ({
  tableId,
  instances,
  onSaveTable,
  onCancel,
  onAddToTable,
  onRemoveCellContent,
  onEditCellContent,
  draggingInstanceId,
  setDraggingInstanceId,
  availableInstances,
  onCaptureToCell,
  isCaptureEnabled = true,
  onAddRow,
  onRemoveRow,
  onAddColumn,
  onRemoveColumn,
}) => {
  const [selectedCell, setSelectedCell] = useState<{ row: number, col: number } | null>(null);
  if (!tableId) return null;

  const table = instances.find(inst =>
    inst.id === tableId && inst.type === 'table'
  ) as TableInstance | undefined;

  if (!table) return null;

  return (
    <div className="view-container">
      <div className="view-title-container">
        <h3 style={{ margin: 0 }}>Edit Table</h3>
        <button onClick={onSaveTable}>Save</button>
        <button onClick={onCancel}>Cancel</button>
        {selectedCell && onCaptureToCell && (
          <button 
            onClick={() => onCaptureToCell(selectedCell.row, selectedCell.col)}
            disabled={!isCaptureEnabled}
            style={{ marginLeft: '10px' }}
          >
            Capture to Cell ({selectedCell.row + 1}, {String.fromCharCode(65 + selectedCell.col)})
          </button>
        )}
      </div>

      <div className="table-container">
        <TableGrid
          table={table}
          instances={instances}
          onAddToTable={onAddToTable}
          onRemoveCellContent={onRemoveCellContent}
          setDraggingInstanceId={setDraggingInstanceId}
          onEditCellContent={onEditCellContent}
          onCellSelectionChange={setSelectedCell}
          onAddRow={onAddRow}
          onRemoveRow={onRemoveRow}
          onAddColumn={onAddColumn}
          onRemoveColumn={onRemoveColumn}
        />
      </div>

      <div className="available-instances">
        <h4 style={{ margin: '10px 0' }}>Add to Table:</h4>
        <div className="instance-thumbs">
          {availableInstances
            .map(instance => (
              <div
                key={instance.id}
                className="instance-thumb"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', instance.id);
                  setDraggingInstanceId(instance.id);
                }}
              >
                {instance.type === 'text' ? (
                  <p className="thumb-text">{instance.content.slice(0, 20)}{instance.content.length > 20 ? '...' : ''}</p>
                ) : instance.type === 'image' ? (
                  <img
                    src={instance.src}
                    alt="thumb"
                    className="thumb-image"
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  />
                ) : instance.type === 'sketch' ? (
                  <div className="sketch-thumbnail">
                    {instance.thumbnail ? (
                      <img
                        src={instance.thumbnail}
                        alt="sketch"
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    ) : (
                      <div className="sketch-thumb-placeholder" style={{ background: '#e0e0e0', height: '100%' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
                          <path d="M4 4h16v16h-16v-16zm14 14l-3.5-7-3.5 7h7zm-13 0v-12h12v12h-12zm3-9c-.552 0-1-.448-1-1s.448-1 1-1 1 .448 1 1-.448 1-1 1z" />
                        </svg>
                      </div>
                    )}
                  </div>
                ) : instance.type === 'table' ? (
                  <div className="table-thumbnail" style={{ backgroundColor: '#eee', height: '100%', padding: '4px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                      {Array(2).fill(0).map((_, i) => (
                        <div key={i} style={{ display: 'flex', flex: 1 }}>
                          {Array(2).fill(0).map((_, j) => (
                            <div key={`${i}-${j}`} style={{ flex: 1, border: '1px solid #ccc' }}></div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default TableEditor;