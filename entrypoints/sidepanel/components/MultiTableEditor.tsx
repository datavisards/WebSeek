// MultiTableEditor.tsx
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { browser } from 'wxt/browser';
import TableGrid from './tablegrid';
import { TableInstance, Instance, ProactiveSuggestion } from '../types';
import './tableeditor.css';

// Types for multi-table operations
interface OpenTable {
  id: string;
  instance: TableInstance;
  isDirty: boolean;
  isNew?: boolean;
  originalName?: string;
}

interface JoinSuggestion {
  leftTableId: string;
  rightTableId: string;
  leftColumn: string;
  rightColumn: string;
  joinType: 'inner' | 'left' | 'right' | 'full' | 'union';
  confidence: number;
}

interface CopiedData {
  type: 'cells' | 'rows' | 'columns' | 'region';
  data: any[][]; // For 'cells' and 'region': string values; for 'rows'/'columns': full cell instances
  sourceTableId: string;
  sourceRange: { startRow: number; endRow: number; startCol: number; endCol: number };
}

interface MultiTableEditorProps {
  initialTableId: string | null;
  instances: Instance[];
  htmlContext: Record<string, {pageURL: string, htmlContent: string}>;
  onSaveTable: (tableId: string, tableName?: string) => void;
  onCancel: () => void;
  onAddToTable: (tableId: string, instance: Instance, row: number, col: number) => void;
  onRemoveCellContent: (tableId: string, row: number, col: number) => void;
  onEditCellContent: (tableId: string, row: number, col: number, newValue: string) => void;
  draggingInstanceId: string | null;
  setDraggingInstanceId: React.Dispatch<React.SetStateAction<string | null>>;
  availableInstances: Instance[];
  onCaptureToCell?: (tableId: string, row: number, col: number) => void;
  isCaptureEnabled?: boolean;
  onAddRow?: (tableId: string, position: 'before' | 'after', rowIndex: number) => void;
  onRemoveRow?: (tableId: string, rowIndex: number) => void;
  onAddColumn?: (tableId: string, position: 'before' | 'after', colIndex: number) => void;
  onRemoveColumn?: (tableId: string, colIndex: number) => void;
  onUpdateColumnType?: (tableId: string, colIndex: number, columnType: 'numeral' | 'categorical') => void;
  onUpdateColumnName?: (tableId: string, colIndex: number, columnName: string) => void;
  onLiftRowToHeader?: (tableId: string, rowIndex: number) => void;
  currentSuggestion?: ProactiveSuggestion;
  onOperation?: (message: string, trigger?: boolean) => void;
}

const MultiTableEditor: React.FC<MultiTableEditorProps> = ({
  initialTableId,
  instances,
  htmlContext,
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
  onUpdateColumnType,
  onUpdateColumnName,
  onLiftRowToHeader,
  currentSuggestion,
  onOperation,
}) => {
  // State for managing multiple open tables
  const [openTables, setOpenTables] = useState<OpenTable[]>(() => {
    if (!initialTableId) return [];
    const initialTable = instances.find(inst => 
      inst.id === initialTableId && inst.type === 'table'
    ) as TableInstance | undefined;
    
    if (!initialTable) return [];
    
    return [{
      id: initialTableId,
      instance: initialTable,
      isDirty: false,
      originalName: `Table ${initialTableId.slice(0, 8)}`
    }];
  });

  const [activeTabId, setActiveTabId] = useState<string | null>(initialTableId);
  const [selectedCell, setSelectedCell] = useState<{ tableId: string; row: number; col: number } | null>(null);
  const [selectedRange, setSelectedRange] = useState<{ tableId: string; startRow: number; endRow: number; startCol: number; endCol: number } | null>(null);
  const [copiedData, setCopiedData] = useState<CopiedData | null>(null);
  const [showJoinPanel, setShowJoinPanel] = useState(false);
  const [showTableSelector, setShowTableSelector] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // Sync openTables with the latest instances from parent
  useEffect(() => {
    setOpenTables(prev => prev.map(openTable => {
      // Find the updated instance from parent
      const updatedInstance = instances.find(inst => 
        inst.id === openTable.id && inst.type === 'table'
      ) as TableInstance | undefined;
      
      if (updatedInstance && updatedInstance !== openTable.instance) {
        console.log(`Syncing table ${openTable.id}: rows ${openTable.instance.rows} -> ${updatedInstance.rows}, cols ${openTable.instance.cols} -> ${updatedInstance.cols}`);
        return {
          ...openTable,
          instance: updatedInstance
        };
      }
      return openTable;
    }));
  }, [instances]);

  // Available tables that can be opened (not currently open)
  const availableTables = useMemo(() => {
    const openTableIds = new Set(openTables.map(t => t.id));
    return instances
      .filter(inst => inst.type === 'table' && !openTableIds.has(inst.id))
      .map(inst => inst as TableInstance);
  }, [instances, openTables]);

  // Join suggestions based on open tables
  const joinSuggestions = useMemo(() => {
    const suggestions: JoinSuggestion[] = [];
    
    for (let i = 0; i < openTables.length; i++) {
      for (let j = i + 1; j < openTables.length; j++) {
        const leftTable = openTables[i].instance;
        const rightTable = openTables[j].instance;
        
        // Simple heuristic: look for columns with similar names
        const leftColumnNames = leftTable.columnNames || [];
        const rightColumnNames = rightTable.columnNames || [];
        
        for (let leftCol = 0; leftCol < leftColumnNames.length; leftCol++) {
          for (let rightCol = 0; rightCol < rightColumnNames.length; rightCol++) {
            const leftName = leftColumnNames[leftCol]?.toLowerCase() || '';
            const rightName = rightColumnNames[rightCol]?.toLowerCase() || '';
            
            // Check for exact match or common join patterns
            const isMatch = leftName === rightName || 
              (leftName.includes('id') && rightName.includes('id')) ||
              (leftName.includes('key') && rightName.includes('key'));
            
            if (isMatch) {
              suggestions.push({
                leftTableId: leftTable.id,
                rightTableId: rightTable.id,
                leftColumn: leftColumnNames[leftCol] || `Column ${leftCol + 1}`,
                rightColumn: rightColumnNames[rightCol] || `Column ${rightCol + 1}`,
                joinType: 'inner',
                confidence: leftName === rightName ? 0.9 : 0.6
              });
            }
          }
        }
      }
    }
    
    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }, [openTables]);

  // Function to open a new table
  const openTable = useCallback((tableId: string) => {
    const table = instances.find(inst => 
      inst.id === tableId && inst.type === 'table'
    ) as TableInstance | undefined;
    
    if (!table) return;
    
    const newOpenTable: OpenTable = {
      id: tableId,
      instance: table,
      isDirty: false,
      originalName: `Table ${tableId.slice(0, 8)}`
    };
    
    setOpenTables(prev => [...prev, newOpenTable]);
    setActiveTabId(tableId);
    setShowTableSelector(false);
  }, [instances]);

  // Function to close a table
  const closeTable = useCallback((tableId: string) => {
    const table = openTables.find(t => t.id === tableId);
    if (table && table.isDirty) {
      // Show confirmation dialog for unsaved changes
      if (!confirm(`Table "${table.originalName}" has unsaved changes. Close anyway?`)) {
        return;
      }
    }
    
    setOpenTables(prev => prev.filter(t => t.id !== tableId));
    
    // If closing active tab, switch to first remaining tab
    if (activeTabId === tableId) {
      const remaining = openTables.filter(t => t.id !== tableId);
      setActiveTabId(remaining.length > 0 ? remaining[0].id : null);
    }
  }, [openTables, activeTabId]);

  // Function to mark table as dirty
  const markTableDirty = useCallback((tableId: string) => {
    setOpenTables(prev => prev.map(t => 
      t.id === tableId ? { ...t, isDirty: true } : t
    ));
  }, []);

  // Enhanced handlers that work with multiple tables
  const handleAddToTable = useCallback((instance: Instance, row: number, col: number) => {
    if (!activeTabId) return;
    onAddToTable(activeTabId, instance, row, col);
    markTableDirty(activeTabId);
  }, [activeTabId, onAddToTable, markTableDirty]);

  const handleRemoveCellContent = useCallback((row: number, col: number) => {
    if (!activeTabId) return;
    onRemoveCellContent(activeTabId, row, col);
    markTableDirty(activeTabId);
  }, [activeTabId, onRemoveCellContent, markTableDirty]);

  const handleEditCellContent = useCallback((row: number, col: number, newValue: string) => {
    if (!activeTabId) return;
    onEditCellContent(activeTabId, row, col, newValue);
    markTableDirty(activeTabId);
  }, [activeTabId, onEditCellContent, markTableDirty]);

  // Enhanced copy functionality
  const handleCopy = useCallback(() => {
    if (!activeTabId) return;
    
    const table = openTables.find(t => t.id === activeTabId)?.instance;
    if (!table) return;
    
    let dataRange = null;
    
    // Determine what to copy based on selection
    if (selectedRange && selectedRange.tableId === activeTabId) {
      // Copy range
      dataRange = selectedRange;
    } else if (selectedCell && selectedCell.tableId === activeTabId) {
      // Copy single cell
      dataRange = {
        tableId: activeTabId,
        startRow: selectedCell.row,
        endRow: selectedCell.row,
        startCol: selectedCell.col,
        endCol: selectedCell.col
      };
    } else {
      return;
    }
    
    // Extract data from range
    const data: string[][] = [];
    for (let row = dataRange.startRow; row <= dataRange.endRow; row++) {
      const rowData: string[] = [];
      for (let col = dataRange.startCol; col <= dataRange.endCol; col++) {
        const cell = table.cells[row]?.[col];
        rowData.push(cell && cell.type === 'text' ? cell.content : '');
      }
      data.push(rowData);
    }
    
    setCopiedData({
      type: 'region',
      data,
      sourceTableId: activeTabId,
      sourceRange: {
        startRow: dataRange.startRow,
        endRow: dataRange.endRow,
        startCol: dataRange.startCol,
        endCol: dataRange.endCol
      }
    });
    
    // Copy to system clipboard as TSV (tab-separated values)
    const tsvData = data.map(row => row.join('\t')).join('\n');
    navigator.clipboard?.writeText(tsvData);
  }, [selectedCell, selectedRange, activeTabId, openTables]);

  // Enhanced paste functionality
  const handlePaste = useCallback(async () => {
    if (!activeTabId) return;
    
    let pasteTarget = null;
    
    // Determine where to paste
    if (selectedRange && selectedRange.tableId === activeTabId) {
      pasteTarget = { 
        startRow: selectedRange.startRow, 
        startCol: selectedRange.startCol 
      };
    } else if (selectedCell && selectedCell.tableId === activeTabId) {
      pasteTarget = { 
        startRow: selectedCell.row, 
        startCol: selectedCell.col 
      };
    } else {
      return;
    }
    
    let dataToPaste: string[][] = [];
    
    // Try to get data from our internal clipboard first
    if (copiedData) {
      dataToPaste = copiedData.data;
    } else {
      // Fallback to system clipboard - parse TSV
      try {
        const clipboardText = await navigator.clipboard.readText();
        dataToPaste = clipboardText.split('\n').map(row => row.split('\t'));
      } catch (error) {
        console.warn('Could not access clipboard:', error);
        return;
      }
    }
    
    // Paste data starting from the target position
    const currentActiveTabId = activeTabId;
    
    // Use setTimeout with 0 delay to batch DOM updates
    setTimeout(() => {
      for (let dataRow = 0; dataRow < dataToPaste.length; dataRow++) {
        const targetRow = pasteTarget.startRow + dataRow;
        for (let dataCol = 0; dataCol < dataToPaste[dataRow].length; dataCol++) {
          const targetCol = pasteTarget.startCol + dataCol;
          const cellValue = dataToPaste[dataRow][dataCol];
          
          if (cellValue) {
            onEditCellContent(currentActiveTabId, targetRow, targetCol, cellValue);
          }
        }
      }
      markTableDirty(currentActiveTabId);
    }, 0);
  }, [copiedData, selectedCell, selectedRange, activeTabId, onEditCellContent, markTableDirty]);


  // Row/Column copy handlers for context menu
  const handleRowCopy = useCallback((rowIndex: number) => {
    if (!activeTabId) return;
    
    const table = openTables.find(t => t.id === activeTabId)?.instance;
    if (!table) return;
    
    const rowCells = [];
    const rowStringData = [];
    const row = table.cells[rowIndex];
    if (row) {
      for (let col = 0; col < table.cols; col++) {
        const cell = row[col];
        rowCells.push(cell); // Store the full cell instance
        // For clipboard, convert to string representation
        if (cell) {
          switch (cell.type) {
            case 'text':
              rowStringData.push(cell.content);
              break;
            case 'image':
              rowStringData.push(`[IMAGE: ${cell.src}]`);
              break;
            case 'sketch':
              rowStringData.push('[SKETCH]');
              break;
            case 'table':
              rowStringData.push('[TABLE]');
              break;
            case 'visualization':
              rowStringData.push('[VISUALIZATION]');
              break;
            default:
              rowStringData.push('');
          }
        } else {
          rowStringData.push('');
        }
      }
    }
    
    setCopiedData({
      type: 'rows',
      data: [rowCells], // Store full cell instances for internal operations
      sourceTableId: activeTabId,
      sourceRange: {
        startRow: rowIndex,
        endRow: rowIndex,
        startCol: 0,
        endCol: table.cols - 1
      }
    });
    
    // Copy string representation to system clipboard
    navigator.clipboard?.writeText(rowStringData.join('\t'));
  }, [activeTabId, openTables]);

  const handleColumnCopy = useCallback((colIndex: number) => {
    if (!activeTabId) return;
    
    const table = openTables.find(t => t.id === activeTabId)?.instance;
    if (!table) return;
    
    const columnCells = [];
    const columnStringData = [];
    for (let row = 0; row < table.rows; row++) {
      const cell = table.cells[row]?.[colIndex];
      columnCells.push([cell]); // Store the full cell instance
      
      // For clipboard, convert to string representation
      if (cell) {
        switch (cell.type) {
          case 'text':
            columnStringData.push(cell.content);
            break;
          case 'image':
            columnStringData.push(`[IMAGE: ${cell.src}]`);
            break;
          case 'sketch':
            columnStringData.push('[SKETCH]');
            break;
          case 'table':
            columnStringData.push('[TABLE]');
            break;
          case 'visualization':
            columnStringData.push('[VISUALIZATION]');
            break;
          default:
            columnStringData.push('');
        }
      } else {
        columnStringData.push('');
      }
    }
    
    setCopiedData({
      type: 'columns',
      data: columnCells, // Store full cell instances for internal operations
      sourceTableId: activeTabId,
      sourceRange: {
        startRow: 0,
        endRow: table.rows - 1,
        startCol: colIndex,
        endCol: colIndex
      }
    });
    
    // Copy string representation to system clipboard
    navigator.clipboard?.writeText(columnStringData.join('\n'));
  }, [activeTabId, openTables]);

  // Paste to row/column handlers
  const handleRowPaste = useCallback((rowIndex: number) => {
    if (!copiedData || !activeTabId) return;
    
    if (copiedData.type === 'rows' && copiedData.data.length > 0) {
      const rowCells = copiedData.data[0]; // Full cell instances
      const currentActiveTabId = activeTabId;
      const sourceRowIndex = copiedData.sourceRange.startRow;
      
      // Log the operation as a single row copy
      if (onOperation) {
        onOperation(`Copy row ${sourceRowIndex + 1} to row ${rowIndex + 1} in table "${currentActiveTabId}"`);
      }
      
      // Batch all operations into a single async operation to minimize re-renders
      setTimeout(() => {
        // Process all cells in the row as a single batched operation
        for (let col = 0; col < rowCells.length; col++) {
          const cell = rowCells[col];
          if (cell) {
            if (cell.type === 'text') {
              // For text cells, use editCellContent
              onEditCellContent(currentActiveTabId, rowIndex, col, cell.content);
            } else {
              // For non-text cells (images, sketches, etc.), use addToTable to preserve the full instance
              onAddToTable(currentActiveTabId, cell, rowIndex, col);
            }
          } else {
            // Clear the cell if source was empty
            onRemoveCellContent(currentActiveTabId, rowIndex, col);
          }
        }
        markTableDirty(currentActiveTabId);
      }, 0);
    }
  }, [copiedData, activeTabId, onEditCellContent, onAddToTable, onRemoveCellContent, markTableDirty, onOperation]);

  const handleColumnPaste = useCallback((colIndex: number) => {
    if (!copiedData || !activeTabId) return;
    
    if (copiedData.type === 'columns' && copiedData.data.length > 0) {
      const currentActiveTabId = activeTabId;
      const columnCells = copiedData.data; // Array of [cell] arrays
      const sourceColIndex = copiedData.sourceRange.startCol;
      
      // Log the operation as a single column copy
      if (onOperation) {
        onOperation(`Copy column ${String.fromCharCode(65 + sourceColIndex)} to column ${String.fromCharCode(65 + colIndex)} in table "${currentActiveTabId}"`);
      }
      
      // Batch all operations into a single async operation to minimize re-renders
      setTimeout(() => {
        // Process all cells in the column as a single batched operation
        for (let row = 0; row < columnCells.length; row++) {
          const cell = columnCells[row][0]; // Extract cell from [cell] array
          if (cell) {
            if (cell.type === 'text') {
              // For text cells, use editCellContent
              onEditCellContent(currentActiveTabId, row, colIndex, cell.content);
            } else {
              // For non-text cells (images, sketches, etc.), use addToTable to preserve the full instance
              onAddToTable(currentActiveTabId, cell, row, colIndex);
            }
          } else {
            // Clear the cell if source was empty
            onRemoveCellContent(currentActiveTabId, row, colIndex);
          }
        }
        markTableDirty(currentActiveTabId);
      }, 0);
    }
  }, [copiedData, activeTabId, onEditCellContent, onAddToTable, onRemoveCellContent, markTableDirty, onOperation]);

  // Cell selection handler
  const handleCellSelectionChange = useCallback((cell: { row: number; col: number } | null) => {
    if (cell && activeTabId) {
      setSelectedCell({ tableId: activeTabId, ...cell });
      // Clear range selection when individual cell is selected
      setSelectedRange(null);
    } else {
      setSelectedCell(null);
    }
  }, [activeTabId]);

  // Range selection handler
  const handleRangeSelectionChange = useCallback((range: { startRow: number; endRow: number; startCol: number; endCol: number } | null) => {
    if (range && activeTabId) {
      setSelectedRange({ tableId: activeTabId, ...range });
      // Clear single cell selection when range is selected
      setSelectedCell(null);
    } else {
      setSelectedRange(null);
    }
  }, [activeTabId]);

  // Wrapped handlers for row/column operations that mark table as dirty
  const handleAddRowWrapped = useCallback((position: 'before' | 'after', rowIndex: number) => {
    if (!activeTabId || !onAddRow) return;
    onAddRow(activeTabId, position, rowIndex);
    markTableDirty(activeTabId);
  }, [activeTabId, onAddRow, markTableDirty]);

  const handleRemoveRowWrapped = useCallback((rowIndex: number) => {
    if (!activeTabId || !onRemoveRow) return;
    onRemoveRow(activeTabId, rowIndex);
    markTableDirty(activeTabId);
  }, [activeTabId, onRemoveRow, markTableDirty]);

  const handleAddColumnWrapped = useCallback((position: 'before' | 'after', colIndex: number) => {
    if (!activeTabId || !onAddColumn) return;
    onAddColumn(activeTabId, position, colIndex);
    markTableDirty(activeTabId);
  }, [activeTabId, onAddColumn, markTableDirty]);

  const handleRemoveColumnWrapped = useCallback((colIndex: number) => {
    if (!activeTabId || !onRemoveColumn) return;
    onRemoveColumn(activeTabId, colIndex);
    markTableDirty(activeTabId);
  }, [activeTabId, onRemoveColumn, markTableDirty]);

  const handleUpdateColumnTypeWrapped = useCallback((colIndex: number, columnType: 'numeral' | 'categorical') => {
    if (!activeTabId || !onUpdateColumnType) return;
    onUpdateColumnType(activeTabId, colIndex, columnType);
    markTableDirty(activeTabId);
  }, [activeTabId, onUpdateColumnType, markTableDirty]);

  const handleUpdateColumnNameWrapped = useCallback((colIndex: number, columnName: string) => {
    if (!activeTabId || !onUpdateColumnName) return;
    onUpdateColumnName(activeTabId, colIndex, columnName);
    markTableDirty(activeTabId);
  }, [activeTabId, onUpdateColumnName, markTableDirty]);

  const handleLiftRowToHeaderWrapped = useCallback((rowIndex: number) => {
    if (!activeTabId || !onLiftRowToHeader) return;
    onLiftRowToHeader(activeTabId, rowIndex);
    markTableDirty(activeTabId);
  }, [activeTabId, onLiftRowToHeader, markTableDirty]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'c') {
          e.preventDefault();
          handleCopy();
        } else if (e.key === 'v') {
          e.preventDefault();
          handlePaste();
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleCopy, handlePaste]);

  // Function to perform join operation
  const performJoin = useCallback((suggestion: JoinSuggestion) => {
    const leftTable = openTables.find(t => t.id === suggestion.leftTableId)?.instance;
    const rightTable = openTables.find(t => t.id === suggestion.rightTableId)?.instance;
    
    if (!leftTable || !rightTable) return;
    
    // Find column indices
    const leftColIndex = leftTable.columnNames?.findIndex(name => name === suggestion.leftColumn) ?? -1;
    const rightColIndex = rightTable.columnNames?.findIndex(name => name === suggestion.rightColumn) ?? -1;
    
    if (leftColIndex === -1 || rightColIndex === -1) {
      alert('Could not find matching columns for join');
      return;
    }
    
    // Perform the join based on type
    let joinedRows: any[][] = [];
    let joinedColumnNames: string[] = [];
    
    // Create combined column headers
    const leftNames = leftTable.columnNames || leftTable.cols ? Array.from({ length: leftTable.cols }, (_, i) => `L${i + 1}`) : [];
    const rightNames = rightTable.columnNames || rightTable.cols ? Array.from({ length: rightTable.cols }, (_, i) => `R${i + 1}`) : [];
    
    if (suggestion.joinType === 'union') {
      // Union: combine all rows (assuming same structure)
      joinedColumnNames = leftNames;
      joinedRows = [...leftTable.cells, ...rightTable.cells];
    } else {
      // Inner join implementation
      joinedColumnNames = [...leftNames, ...rightNames];
      
      for (let leftRow = 0; leftRow < leftTable.rows; leftRow++) {
        const leftRowData = leftTable.cells[leftRow] || [];
        const leftKeyCell = leftRowData[leftColIndex];
        const leftKey = leftKeyCell && leftKeyCell.type === 'text' ? leftKeyCell.content : '';
        
        if (!leftKey) continue;
        
        for (let rightRow = 0; rightRow < rightTable.rows; rightRow++) {
          const rightRowData = rightTable.cells[rightRow] || [];
          const rightKeyCell = rightRowData[rightColIndex];
          const rightKey = rightKeyCell && rightKeyCell.type === 'text' ? rightKeyCell.content : '';
          
          if (leftKey === rightKey) {
            // Match found - combine rows
            const combinedRow = [...leftRowData, ...rightRowData];
            joinedRows.push(combinedRow);
          }
        }
      }
    }
    
    if (joinedRows.length === 0) {
      alert('No matching rows found for join');
      return;
    }
    
    // Create new table instance
    const joinedTableId = `joined_${Date.now()}`;
    const joinedTable: TableInstance = {
      id: joinedTableId,
      type: 'table',
      source: { type: 'manual' }, // Required property
      rows: joinedRows.length,
      cols: joinedColumnNames.length,
      cells: joinedRows,
      columnNames: joinedColumnNames,
      columnTypes: [...(leftTable.columnTypes || []), ...(rightTable.columnTypes || [])],
      x: Math.max((leftTable.x || 0), (rightTable.x || 0)) + 50,
      y: Math.max((leftTable.y || 0), (rightTable.y || 0)) + 50,
      width: Math.max((leftTable.width || 400), 400),
      height: Math.max((leftTable.height || 300), 300)
    };
    
    // Add joined table to open tables
    const newOpenTable: OpenTable = {
      id: joinedTableId,
      instance: joinedTable,
      isDirty: true,
      isNew: true,
      originalName: `${openTables.find(t => t.id === suggestion.leftTableId)?.originalName || 'Left'} ${suggestion.joinType.toUpperCase()} ${openTables.find(t => t.id === suggestion.rightTableId)?.originalName || 'Right'}`
    };
    
    setOpenTables(prev => [...prev, newOpenTable]);
    setActiveTabId(joinedTableId);
    setShowJoinPanel(false);
    
    console.log('Created joined table:', joinedTable);
  }, [openTables]);

  // Function to save all tables
  const handleSaveAll = useCallback(() => {
    if (openTables.some(t => t.isDirty)) {
      setShowSaveDialog(true);
    } else {
      // No changes to save
      onCancel();
    }
  }, [openTables, onCancel]);

  // Get active table
  const activeTable = useMemo(() => {
    return openTables.find(t => t.id === activeTabId);
  }, [openTables, activeTabId]);

  if (openTables.length === 0) {
    return (
      <div className="view-container">
        <div className="view-title-container">
          <h3>No Tables Open</h3>
          <button onClick={onCancel}>Close</button>
        </div>
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <p>Select a table to start editing</p>
          <button onClick={() => setShowTableSelector(true)}>Open Table</button>
        </div>
      </div>
    );
  }

  return (
    <div className="view-container" style={{ position: 'relative' }}>
      {/* Tab Bar */}
      <div className="tab-bar" style={{ 
        display: 'flex', 
        borderBottom: '1px solid #ccc',
        backgroundColor: '#f5f5f5'
      }}>
        {openTables.map(table => (
          <div
            key={table.id}
            className={`tab ${activeTabId === table.id ? 'active' : ''}`}
            onClick={() => setActiveTabId(table.id)}
            style={{
              padding: '8px 16px',
              border: '1px solid #ccc',
              borderBottom: activeTabId === table.id ? 'none' : '1px solid #ccc',
              backgroundColor: activeTabId === table.id ? 'white' : '#f0f0f0',
              cursor: 'pointer',
              position: 'relative'
            }}
          >
            <span>{table.originalName}</span>
            {table.isDirty && <span style={{ color: 'orange' }}>●</span>}
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeTable(table.id);
              }}
              style={{
                marginLeft: '8px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                color: 'black'
              }}
            >
              ×
            </button>
          </div>
        ))}
        
        {/* Add Table Button */}
        <button
          onClick={() => setShowTableSelector(true)}
          style={{
            border: '1px solid #ccc',
            cursor: 'pointer'
          }}
        >
          + Open Table
        </button>
      </div>

      {/* Main Controls */}
      <div className="view-title-container">
        <h3 style={{ margin: 0 }}>
          {activeTable?.originalName || 'Table Editor'}
        </h3>
        
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {openTables.length > 1 && (
            <button 
              onClick={() => setShowJoinPanel(!showJoinPanel)}
              style={{ backgroundColor: joinSuggestions.length > 0 ? '#e3f2fd' : undefined }}
            >
              Join Tables {joinSuggestions.length > 0 && `(${joinSuggestions.length})`}
            </button>
          )}
          
          
          <button onClick={handleSaveAll}>
            Save {openTables.filter(t => t.isDirty).length > 0 && `(${openTables.filter(t => t.isDirty).length})`}
          </button>
          
          <button onClick={onCancel}>Cancel</button>
          
          {selectedCell && onCaptureToCell && (
            <button 
              onClick={() => onCaptureToCell?.(selectedCell.tableId, selectedCell.row, selectedCell.col)}
              disabled={!isCaptureEnabled}
            >
              Capture to Cell ({selectedCell.row + 1}, {String.fromCharCode(65 + selectedCell.col)})
            </button>
          )}
        </div>
      </div>

      {/* Join Panel */}
      {showJoinPanel && openTables.length > 1 && (
        <div className="join-panel" style={{
          backgroundColor: '#f9f9f9',
          border: '1px solid #ddd',
          borderRadius: '4px',
          padding: '12px',
          margin: '8px 0'
        }}>
          <h4 style={{ margin: '0 0 8px 0' }}>Join Suggestions</h4>
          {joinSuggestions.length > 0 ? (
            <div>
              {joinSuggestions.slice(0, 3).map((suggestion, index) => (
                <div key={index} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px',
                  backgroundColor: 'white',
                  border: '1px solid #eee',
                  borderRadius: '4px',
                  marginBottom: '4px'
                }}>
                  <span>
                    {openTables.find(t => t.id === suggestion.leftTableId)?.originalName}.{suggestion.leftColumn}
                    {' ↔ '}
                    {openTables.find(t => t.id === suggestion.rightTableId)?.originalName}.{suggestion.rightColumn}
                  </span>
                  <button 
                    onClick={() => performJoin(suggestion)}
                    style={{ fontSize: '12px', padding: '4px 8px' }}
                  >
                    {suggestion.joinType.toUpperCase()} JOIN
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, color: '#666' }}>No obvious join relationships detected</p>
          )}
        </div>
      )}

      {/* Active Table Content */}
      {activeTable && (
        <div className="table-container" style={{ position: 'relative' }}>
          <TableGrid
            table={activeTable.instance}
            instances={instances}
            onAddToTable={handleAddToTable}
            onRemoveCellContent={handleRemoveCellContent}
            setDraggingInstanceId={setDraggingInstanceId}
            onEditCellContent={handleEditCellContent}
            onCellSelectionChange={handleCellSelectionChange}
            // Copy/paste handlers for context menus
            onCopyRow={handleRowCopy}
            onCopyColumn={handleColumnCopy}
            onPasteToRow={copiedData ? handleRowPaste : undefined}
            onPasteToColumn={copiedData ? handleColumnPaste : undefined}
            // Range selection
            selectedRange={selectedRange && selectedRange.tableId === activeTabId ? {
              startRow: selectedRange.startRow,
              endRow: selectedRange.endRow,
              startCol: selectedRange.startCol,
              endCol: selectedRange.endCol
            } : null}
            onRangeSelectionChange={handleRangeSelectionChange}
            onAddRow={onAddRow ? handleAddRowWrapped : undefined}
            onRemoveRow={onRemoveRow ? handleRemoveRowWrapped : undefined}
            onAddColumn={onAddColumn ? handleAddColumnWrapped : undefined}
            onRemoveColumn={onRemoveColumn ? handleRemoveColumnWrapped : undefined}
            onUpdateColumnType={onUpdateColumnType ? handleUpdateColumnTypeWrapped : undefined}
            onUpdateColumnName={onUpdateColumnName ? handleUpdateColumnNameWrapped : undefined}
            onLiftRowToHeader={onLiftRowToHeader ? handleLiftRowToHeaderWrapped : undefined}
            currentSuggestion={currentSuggestion}
            onAcceptSuggestion={() => {
              if (currentSuggestion) {
                console.log('Accepting suggestion:', currentSuggestion);
              }
            }}
            onDismissSuggestion={() => {
              console.log('Dismissing suggestion');
            }}
          />
        </div>
      )}

      {/* Available Instances */}
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

      {/* Table Selector Modal */}
      {showTableSelector && (
        <div className="modal-overlay" style={{
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
        }}>
          <div className="modal-content" style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            minWidth: '400px',
            maxHeight: '60vh',
            overflow: 'auto'
          }}>
            <h3>Select Table to Open</h3>
            <div style={{ marginBottom: '16px' }}>
              {availableTables.map(table => (
                <div
                  key={table.id}
                  onClick={() => openTable(table.id)}
                  style={{
                    padding: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    marginBottom: '8px',
                    cursor: 'pointer',
                    backgroundColor: '#f9f9f9'
                  }}
                >
                  <strong>{`Table ${table.id.slice(0, 8)}`}</strong>
                  <br />
                  <small>{table.rows} rows × {table.cols} columns</small>
                </div>
              ))}
              {availableTables.length === 0 && (
                <p style={{ color: '#666' }}>All available tables are already open</p>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowTableSelector(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="modal-overlay" style={{
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
        }}>
          <div className="modal-content" style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '8px',
            minWidth: '400px',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h3 style={{ marginTop: 0 }}>Save Changes</h3>
            <p>The following tables have unsaved changes:</p>
            
            <div style={{ marginBottom: '20px' }}>
              {openTables.filter(t => t.isDirty).map(table => (
                <div key={table.id} style={{
                  padding: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  marginBottom: '8px',
                  backgroundColor: '#f9f9f9'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>{table.originalName}</strong>
                      {table.isNew && <span style={{ color: '#007acc', marginLeft: '8px' }}>(New Table)</span>}
                      <br />
                      <small style={{ color: '#666' }}>
                        {table.instance.rows} rows × {table.instance.cols} columns
                      </small>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        onClick={() => {
                          onSaveTable(table.id, table.originalName);
                          setOpenTables(prev => prev.map(t => 
                            t.id === table.id ? { ...t, isDirty: false } : t
                          ));
                        }}
                        style={{
                          fontSize: '12px',
                          padding: '4px 12px',
                          backgroundColor: '#007acc',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px'
                        }}
                      >
                        Save
                      </button>
                      
                      {table.isNew && (
                        <button 
                          onClick={() => {
                            setOpenTables(prev => prev.filter(t => t.id !== table.id));
                            if (activeTabId === table.id) {
                              const remaining = openTables.filter(t => t.id !== table.id && !t.isDirty);
                              setActiveTabId(remaining.length > 0 ? remaining[0].id : null);
                            }
                          }}
                          style={{
                            fontSize: '12px',
                            padding: '4px 12px',
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px'
                          }}
                        >
                          Discard
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {/* Show preview of changes for existing tables */}
                  {!table.isNew && (
                    <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                      Modified table structure or content
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', borderTop: '1px solid #eee', paddingTop: '16px' }}>
              <button 
                onClick={() => setShowSaveDialog(false)}
                style={{ padding: '8px 16px' }}
              >
                Cancel
              </button>
              
              <button 
                onClick={() => {
                  openTables.filter(t => t.isDirty).forEach(table => {
                    onSaveTable(table.id, table.originalName);
                  });
                  setShowSaveDialog(false);
                  onCancel();
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px'
                }}
              >
                Save All & Close
              </button>
              
              <button 
                onClick={() => {
                  if (confirm('Are you sure you want to discard all unsaved changes?')) {
                    setShowSaveDialog(false);
                    onCancel();
                  }
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px'
                }}
              >
                Discard All Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiTableEditor;