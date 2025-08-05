import React, { useState, useRef, useEffect, useMemo } from 'react';
import { TableInstance, Instance, EmbeddedInstance, ProactiveSuggestion, InstanceEvent } from '../types';
import { getInstanceGeometry, indexToLetters, areInstancesContentEqual } from '../utils';
import InlineSuggestion from './InlineSuggestion';
import './tablegrid.css';

interface TableGridProps {
  table: TableInstance;
  instances: Instance[];
  onAddToTable: (instance: Instance, row: number, col: number) => void;
  onRemoveCellContent: (row: number, col: number) => void;
  onEditCellContent: (row: number, col: number, newValue: string) => void;
  setDraggingInstanceId: React.Dispatch<React.SetStateAction<string | null>>;
  isReadOnly?: boolean;
  onCellSelectionChange?: (selectedCell: { row: number, col: number } | null) => void;
  onAddRow?: (position: 'before' | 'after', rowIndex: number) => void;
  onRemoveRow?: (rowIndex: number) => void;
  onAddColumn?: (position: 'before' | 'after', colIndex: number) => void;
  onRemoveColumn?: (colIndex: number) => void;
  onUpdateColumnType?: (colIndex: number, columnType: 'numeral' | 'categorical') => void;
  currentSuggestion?: ProactiveSuggestion;
  onAcceptSuggestion?: () => void;
  onDismissSuggestion?: () => void;
}

const TableGrid: React.FC<TableGridProps> = ({
  table,
  instances,
  onAddToTable,
  onRemoveCellContent,
  onEditCellContent,
  setDraggingInstanceId,
  isReadOnly = false,
  onCellSelectionChange,
  onAddRow,
  onRemoveRow,
  onAddColumn,
  onRemoveColumn,
  onUpdateColumnType,
  currentSuggestion,
  onAcceptSuggestion,
  onDismissSuggestion
}) => {
  // These will be computed later based on effective table dimensions
  const [hoveredCell, setHoveredCell] = useState<{ row: number, col: number } | null>(null);
  const [editingCell, setEditingCell] = useState<{ row: number, col: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Multi-selection states
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [selectedColumns, setSelectedColumns] = useState<Set<number>>(new Set());
  const [selectedCell, setSelectedCell] = useState<{ row: number, col: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    type: 'row' | 'column';
    index: number;
    position: { x: number; y: number };
  } | null>(null);

  // Add sort state after other useStates
  const [sortColumn, setSortColumn] = useState<number | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);

  // Compute effective table dimensions including suggestions
  const effectiveTable = useMemo(() => {
    if (!currentSuggestion) return table;

    // Find table update suggestion
    const tableUpdateEvent = currentSuggestion.instances.find(event => 
      event.instance?.type === 'table' && event.action === 'update'
    );

    if (tableUpdateEvent && tableUpdateEvent.instance?.type === 'table') {
      const suggestedTable = tableUpdateEvent.instance as any;
      // Return table with expanded dimensions to show suggested content
      return {
        ...table,
        rows: Math.max(table.rows, suggestedTable.rows || 0),
        cols: Math.max(table.cols, suggestedTable.cols || 0)
      };
    }

    return table;
  }, [table, currentSuggestion]);

  // Update cell dimensions based on effective table
  const effectiveCellWidth = Math.max(50, Math.min(200, getInstanceGeometry(table).width / effectiveTable.cols));
  const effectiveCellHeight = Math.max(50, Math.min(200, getInstanceGeometry(table).height / effectiveTable.rows));

  // Helper function to find suggestion for a specific cell
  const getSuggestionForCell = (row: number, col: number): InstanceEvent | null => {
    if (!currentSuggestion) return null;
    
    // First, check if this is a table update suggestion
    const tableUpdateEvent = currentSuggestion.instances.find(event => 
      event.instance?.type === 'table' && event.action === 'update'
    );
    
    if (tableUpdateEvent && tableUpdateEvent.instance?.type === 'table') {
      // Handle table update - compare cell by cell
      const suggestedTable = tableUpdateEvent.instance as any;
      const currentCell = table.cells[row]?.[col];
      const suggestedCell = suggestedTable.cells?.[row]?.[col];
      
      // If there's no suggested cell but current cell exists, it's a remove
      if (!suggestedCell && currentCell) {
        return {
          action: 'remove',
          targetId: currentCell.id
        };
      }
      
      // If there's a suggested cell but no current cell, it's an add
      if (suggestedCell && !currentCell) {
        return {
          action: 'add',
          instance: suggestedCell
        };
      }
      
      // If both exist, check if they're different (update)
      if (suggestedCell && currentCell) {
        // Only show update suggestion if cells are actually different (ignoring source differences)
        if (!areInstancesContentEqual(suggestedCell, currentCell)) {
          return {
            action: 'update',
            targetId: currentCell.id,
            instance: suggestedCell
          };
        }
      }
      
      return null; // No changes for this cell
    }
    
    // Fallback to original logic for non-table suggestions
    return currentSuggestion.instances.find(event => {
      if (event.action === 'remove') {
        // For remove actions, check if targeting this cell's content
        const cell = table.cells[row]?.[col];
        return cell && cell.id === event.targetId;
      } else if (event.instance) {
        // For add/update actions, check position
        const geometry = getInstanceGeometry(event.instance);
        const cellX = col * effectiveCellWidth;
        const cellY = row * effectiveCellHeight;
        return geometry.x >= cellX && geometry.x < cellX + effectiveCellWidth &&
               geometry.y >= cellY && geometry.y < cellY + effectiveCellHeight;
      }
      return false;
    }) || null;
  };

  // Handle keyboard controls for suggestions
  const handleSuggestionKeyDown = (e: React.KeyboardEvent, row: number, col: number) => {
    const suggestion = getSuggestionForCell(row, col);
    if (!suggestion) return false;

    if (e.key === 'Tab') {
      e.preventDefault();
      onAcceptSuggestion?.();
      return true;
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onDismissSuggestion?.();
      return true;
    }
    return false;
  };

  // Memoize sorted rows
  const sortedRows = useMemo(() => {
    if (sortColumn === null || sortDirection === null) {
      return table.cells.map((row, idx) => ({ row, originalIndex: idx }));
    }
    // Only sort if all cells in the column are text or null
    const canSort = table.cells.every(row => {
      const cell = row[sortColumn];
      return !cell || cell.type === 'text';
    });
    if (!canSort) return table.cells.map((row, idx) => ({ row, originalIndex: idx }));
    
    // Check if more than 80% of non-empty values can be converted to numbers
    const columnValues = table.cells.map(row => {
      const cell = row[sortColumn];
      return cell && cell.type === 'text' ? cell.content.trim() : '';
    }).filter(val => val !== '');
    
    const numericCount = columnValues.filter(val => {
      const num = Number(val);
      return !isNaN(num) && isFinite(num);
    }).length;
    
    const isNumericColumn = columnValues.length > 0 && (numericCount / columnValues.length) > 0.8;
    
    
    // Pair each row with its index for stable sort
    const paired = table.cells.map((row, idx) => ({ row, idx }));
    paired.sort((a, b) => {
      const cellA = a.row[sortColumn];
      const cellB = b.row[sortColumn];
      const valA = cellA && cellA.type === 'text' ? cellA.content.trim() : '';
      const valB = cellB && cellB.type === 'text' ? cellB.content.trim() : '';
      
      // Handle empty values - sort them to the end
      if (valA === '' && valB === '') return a.idx - b.idx;
      if (valA === '') return sortDirection === 'asc' ? 1 : -1;
      if (valB === '') return sortDirection === 'asc' ? -1 : 1;
      
      if (isNumericColumn) {
        // Mixed numeric/string sorting: numbers first, then strings
        const numA = Number(valA);
        const numB = Number(valB);
        const isNumA = !isNaN(numA) && isFinite(numA);
        const isNumB = !isNaN(numB) && isFinite(numB);
        
        // Both are numbers - sort numerically
        if (isNumA && isNumB) {
          if (numA < numB) return sortDirection === 'asc' ? -1 : 1;
          if (numA > numB) return sortDirection === 'asc' ? 1 : -1;
          return a.idx - b.idx;
        }
        
        // Only A is a number - A comes first in asc, last in desc
        if (isNumA && !isNumB) {
          return sortDirection === 'asc' ? -1 : 1;
        }
        
        // Only B is a number - B comes first in asc, last in desc
        if (!isNumA && isNumB) {
          return sortDirection === 'asc' ? 1 : -1;
        }
        
        // Both are strings - sort alphabetically
        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return a.idx - b.idx;
      } else {
        // String sorting
        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return a.idx - b.idx;
      }
    });
    return paired.map(p => ({ row: p.row, originalIndex: p.idx }));
  }, [table.cells, sortColumn, sortDirection]);

  useEffect(() => {
    if (editingCell !== null && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingCell]);

  // Notify parent when selected cell changes
  useEffect(() => {
    if (onCellSelectionChange) {
      onCellSelectionChange(selectedCell);
    }
  }, [selectedCell, onCellSelectionChange]);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu) {
        closeContextMenu();
      }
    };

    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu]);

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
    // Don't enter edit mode on single click - only select the cell
  };

  const handleBlur = (e: React.FocusEvent, row: number, col: number) => {
    // Only blur if the new focus target is outside the cell
    const cellElement = e.currentTarget.closest('.table-cell');
    const relatedTarget = e.relatedTarget as HTMLElement;
    
    // If the new focus target is still within the same cell, don't blur
    if (cellElement && relatedTarget && cellElement.contains(relatedTarget)) {
      return;
    }
    
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
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setEditingCell(null);
    }
  };

  // Handle keyboard events for the entire grid (for F2 and Enter to edit)
  const handleGridKeyDown = (e: React.KeyboardEvent) => {
    // Don't handle keyboard events when editing a cell
    if (editingCell) return;
    
    if (isReadOnly || !selectedCell) return;

    const cell = table.cells[selectedCell.row][selectedCell.col];
    if (!cell) return;

    if (e.key === 'F2' || e.key === 'Enter') {
      e.preventDefault();
      if (canEditCell(cell)) {
        setEditingCell(selectedCell);
      } else if (cell.type === 'image') {
        alert('Image cells cannot be edited directly. Please remove the image first.');
      } else {
        alert('This type of content cannot be edited directly. Please remove it first.');
      }
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      let newRow = selectedCell.row;
      let newCol = selectedCell.col;

      switch (e.key) {
        case 'ArrowUp':
          newRow = Math.max(0, selectedCell.row - 1);
          break;
        case 'ArrowDown':
          newRow = Math.min(effectiveTable.rows - 1, selectedCell.row + 1);
          break;
        case 'ArrowLeft':
          newCol = Math.max(0, selectedCell.col - 1);
          break;
        case 'ArrowRight':
          newCol = Math.min(effectiveTable.cols - 1, selectedCell.col + 1);
          break;
      }

      if (newRow !== selectedCell.row || newCol !== selectedCell.col) {
        setSelectedCell({ row: newRow, col: newCol });
        setSelectedRows(new Set());
        setSelectedColumns(new Set());
        setEditingCell(null);
      }
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
    for (let i = 0; i < effectiveTable.rows; i++) allRows.add(i);
    for (let i = 0; i < effectiveTable.cols; i++) allColumns.add(i);

    setSelectedRows(allRows);
    setSelectedColumns(allColumns);
    setSelectedCell(null);
  };

  // Check if a cell should be highlighted based on row/column selection
  const isSelectedViaHeader = (row: number, col: number) => {
    return selectedRows.has(row) || selectedColumns.has(col);
  };

  // Check if a cell can be edited (only text cells or empty cells)
  const canEditCell = (cell: EmbeddedInstance | null) => {
    return !cell || cell.type === 'text';
  };

  // Context menu handlers
  const handleRowContextMenu = (e: React.MouseEvent, rowIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (isReadOnly) return;
    
    setContextMenu({
      visible: true,
      type: 'row',
      index: rowIndex,
      position: { x: e.clientX, y: e.clientY }
    });
  };

  const handleColumnContextMenu = (e: React.MouseEvent, colIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (isReadOnly) return;
    
    setContextMenu({
      visible: true,
      type: 'column',
      index: colIndex,
      position: { x: e.clientX, y: e.clientY }
    });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  const handleContextMenuAction = (action: string) => {
    if (!contextMenu) return;
    
    const { type, index } = contextMenu;
    
    switch (action) {
      case 'add-before':
        if (type === 'row' && onAddRow) {
          onAddRow('before', index);
        } else if (type === 'column' && onAddColumn) {
          onAddColumn('before', index);
        }
        break;
      case 'add-after':
        if (type === 'row' && onAddRow) {
          onAddRow('after', index);
        } else if (type === 'column' && onAddColumn) {
          onAddColumn('after', index);
        }
        break;
      case 'remove':
        if (type === 'row' && onRemoveRow) {
          onRemoveRow(index);
        } else if (type === 'column' && onRemoveColumn) {
          onRemoveColumn(index);
        }
        break;
    }
    
    closeContextMenu();
  };

  // Sorting handler
  const handleSortClick = (colIndex: number) => {
    if (sortColumn !== colIndex) {
      setSortColumn(colIndex);
      setSortDirection('asc');
    } else if (sortDirection === 'asc') {
      setSortDirection('desc');
    } else if (sortDirection === 'desc') {
      setSortColumn(null);
      setSortDirection(null);
    }
  };

  return (
    <div
      className="table-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: `50px repeat(${effectiveTable.cols}, ${effectiveCellWidth}px)`,
        gridTemplateRows: `30px repeat(${effectiveTable.rows}, ${effectiveCellHeight}px)`,
        border: '1px solid #ccc',
        width: 'fit-content',
        flex: '1 1 auto',
      }}
      onKeyDown={handleGridKeyDown}
      tabIndex={0}
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
      {Array.from({ length: effectiveTable.cols }, (_, colIndex) => (
        <div
          key={`col-${colIndex}`}
          className={`grid-header column-header ${selectedColumns.has(colIndex) ? 'selected-header' : ''}`}
          onClick={(e) => handleColumnHeaderClick(colIndex, e)}
          onContextMenu={(e) => handleColumnContextMenu(e, colIndex)}
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
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>{indexToLetters(colIndex)}</span>
              <span
                style={{ cursor: 'pointer', fontSize: '12px', userSelect: 'none' }}
                onClick={e => {
                  e.stopPropagation();
                  handleSortClick(colIndex);
                }}
                title={
                  sortColumn === colIndex
                    ? sortDirection === 'asc'
                      ? 'Sort descending'
                      : 'Clear sort'
                    : 'Sort ascending'
                }
              >
                {sortColumn === colIndex ? (
                  sortDirection === 'asc' ? '▲' : '▼'
                ) : (
                  <span style={{ color: '#bbb' }}>⇅</span>
                )}
              </span>
              {onUpdateColumnType && (
                <img
                  src={`/icon/${table.columnTypes?.[colIndex] === 'numeral' ? 'numerical' : 'categorical'}.png`}
                  alt={table.columnTypes?.[colIndex] === 'numeral' ? 'Numerical' : 'Categorical'}
                  onClick={e => {
                    e.stopPropagation();
                    if (!isReadOnly) {
                      const currentType = table.columnTypes?.[colIndex] || 'categorical';
                      const newType = currentType === 'categorical' ? 'numeral' : 'categorical';
                      onUpdateColumnType(colIndex, newType);
                    }
                  }}
                  style={{
                    width: '12px',
                    height: '12px',
                    cursor: isReadOnly ? 'default' : 'pointer',
                    opacity: isReadOnly ? 0.6 : 1,
                    userSelect: 'none'
                  }}
                  title={`Column type: ${table.columnTypes?.[colIndex] === 'numeral' ? 'Numerical' : 'Categorical'}${!isReadOnly ? ' (click to toggle)' : ''}`}
                />
              )}
            </div>
          </div>
        </div>
      ))}

      {/* Row Headers */}
      {Array.from({ length: effectiveTable.rows }, (_, rowIndex) => (
        <div
          key={`row-${rowIndex}`}
          className={`grid-header row-header ${selectedRows.has(rowIndex) ? 'selected-header' : ''}`}
          onClick={(e) => handleRowHeaderClick(rowIndex, e)}
          onContextMenu={(e) => handleRowContextMenu(e, rowIndex)}
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
      {Array.from({ length: effectiveTable.rows }, (_, displayRowIndex) => 
        Array.from({ length: effectiveTable.cols }, (_, colIndex) => {
          // Get cell and original row index for suggestion detection
          let cell;
          let originalRowIndex = displayRowIndex; // Default to display index
          
          if (displayRowIndex < sortedRows.length && colIndex < sortedRows[displayRowIndex].row.length) {
            // Use sorted data and get original row index
            cell = sortedRows[displayRowIndex].row[colIndex];
            originalRowIndex = sortedRows[displayRowIndex].originalIndex;
          } else if (displayRowIndex < table.rows && colIndex < table.cols) {
            // Fallback to original table for edge cases
            cell = table.cells[displayRowIndex]?.[colIndex];
            originalRowIndex = displayRowIndex;
          } else {
            // Beyond original table dimensions - this is where new suggested rows/cols would appear
            cell = undefined;
            originalRowIndex = displayRowIndex;
          }
          
          const isHovered = hoveredCell?.row === displayRowIndex && hoveredCell?.col === colIndex;
          const isCellSelected = selectedCell?.row === displayRowIndex && selectedCell?.col === colIndex;
          const isEditing = editingCell?.row === displayRowIndex && editingCell?.col === colIndex;
          const isHeaderSelected = isSelectedViaHeader(displayRowIndex, colIndex);
          // Use original row index for suggestion detection
          const suggestion = getSuggestionForCell(originalRowIndex, colIndex);

          return (
            <div
              key={`${displayRowIndex}-${colIndex}`}
              className={`table-cell 
                  ${isHovered ? 'drop-zone' : ''} 
                  ${isCellSelected ? 'selected' : ''}
                  ${isHeaderSelected ? 'header-selected' : ''}
                  ${isEditing ? 'editing' : ''}
                  ${suggestion ? 'has-suggestion' : ''}`}
              onDragOver={isReadOnly ? undefined : (e) => {
                e.preventDefault();
                e.stopPropagation();
                setHoveredCell({ row: displayRowIndex, col: colIndex });
              }}
              onDragLeave={isReadOnly ? undefined : () => setHoveredCell(null)}
              onDrop={isReadOnly ? undefined : (e) => {
                e.preventDefault();
                e.stopPropagation();
                const instanceId = e.dataTransfer.getData('text/plain');
                const draggedInstance = instances.find(inst => inst.id === instanceId);
                if (draggedInstance) {
                  onAddToTable(draggedInstance, displayRowIndex, colIndex);
                }
                setDraggingInstanceId(null);
                setHoveredCell(null);
              }}
              onClick={isReadOnly || isEditing ? undefined : () => handleCellClick(displayRowIndex, colIndex)}
              onDoubleClick={isReadOnly || isEditing ? undefined : () => {
                if (cell && canEditCell(cell)) {
                  setEditingCell({ row: displayRowIndex, col: colIndex });
                } else if (cell && cell.type === 'image') {
                  alert('Image cells cannot be edited directly. Please remove the image first.');
                } else {
                  alert('This type of content cannot be edited directly. Please remove it first.');
                }
              }}
              onKeyDown={(e) => {
                handleSuggestionKeyDown(e, displayRowIndex, colIndex);
              }}
              tabIndex={suggestion ? 0 : -1}
              style={{
                gridRow: displayRowIndex + 2,
                gridColumn: colIndex + 2,
                cursor: isReadOnly ? 'default' : 'pointer',
              }}
            >
              {isEditing ? (
                <div
                  contentEditable
                  suppressContentEditableWarning
                  className="editable-text"
                  ref={inputRef}
                  onBlur={isReadOnly ? undefined : (e) => handleBlur(e, displayRowIndex, colIndex)}
                  onKeyDown={isReadOnly ? undefined : (e) => handleKeyDown(e, displayRowIndex, colIndex)}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onMouseUp={(e) => e.stopPropagation()}
                  onSelect={(e) => e.stopPropagation()}
                  onFocus={(e) => e.stopPropagation()}
                >
                  {cell && cell.type === 'text' ? cell.content : ''}
                </div>
              ) : suggestion ? (
                <InlineSuggestion
                  instanceEvent={suggestion}
                  existingContent={cell}
                  onAccept={() => onAcceptSuggestion?.()}
                  onDismiss={() => onDismissSuggestion?.()}
                />
              ) : cell ?
                <div
                  key={cell.id}
                  className={`embedded-instance ${isEditing ? 'editing-content' : ''}`}
                  style={{
                    width: '100%',
                    height: '100%',
                    userSelect: isReadOnly ? 'none' : undefined
                  }}
                  onClick={isReadOnly ? undefined : (e) => handleContentClick(e, displayRowIndex, colIndex)}
                >
                  {cell ? renderEmbeddedContent(cell) : null}
                  {!isReadOnly && !isEditing && (
                    <button
                      className="remove-cell-content"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveCellContent(displayRowIndex, colIndex);
                      }}
                    >
                      ×
                    </button>
                  )}
                </div> : null
              }
            </div>
          );
        })
      ).flat()}
      
      {/* Context Menu */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            top: contextMenu.position.y,
            left: contextMenu.position.x,
            background: 'white',
            border: '1px solid #ddd',
            borderRadius: '4px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            zIndex: 2000,
            minWidth: '150px',
          }}
          onClick={closeContextMenu}
        >
          <div
            className="contextmenuoption"
            onClick={() => handleContextMenuAction('add-before')}
          >
            Add {contextMenu.type === 'row' ? 'Row' : 'Column'} Before
          </div>
          <div
            className="contextmenuoption"
            onClick={() => handleContextMenuAction('add-after')}
          >
            Add {contextMenu.type === 'row' ? 'Row' : 'Column'} After
          </div>
          <div
            className="contextmenuoption"
            onClick={() => handleContextMenuAction('remove')}
            style={{ color: '#d32f2f' }}
          >
            Remove {contextMenu.type === 'row' ? 'Row' : 'Column'}
          </div>
        </div>
      )}
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