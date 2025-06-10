import React, { useState } from 'react';
import { TableInstance, Instance, EmbeddedInstance } from '../types';
import './tablegrid.css';

interface TableGridProps {
  table: TableInstance;
  instances: Instance[];
  onAddToTable: (instance: Instance, row: number, col: number) => void;
  onRemoveCellContent: (row: number, col: number, contentIdx: number) => void;
  setDraggingInstanceId: React.Dispatch<React.SetStateAction<string | null>>;
  isReadOnly?: boolean; // New prop
}

const TableGrid: React.FC<TableGridProps> = ({
  table,
  instances,
  onAddToTable,
  onRemoveCellContent,
  setDraggingInstanceId,
  isReadOnly = false
}) => {
  const cellWidth = Math.max(50, Math.min(200, table.width / table.cols));
  const cellHeight = Math.max(50, Math.min(200, table.height / table.rows));
  const [hoveredCell, setHoveredCell] = useState<{row: number, col: number} | null>(null);

  return (
    <div className="table-grid-container">
      <div
        className="table-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${table.cols}, ${cellWidth}px)`,
          gridTemplateRows: `repeat(${table.rows}, ${cellHeight}px)`,
          border: '1px solid #ccc',
          width: 'fit-content'
        }}
      >
        {table.cells.map(cell => {
          const isHovered = hoveredCell && 
                            hoveredCell.row === cell.row && 
                            hoveredCell.col === cell.col;

          return (
            <div
              key={`${cell.row}-${cell.col}`}
              className={`table-cell ${isHovered ? 'drop-zone' : ''}`}
              onDragOver={isReadOnly ? undefined : (e) => {
                e.preventDefault();
                e.stopPropagation();
                setHoveredCell({row: cell.row, col: cell.col});
              }}
              onDragLeave={isReadOnly ? undefined : () => setHoveredCell(null)}
              onDrop={isReadOnly ? undefined : (e) => {
                e.preventDefault();
                e.stopPropagation();
                const instanceId = e.dataTransfer.getData('text/plain');
                const draggedInstance = instances.find(inst => inst.id === instanceId);
                if (draggedInstance) {
                  onAddToTable(draggedInstance, cell.row, cell.col);
                }
                setDraggingInstanceId(null);
                setHoveredCell(null);
              }}
              style={{
                border: '1px solid #ddd',
                backgroundColor: 'white',
                position: 'relative',
                overflow: 'hidden',
                padding: '4px',
                cursor: isReadOnly ? 'default' : 'pointer',
              }}
            >
              {cell.content.map((embedded, idx) => (
                <div
                  key={embedded.id || idx}
                  className="embedded-instance"
                  style={{ width: '100%', height: '100%', userSelect: isReadOnly ? 'none' : undefined }}
                >
                  {renderEmbeddedContent(embedded)}
                  {!isReadOnly && (
                    <button
                      className="remove-cell-content"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveCellContent(cell.row, cell.col, idx);
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Helper to render different embedded content types
function renderEmbeddedContent(embedded: EmbeddedInstance) {
  switch (embedded.type) {
    case 'text':
      return (
        <p className="cell-text" style={{ margin: 0, fontSize: '12px' }}>
          {embedded.content}
        </p>
      );
    case 'image':
      return (
        <img
          src={embedded.src}
          alt="thumbnail"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            pointerEvents: 'none',
          }}
        />
      );
    case 'sketch':
      return (
        <div className="sketch-thumb-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16">
            <path d="M4 4h16v16h-16v-16zm1 2v12h14v-12h-14zm12 9h-4v-2h4v-6h-6v-2h10v8h-2z" />
          </svg>
        </div>
      );
    case 'table':
      return (
        <div className="table-thumb-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16">
            <path d="M4 8h16v12h-16v-12zm1 2v2h4v-2h-4zm5 0v2h4v-2h-4zm5 0v2h4v-2h-4zm-10 4v2h4v-2h-4zm5 0v2h4v-2h-4zm5 0v2h4v-2h-4z" />
          </svg>
        </div>
      );
    default:
      return null;
  }
}

export default TableGrid;