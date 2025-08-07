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
  data: any[][];
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
      originalName: initialTable.name || `Table ${initialTableId.slice(0, 8)}`
    }];
  });

  const [activeTabId, setActiveTabId] = useState<string | null>(initialTableId);
  const [selectedCell, setSelectedCell] = useState<{ tableId: string; row: number; col: number } | null>(null);
  const [copiedData, setCopiedData] = useState<CopiedData | null>(null);
  const [showJoinPanel, setShowJoinPanel] = useState(false);
  const [showTableSelector, setShowTableSelector] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);

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
      originalName: table.name || `Table ${tableId.slice(0, 8)}`
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
    if (!selectedCell) return;
    
    const table = openTables.find(t => t.id === selectedCell.tableId)?.instance;
    if (!table) return;
    
    // For now, copy single cell - extend for ranges later
    const cell = table.cells[selectedCell.row]?.[selectedCell.col];
    const cellData = cell && cell.type === 'text' ? cell.content : '';
    
    setCopiedData({
      type: 'cells',
      data: [[cellData]],
      sourceTableId: selectedCell.tableId,
      sourceRange: {
        startRow: selectedCell.row,
        endRow: selectedCell.row,
        startCol: selectedCell.col,
        endCol: selectedCell.col
      }
    });
    
    // Also copy to system clipboard
    navigator.clipboard?.writeText(cellData);
  }, [selectedCell, openTables]);

  // Enhanced paste functionality
  const handlePaste = useCallback(async () => {
    if (!selectedCell || !activeTabId) return;
    
    let dataToPaste = '';
    
    // Try to get data from our internal clipboard first
    if (copiedData) {
      dataToPaste = copiedData.data[0][0];
    } else {
      // Fallback to system clipboard
      try {
        dataToPaste = await navigator.clipboard.readText();
      } catch (error) {
        console.warn('Could not access clipboard:', error);
        return;
      }
    }
    
    handleEditCellContent(selectedCell.row, selectedCell.col, dataToPaste);
  }, [copiedData, selectedCell, activeTabId, handleEditCellContent]);

  // Copy entire row
  const handleCopyRow = useCallback(() => {
    if (!selectedCell) return;
    
    const table = openTables.find(t => t.id === selectedCell.tableId)?.instance;
    if (!table) return;
    
    const row = table.cells[selectedCell.row];
    if (!row) return;
    
    const rowData = row.map(cell => cell && cell.type === 'text' ? cell.content : '');
    
    setCopiedData({
      type: 'rows',
      data: [rowData],
      sourceTableId: selectedCell.tableId,
      sourceRange: {
        startRow: selectedCell.row,
        endRow: selectedCell.row,
        startCol: 0,
        endCol: table.cols - 1
      }
    });
    
    // Copy as tab-separated values
    navigator.clipboard?.writeText(rowData.join('\t'));
  }, [selectedCell, openTables]);

  // Copy entire column
  const handleCopyColumn = useCallback(() => {
    if (!selectedCell) return;
    
    const table = openTables.find(t => t.id === selectedCell.tableId)?.instance;
    if (!table) return;
    
    const columnData = [];
    for (let row = 0; row < table.rows; row++) {
      const cell = table.cells[row]?.[selectedCell.col];
      columnData.push([cell && cell.type === 'text' ? cell.content : '']);
    }
    
    setCopiedData({
      type: 'columns',
      data: columnData,
      sourceTableId: selectedCell.tableId,
      sourceRange: {
        startRow: 0,
        endRow: table.rows - 1,
        startCol: selectedCell.col,
        endCol: selectedCell.col
      }
    });
    
    // Copy as line-separated values
    navigator.clipboard?.writeText(columnData.map(row => row[0]).join('\n'));
  }, [selectedCell, openTables]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'c') {
          e.preventDefault();
          if (e.shiftKey) {
            handleCopyRow();
          } else if (e.altKey) {
            handleCopyColumn();
          } else {
            handleCopy();
          }
        } else if (e.key === 'v') {
          e.preventDefault();
          handlePaste();
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleCopy, handlePaste, handleCopyRow, handleCopyColumn]);

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
      name: `${leftTable.name || 'Left'} ${suggestion.joinType.toUpperCase()} ${rightTable.name || 'Right'}`,
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
      originalName: joinedTable.name
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
                fontSize: '14px'
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
            padding: '8px 16px',
            border: '1px solid #ccc',
            backgroundColor: '#f0f0f0',
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
          
          {/* Copy/Paste Controls */}
          {selectedCell && (
            <div style={{ display: 'flex', gap: '4px', borderLeft: '1px solid #ddd', paddingLeft: '8px' }}>
              <button 
                onClick={handleCopy}
                title="Copy cell (Ctrl+C)"
                style={{ fontSize: '12px', padding: '4px 8px' }}
              >
                Copy
              </button>
              <button 
                onClick={handleCopyRow}
                title="Copy row (Ctrl+Shift+C)"
                style={{ fontSize: '12px', padding: '4px 8px' }}
              >
                Copy Row
              </button>
              <button 
                onClick={handleCopyColumn}
                title="Copy column (Ctrl+Alt+C)"
                style={{ fontSize: '12px', padding: '4px 8px' }}
              >
                Copy Col
              </button>
              {copiedData && (
                <button 
                  onClick={handlePaste}
                  title="Paste (Ctrl+V)"
                  style={{ fontSize: '12px', padding: '4px 8px', backgroundColor: '#e8f5e8' }}
                >
                  Paste
                </button>
              )}
            </div>
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
            onCellSelectionChange={(cell) => {
              if (cell) {
                setSelectedCell({ tableId: activeTabId!, ...cell });
              } else {
                setSelectedCell(null);
              }
            }}
            onAddRow={onAddRow ? (pos, idx) => onAddRow(activeTabId!, pos, idx) : undefined}
            onRemoveRow={onRemoveRow ? (idx) => onRemoveRow(activeTabId!, idx) : undefined}
            onAddColumn={onAddColumn ? (pos, idx) => onAddColumn(activeTabId!, pos, idx) : undefined}
            onRemoveColumn={onRemoveColumn ? (idx) => onRemoveColumn(activeTabId!, idx) : undefined}
            onUpdateColumnType={onUpdateColumnType ? (idx, type) => onUpdateColumnType(activeTabId!, idx, type) : undefined}
            onUpdateColumnName={onUpdateColumnName ? (idx, name) => onUpdateColumnName(activeTabId!, idx, name) : undefined}
            onLiftRowToHeader={onLiftRowToHeader ? (idx) => onLiftRowToHeader(activeTabId!, idx) : undefined}
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
                  <strong>{table.name || `Table ${table.id.slice(0, 8)}`}</strong>
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
            minWidth: '500px',
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