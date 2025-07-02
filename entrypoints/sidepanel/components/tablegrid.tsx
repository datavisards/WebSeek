import React, { useState, useRef, useEffect } from 'react';
import { TableInstance, Instance, EmbeddedInstance } from '../types';
import { indexToLetters } from '../utils';
import './tablegrid.css';

interface TableGridProps {
  table: TableInstance;
  instances: Instance[];
  onAddToTable: (instance: Instance, row: number, col: number) => void;
  onRemoveCellContent: (row: number, col: number) => void;
  onEditCellContent: (row: number, col: number, newValue: string) => void;
  setDraggingInstanceId: React.Dispatch<React.SetStateAction<string | null>>;
  isReadOnly?: boolean;
}

const TableGrid: React.FC<TableGridProps> = ({
  table,
  instances,
  onAddToTable,
  onRemoveCellContent,
  onEditCellContent,
  setDraggingInstanceId,
  isReadOnly = false
}) => {
  const cellWidth = Math.max(50, Math.min(200, table.width / table.cols));
  const cellHeight = Math.max(50, Math.min(200, table.height / table.rows));
  const [hoveredCell, setHoveredCell] = useState<{ row: number, col: number } | null>(null);
  const [editingCell, setEditingCell] = useState<{ row: number, col: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Multi-selection states
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [selectedColumns, setSelectedColumns] = useState<Set<number>>(new Set());
  const [selectedCell, setSelectedCell] = useState<{ row: number, col: number } | null>(null);

  useEffect(() => {
    if (editingCell !== null && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingCell]);

  const handleCellClick = (row: number, col: number) => {
    setSelectedCell({ row, col });
    setSelectedRows(new Set());
    setSelectedColumns(new Set());
    setEditingCell(null);
  };

  const handleContentClick = (e: React.MouseEvent, row: number, col: number) => {
    e.stopPropagation();
    setSelectedCell({ row, col });
    setSelectedRows(new Set());
    setSelectedColumns(new Set());
    setEditingCell({ row, col });
  };

  const handleBlur = (e: React.FocusEvent, row: number, col: number) => {
    const newValue = e.currentTarget.textContent || '';
    onEditCellContent(row, col, newValue);
    setEditingCell(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, row: number, col: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const newValue = e.currentTarget.textContent || '';
      onEditCellContent(row, col, newValue);
      setEditingCell(null);
    }
  };

  // Row selection handlers
  const handleRowHeaderClick = (rowIndex: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isReadOnly) return;

    if (e.ctrlKey || e.metaKey) {
      // Toggle selection with Ctrl/Cmd
      setSelectedRows(prev => {
        const newSet = new Set(prev);
        newSet.has(rowIndex) ? newSet.delete(rowIndex) : newSet.add(rowIndex);
        return newSet;
      });
    } else if (e.shiftKey && selectedRows.size > 0) {
      // Range selection with Shift
      const min = Math.min(...selectedRows, rowIndex);
      const max = Math.max(...selectedRows, rowIndex);
      const newSet = new Set<number>();
      for (let i = min; i <= max; i++) newSet.add(i);
      setSelectedRows(newSet);
    } else {
      // Single selection
      setSelectedRows(new Set([rowIndex]));
    }
    setSelectedColumns(new Set());
    setSelectedCell(null);
  };

  // Column selection handlers
  const handleColumnHeaderClick = (colIndex: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isReadOnly) return;

    if (e.ctrlKey || e.metaKey) {
      // Toggle selection with Ctrl/Cmd
      setSelectedColumns(prev => {
        const newSet = new Set(prev);
        newSet.has(colIndex) ? newSet.delete(colIndex) : newSet.add(colIndex);
        return newSet;
      });
    } else if (e.shiftKey && selectedColumns.size > 0) {
      // Range selection with Shift
      const min = Math.min(...selectedColumns, colIndex);
      const max = Math.max(...selectedColumns, colIndex);
      const newSet = new Set<number>();
      for (let i = min; i <= max; i++) newSet.add(i);
      setSelectedColumns(newSet);
    } else {
      // Single selection
      setSelectedColumns(new Set([colIndex]));
    }
    setSelectedRows(new Set());
    setSelectedCell(null);
  };

  // Corner header handler (selects everything)
  const handleCornerClick = () => {
    if (isReadOnly) return;

    const allRows = new Set<number>();
    const allColumns = new Set<number>();
    for (let i = 0; i < table.rows; i++) allRows.add(i);
    for (let i = 0; i < table.cols; i++) allColumns.add(i);

    setSelectedRows(allRows);
    setSelectedColumns(allColumns);
    setSelectedCell(null);
  };

  // Check if a cell should be highlighted based on row/column selection
  const isSelectedViaHeader = (row: number, col: number) => {
    return selectedRows.has(row) || selectedColumns.has(col);
  };

  return (
    <div
      className="table-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: `50px repeat(${table.cols}, ${cellWidth}px)`,
        gridTemplateRows: `30px repeat(${table.rows}, ${cellHeight}px)`,
        border: '1px solid #ccc',
        width: 'fit-content',
        flex: '1 1 auto',
      }}
    >
      {/* Corner Header */}
      <div
        className="grid-header corner-header"
        onClick={handleCornerClick}
        style={{
          gridRow: 1,
          gridColumn: 1,
          cursor: isReadOnly ? 'default' : 'pointer',
          border: '1px solid #ccc',
        }}
      />

      {/* Column Headers */}
      {Array.from({ length: table.cols }, (_, colIndex) => (
        <div
          key={`col-${colIndex}`}
          className={`grid-header column-header ${selectedColumns.has(colIndex) ? 'selected-header' : ''}`}
          onClick={(e) => handleColumnHeaderClick(colIndex, e)}
          style={{
            gridRow: 1,
            gridColumn: colIndex + 2,
            cursor: isReadOnly ? 'default' : 'pointer',
            userSelect: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid #ccc',
            backgroundColor: '#f0f0f0',
            fontWeight: 'bold',
          }}
        >
          {indexToLetters(colIndex)}
        </div>
      ))}

      {/* Row Headers */}
      {Array.from({ length: table.rows }, (_, rowIndex) => (
        <div
          key={`row-${rowIndex}`}
          className={`grid-header row-header ${selectedRows.has(rowIndex) ? 'selected-header' : ''}`}
          onClick={(e) => handleRowHeaderClick(rowIndex, e)}
          style={{
            gridRow: rowIndex + 2,
            gridColumn: 1,
            cursor: isReadOnly ? 'default' : 'pointer',
            userSelect: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid #ccc',
            backgroundColor: '#f0f0f0',
            fontWeight: 'bold',
          }}
        >
          {rowIndex + 1}
        </div>
      ))}

      {/* Content Cells */}
      {table.cells.map(cell => {
        const isHovered = hoveredCell?.row === cell.row && hoveredCell?.col === cell.col;
        const isCellSelected = selectedCell?.row === cell.row && selectedCell?.col === cell.col;
        const isEditing = editingCell?.row === cell.row && editingCell?.col === cell.col;
        const isHeaderSelected = isSelectedViaHeader(cell.row, cell.col);

        return (
          <div
            key={`${cell.row}-${cell.col}`}
            className={`table-cell 
                ${isHovered ? 'drop-zone' : ''} 
                ${isCellSelected ? 'selected' : ''}
                ${isHeaderSelected ? 'header-selected' : ''}
                ${isEditing ? 'editing' : ''}`}
            onDragOver={isReadOnly ? undefined : (e) => {
              e.preventDefault();
              e.stopPropagation();
              setHoveredCell({ row: cell.row, col: cell.col });
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
            onClick={isReadOnly ? undefined : () => handleCellClick(cell.row, cell.col)}
            onDoubleClick={isReadOnly ? undefined : () => {
              const isTextCell = !cell.content || (cell.content.type === 'text');
              if (isTextCell) {
                setEditingCell({ row: cell.row, col: cell.col });
              } else {
                alert('Non-textual content cannot be edited directly. Please remove it first.');
              }
            }}
            style={{
              gridRow: cell.row + 2,
              gridColumn: cell.col + 2,
              cursor: isReadOnly ? 'default' : 'pointer',
            }}
          >
            {isEditing ? (
              <div
                contentEditable
                suppressContentEditableWarning
                className="editable-text"
                ref={inputRef}
                onBlur={isReadOnly ? undefined : (e) => handleBlur(e, cell.row, cell.col)}
                onKeyDown={isReadOnly ? undefined : (e) => handleKeyDown(e, cell.row, cell.col)}
              >
                {cell.content && cell.content.type === 'text' ? cell.content.content : ''}
              </div>
            ) : cell.content ?
              <div
                key={cell.content.id}
                className={`embedded-instance ${isEditing ? 'editing-content' : ''}`}
                style={{
                  width: '100%',
                  height: '100%',
                  userSelect: isReadOnly ? 'none' : undefined
                }}
                onClick={isReadOnly ? undefined : (e) => handleContentClick(e, cell.row, cell.col)}
              >
                {
                  renderEmbeddedContent(cell.content)
                }
                {!isReadOnly && !isEditing && (
                  <button
                    className="remove-cell-content"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveCellContent(cell.row, cell.col);
                    }}
                  >
                    ×
                  </button>
                )}
              </div> : null
            }
          </div>
        );
      })}
    </div>
  );
};

// (Render embedded content function remains unchanged)

// Helper to render different embedded content types (unchanged)
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