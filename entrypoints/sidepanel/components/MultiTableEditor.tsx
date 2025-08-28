// MultiTableEditor.tsx
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { browser } from 'wxt/browser';
import TableGrid from './tablegrid';
import { TableInstance, Instance, ProactiveSuggestion, ColumnType } from '../types';
import { indexToLetters, normalizeTableInstance } from '../utils';
import './MultiTableEditor.css';

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
  leftColumnIndex: number;
  rightColumnIndex: number;
  joinType: 'inner' | 'left' | 'right' | 'full' | 'union';
  confidence: number;
}

interface CopiedData {
  type: 'cells' | 'rows' | 'columns' | 'region' | 'table';
  data: any[][]; // Full cell instances for all copy types
  stringData: string[][]; // String representation for system clipboard
  sourceTableId: string;
  sourceRange: { startRow: number; endRow: number; startCol: number; endCol: number };
  tableMetadata?: { // For whole table copies
    columnNames: string[]; // Required
    columnTypes: ('numeral' | 'categorical')[]; // Required
    rows: number;
    cols: number;
  };
}

interface MultiTableEditorProps {
  initialTableId: string | null;
  instances: Instance[];
  htmlContext: Record<string, {pageURL: string, htmlContent: string}>;
  onSaveTable: (tableId: string, tableName?: string, isDirty?: boolean) => string | null;
  onCancel: () => void;
  onClose: () => void;
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
  onOperation?: (message: string, actionDetails?: {
    type: string;
    context?: any;
    instanceId?: string;
    metadata?: any;
  }) => void;
  setIsInEditor?: React.Dispatch<React.SetStateAction<boolean>>; // For tracking editor state
}

const MultiTableEditor: React.FC<MultiTableEditorProps> = ({
  initialTableId,
  instances,
  htmlContext,
  onSaveTable,
  onCancel,
  onClose,
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
  setIsInEditor,
}) => {
  console.log('[MultiTableEditor] Component loaded with setIsInEditor:', !!setIsInEditor);
  // State for managing multiple open tables
  const [openTables, setOpenTables] = useState<OpenTable[]>(() => {
    if (!initialTableId) return [];
    const initialTable = instances.find(inst => 
      inst.id === initialTableId && inst.type === 'table'
    ) as TableInstance | undefined;
    
    if (!initialTable) return [];
    
    // Normalize the table to ensure it has required columnNames and columnTypes
    const normalizedTable = normalizeTableInstance(initialTable) as TableInstance;
    
    return [{
      id: initialTableId,
      instance: normalizedTable,
      isDirty: false,
      originalName: initialTableId.slice(0, 8)
    }];
  });

  const [activeTabId, setActiveTabId] = useState<string | null>(initialTableId);
  const [selectedCell, setSelectedCell] = useState<{ tableId: string; row: number; col: number; originalRow?: number } | null>(null);
  const [selectedRange, setSelectedRange] = useState<{ tableId: string; startRow: number; endRow: number; startCol: number; endCol: number } | null>(null);
  const [copiedData, setCopiedData] = useState<CopiedData | null>(null);
  const [showJoinPanel, setShowJoinPanel] = useState(false);
  const [showTableSelector, setShowTableSelector] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showManualJoin, setShowManualJoin] = useState(false);
  const [manualJoin, setManualJoin] = useState({
    leftTableId: '',
    rightTableId: '',
    leftColumn: '',
    rightColumn: '',
    leftColumnIndex: -1,
    rightColumnIndex: -1,
    joinType: 'inner' as 'inner' | 'left' | 'right' | 'full' | 'union'
  });

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
    }).filter(openTable => {
      // Remove tables that no longer exist in instances (they may have had ID changes)
      return instances.some(inst => inst.id === openTable.id && inst.type === 'table');
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
        
        const leftColumnNames = leftTable.columnNames || [];
        const rightColumnNames = rightTable.columnNames || [];
        
        for (let leftCol = 0; leftCol < leftTable.cols; leftCol++) {
          for (let rightCol = 0; rightCol < rightTable.cols; rightCol++) {
            const leftName = leftColumnNames[leftCol]?.toLowerCase() || '';
            const rightName = rightColumnNames[rightCol]?.toLowerCase() || '';
            
            let confidence = 0;
            let isMatch = false;
            
            // Check for exact column name match
            if (leftName === rightName && leftName !== '') {
              isMatch = true;
              confidence = 0.9;
            }
            // Check for common join patterns in names
            else if ((leftName.includes('id') && rightName.includes('id')) ||
                     (leftName.includes('key') && rightName.includes('key'))) {
              isMatch = true;
              confidence = 0.6;
            }
            // Check for matching values in columns (new logic)
            else {
              const leftValues = new Set<string>();
              const rightValues = new Set<string>();
              
              // Collect all text values from left column
              for (let row = 0; row < leftTable.rows; row++) {
                const cell = leftTable.cells[row]?.[leftCol];
                if (cell && cell.type === 'text' && cell.content && cell.content.trim()) {
                  leftValues.add(cell.content.trim().toLowerCase());
                }
              }
              
              // Collect all text values from right column  
              for (let row = 0; row < rightTable.rows; row++) {
                const cell = rightTable.cells[row]?.[rightCol];
                if (cell && cell.type === 'text' && cell.content && cell.content.trim()) {
                  rightValues.add(cell.content.trim().toLowerCase());
                }
              }
              
              // Calculate overlap
              if (leftValues.size > 0 && rightValues.size > 0) {
                const intersection = new Set([...leftValues].filter(val => rightValues.has(val)));
                const overlapRatio = intersection.size / Math.min(leftValues.size, rightValues.size);
                
                // Consider it a match if there's significant overlap
                if (overlapRatio >= 0.3) {
                  isMatch = true;
                  confidence = 0.4 + (overlapRatio * 0.4); // 0.4 to 0.8 based on overlap
                }
              }
            }
            
            if (isMatch) {
              suggestions.push({
                leftTableId: leftTable.id,
                rightTableId: rightTable.id,
                leftColumn: leftColumnNames[leftCol] || `Column ${leftCol + 1}`,
                rightColumn: rightColumnNames[rightCol] || `Column ${rightCol + 1}`,
                leftColumnIndex: leftCol,
                rightColumnIndex: rightCol,
                joinType: 'inner',
                confidence
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
      instance: normalizeTableInstance(table),
      isDirty: false,
      originalName: tableId.slice(0, 8)
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
    console.log(`[MultiTableEditor] Marking table ${tableId} as dirty`);
    setOpenTables(prev => prev.map(t => 
      t.id === tableId ? { ...t, isDirty: true } : t
    ));
  }, []);

  // Enhanced handlers that work with multiple tables
  const handleAddToTable = useCallback((instance: Instance, row: number, col: number) => {
    console.log(`[MultiTableEditor] handleAddToTable called: activeTabId=${activeTabId}, row=${row}, col=${col}`);
    if (!activeTabId) {
      console.log(`[MultiTableEditor] No activeTabId, returning`);
      return;
    }
    console.log(`[MultiTableEditor] Calling onAddToTable for ${activeTabId}`);
    onAddToTable(activeTabId, instance, row, col);
    console.log(`[MultiTableEditor] Calling markTableDirty for ${activeTabId}`);
    markTableDirty(activeTabId);
  }, [activeTabId, onAddToTable, markTableDirty]);

  const handleRemoveCellContent = useCallback((row: number, col: number) => {
    console.log(`[MultiTableEditor] handleRemoveCellContent called: activeTabId=${activeTabId}, row=${row}, col=${col}`);
    if (!activeTabId) {
      console.log(`[MultiTableEditor] No activeTabId, returning`);
      return;
    }
    console.log(`[MultiTableEditor] Calling onRemoveCellContent for ${activeTabId}`);
    onRemoveCellContent(activeTabId, row, col);
    console.log(`[MultiTableEditor] Calling markTableDirty for ${activeTabId}`);
    markTableDirty(activeTabId);
  }, [activeTabId, onRemoveCellContent, markTableDirty]);

  const handleEditCellContent = useCallback((row: number, col: number, newValue: string) => {
    console.log(`[MultiTableEditor] handleEditCellContent called: activeTabId=${activeTabId}, row=${row}, col=${col}, newValue="${newValue}"`);
    if (!activeTabId) {
      console.log(`[MultiTableEditor] No activeTabId, returning`);
      return;
    }
    console.log(`[MultiTableEditor] Calling onEditCellContent for ${activeTabId}`);
    onEditCellContent(activeTabId, row, col, newValue);
    console.log(`[MultiTableEditor] Calling markTableDirty for ${activeTabId}`);
    markTableDirty(activeTabId);
  }, [activeTabId, onEditCellContent, markTableDirty]);

  // Enhanced copy functionality
  const handleCopy = useCallback(() => {
    console.log('=== COPY OPERATION START ===');
    console.log('activeTabId:', activeTabId);
    console.log('selectedRange:', selectedRange);
    console.log('selectedCell:', selectedCell);
    
    if (!activeTabId) {
      console.log('No active tab, aborting copy');
      return;
    }
    
    const table = openTables.find(t => t.id === activeTabId)?.instance;
    if (!table) {
      console.log('No table found for activeTabId:', activeTabId);
      return;
    }
    
    console.log('Table found:', { id: table.id, rows: table.rows, cols: table.cols });
    
    let dataRange = null;
    
    // Determine what to copy based on selection
    if (selectedRange && selectedRange.tableId === activeTabId) {
      // Copy range (including whole table if range covers all cells)
      dataRange = selectedRange;
      console.log('Copying range:', dataRange);
    } else if (selectedCell && selectedCell.tableId === activeTabId) {
      // Copy single cell
      dataRange = {
        tableId: activeTabId,
        startRow: selectedCell.row,
        endRow: selectedCell.row,
        startCol: selectedCell.col,
        endCol: selectedCell.col
      };
      console.log('Copying single cell:', dataRange);
    } else {
      console.log('No valid selection found, aborting copy');
      return;
    }
    
    // Check if we're copying the entire table
    const isWholeTable = dataRange.startRow === 0 && 
                        dataRange.endRow === table.rows - 1 && 
                        dataRange.startCol === 0 && 
                        dataRange.endCol === table.cols - 1;
    
    console.log('Copy operation analysis:', {
      dataRange,
      tableSize: { rows: table.rows, cols: table.cols },
      isWholeTable,
      selectionType: selectedRange ? (isWholeTable ? 'whole-table-range' : 'partial-range') : 'single-cell'
    });
    
    // Extract both full cell instances and string representations
    const data: any[][] = [];
    const stringData: string[][] = [];
    for (let row = dataRange.startRow; row <= dataRange.endRow; row++) {
      const rowData: any[] = [];
      const rowStringData: string[] = [];
      for (let col = dataRange.startCol; col <= dataRange.endCol; col++) {
        const cell = table.cells[row]?.[col];
        rowData.push(cell); // Store full cell instance
        
        // Convert to string representation for clipboard
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
      data.push(rowData);
      stringData.push(rowStringData);
    }
    
    const copiedDataToSet = {
      type: isWholeTable ? 'table' as const : 'region' as const,
      data,
      stringData,
      sourceTableId: activeTabId,
      sourceRange: {
        startRow: dataRange.startRow,
        endRow: dataRange.endRow,
        startCol: dataRange.startCol,
        endCol: dataRange.endCol
      },
      tableMetadata: isWholeTable ? {
        columnNames: table.columnNames,
        columnTypes: table.columnTypes,
        rows: table.rows,
        cols: table.cols
      } : undefined
    };
    
    console.log('Setting copiedData:', {
      type: copiedDataToSet.type,
      dataRows: copiedDataToSet.data.length,
      dataCols: copiedDataToSet.data[0]?.length || 0,
      sourceTableId: copiedDataToSet.sourceTableId,
      sourceRange: copiedDataToSet.sourceRange,
      tableMetadata: copiedDataToSet.tableMetadata
    });
    
    setCopiedData(copiedDataToSet);
    
    console.log('=== COPY OPERATION END ===');
    
    // Note: Keeping data in internal clipboard only to avoid permission issues
    // TSV data is prepared but not written to system clipboard
    // const tsvData = stringData.map(row => row.join('\t')).join('\n');
    // navigator.clipboard?.writeText(tsvData);
  }, [selectedCell, selectedRange, activeTabId, openTables]);

  // Enhanced paste functionality
  const handlePaste = useCallback(async () => {
    console.log('=== PASTE OPERATION START ===');
    console.log('copiedData:', copiedData ? { 
      type: copiedData.type, 
      sourceTableId: copiedData.sourceTableId,
      dataRows: copiedData.data?.length,
      dataCols: copiedData.data?.[0]?.length,
      tableMetadata: copiedData.tableMetadata
    } : 'null');
    console.log('activeTabId:', activeTabId);
    console.log('selectedCell:', selectedCell);
    console.log('selectedRange:', selectedRange);
    
    // Check if we're pasting a whole table
    if (copiedData && copiedData.type === 'table') {
      console.log('Detected whole table paste');
      
      // If there's an active table, paste into existing table (default to top-left if no selection)
      if (activeTabId) {
        console.log('Active table found, pasting into existing table');
        
        // Paste whole table into existing table with expansion
        const currentTable = openTables.find(t => t.id === activeTabId)?.instance;
        if (!currentTable) {
          console.log('Current table not found for activeTabId:', activeTabId);
          return;
        }
        
        console.log('Current table:', { id: currentTable.id, rows: currentTable.rows, cols: currentTable.cols });
        
        const pasteTarget = selectedRange ? 
          { startRow: selectedRange.startRow, startCol: selectedRange.startCol } :
          selectedCell ? 
          { startRow: selectedCell.row, startCol: selectedCell.col } :
          { startRow: 0, startCol: 0 };
        
        console.log('Paste target:', pasteTarget);
        
        const dataToPaste = copiedData.data;
        const metadata = copiedData.tableMetadata!;
        
        console.log('Data to paste:', { rows: dataToPaste.length, cols: dataToPaste[0]?.length });
        console.log('Table metadata:', metadata);
        
        // Calculate required dimensions
        const maxTargetRow = pasteTarget.startRow + metadata.rows - 1;
        const maxTargetCol = pasteTarget.startCol + metadata.cols - 1;
        
        console.log('Required dimensions:', { maxTargetRow, maxTargetCol });
        console.log('Current table dimensions:', { rows: currentTable.rows, cols: currentTable.cols });
        
        // Expand table if necessary
        const needsRowExpansion = maxTargetRow >= currentTable.rows;
        const needsColExpansion = maxTargetCol >= currentTable.cols;
        
        console.log('Expansion needed:', { needsRowExpansion, needsColExpansion });
        
        // Create a function to paste data after table expansion
        const pasteDataAfterExpansion = () => {
          console.log('Starting data paste after expansion');
          let cellsPasted = 0;
          
          // Paste all table data
          for (let dataRow = 0; dataRow < dataToPaste.length; dataRow++) {
            const targetRow = pasteTarget.startRow + dataRow;
            for (let dataCol = 0; dataCol < dataToPaste[dataRow].length; dataCol++) {
              const targetCol = pasteTarget.startCol + dataCol;
              const cellData = dataToPaste[dataRow][dataCol];
              
              if (cellData) {
                console.log(`Pasting cell [${dataRow},${dataCol}] -> [${targetRow},${targetCol}]:`, cellData);
                
                if (cellData.type !== 'text') {
                  // For non-text cells, use addToTable to preserve full instance
                  onAddToTable(activeTabId, cellData, targetRow, targetCol);
                } else {
                  // For text cells, use editCellContent
                  onEditCellContent(activeTabId, targetRow, targetCol, cellData.content);
                }
                cellsPasted++;
              }
            }
          }
          
          console.log(`Finished pasting ${cellsPasted} cells`);
          markTableDirty(activeTabId);
          console.log('=== PASTE OPERATION END ===');
        };

        // Handle table expansion and pasting
        if (needsRowExpansion || needsColExpansion) {
          console.log('Table expansion needed, starting expansion process');
          
          // First expand the table
          setTimeout(() => {
            // Add rows if needed
            if (needsRowExpansion && onAddRow) {
              const rowsToAdd = maxTargetRow - currentTable.rows + 1;
              console.log(`Adding ${rowsToAdd} rows`);
              
              for (let i = 0; i < rowsToAdd; i++) {
                console.log(`Adding row ${i + 1}/${rowsToAdd} at position ${currentTable.rows - 1}`);
                onAddRow(activeTabId, 'after', currentTable.rows - 1);
              }
            }
            
            // Add columns if needed
            if (needsColExpansion && onAddColumn) {
              const colsToAdd = maxTargetCol - currentTable.cols + 1;
              console.log(`Adding ${colsToAdd} columns`);
              
              for (let i = 0; i < colsToAdd; i++) {
                console.log(`Adding column ${i + 1}/${colsToAdd} at position ${currentTable.cols - 1}`);
                onAddColumn(activeTabId, 'after', currentTable.cols - 1);
              }
            }
            
            console.log('Table expansion complete, waiting for state update before pasting...');
            // Wait a bit more for the table state to update, then paste
            setTimeout(pasteDataAfterExpansion, 50);
          }, 0);
        } else {
          console.log('No table expansion needed, pasting immediately');
          setTimeout(pasteDataAfterExpansion, 0);
        }
        
        if (onOperation) {
          onOperation(`Pasted entire table into existing table at row ${pasteTarget.startRow + 1}, column ${String.fromCharCode(65 + pasteTarget.startCol)}`);
        }
        
        return;
      } else {
        // No active table or specific location - create new table instance
        const newTableId = `table_${Date.now()}`;
        const metadata = copiedData.tableMetadata!;
        
        const newTable: TableInstance = {
          id: newTableId,
          type: 'table',
          source: { type: 'manual' },
          rows: metadata.rows,
          cols: metadata.cols,
          cells: copiedData.data,
          columnNames: metadata.columnNames,
          columnTypes: metadata.columnTypes,
          x: 50,
          y: 50,
          width: 400,
          height: 300
        };
        
        // Add new table to open tables
        const newOpenTable: OpenTable = {
          id: newTableId,
          instance: normalizeTableInstance(newTable),
          isDirty: true,
          isNew: true,
          originalName: `Copy of ${openTables.find(t => t.id === copiedData.sourceTableId)?.originalName || 'Table'}`
        };
        
        setOpenTables(prev => [...prev, newOpenTable]);
        setActiveTabId(newTableId);
        
        // Log the operation
        if (onOperation) {
          onOperation(`Pasted table as new table "${newOpenTable.originalName}"`);
        }
        
        return;
      }
    }
    
    // If no active table, can only paste if we have internal clipboard data
    if (!activeTabId) {
      if (copiedData) {
        // Handle internal clipboard data when no table is active
        if (copiedData.type === 'table') {
          // This case is already handled above
          return;
        } else {
          // Create new table from internal clipboard data
          const dataToPaste = copiedData.data;
          if (dataToPaste.length > 0) {
            const newTableId = `table_${Date.now()}`;
            
            const newTable: TableInstance = {
              id: newTableId,
              type: 'table',
              source: { type: 'manual' },
              rows: dataToPaste.length,
              cols: Math.max(...dataToPaste.map(row => row.length)),
              cells: dataToPaste,
              columnNames: Array.from({ length: Math.max(...dataToPaste.map(row => row.length)) }, (_, i) => indexToLetters(i)),
              columnTypes: Array.from({ length: Math.max(...dataToPaste.map(row => row.length)) }, () => 'categorical' as ColumnType),
              x: 50,
              y: 50,
              width: 400,
              height: 300
            };
            
            const newOpenTable: OpenTable = {
              id: newTableId,
              instance: normalizeTableInstance(newTable),
              isDirty: true,
              isNew: true,
              originalName: `Pasted Data`
            };
            
            setOpenTables(prev => [...prev, newOpenTable]);
            setActiveTabId(newTableId);
            
            if (onOperation) {
              onOperation(`Pasted data as new table "${newOpenTable.originalName}"`);
            }
            
            return;
          }
        }
      } else {
        if (onOperation) {
          onOperation('No data to paste. Use Ctrl+C to copy data within the table editor first.');
        }
      }
      return;
    }
    
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
    
    let dataToPaste: any[][] = [];
    let isInternalCopy = false;
    
    // Only use internal clipboard data
    if (copiedData) {
      dataToPaste = copiedData.data;
      isInternalCopy = true;
    } else {
      // No internal clipboard data available
      if (onOperation) {
        onOperation('No data to paste. Use Ctrl+C to copy data within the table editor first.');
      }
      return;
    }
    
    if (dataToPaste.length === 0) return;
    
    const currentActiveTabId = activeTabId;
    const table = openTables.find(t => t.id === activeTabId)?.instance;
    if (!table) return;
    
    // Calculate required table dimensions
    const maxTargetRow = pasteTarget.startRow + dataToPaste.length - 1;
    const maxTargetCol = pasteTarget.startCol + Math.max(...dataToPaste.map(row => row.length)) - 1;
    
    // Expand table if necessary
    let needsRowExpansion = maxTargetRow >= table.rows;
    let needsColExpansion = maxTargetCol >= table.cols;
    
    // Create a function to paste data after table expansion
    const pasteDataAfterExpansion = () => {
      // Paste data
      for (let dataRow = 0; dataRow < dataToPaste.length; dataRow++) {
        const targetRow = pasteTarget.startRow + dataRow;
        for (let dataCol = 0; dataCol < dataToPaste[dataRow].length; dataCol++) {
          const targetCol = pasteTarget.startCol + dataCol;
          const cellData = dataToPaste[dataRow][dataCol];
          
          if (cellData) {
            if (isInternalCopy && cellData.type !== 'text') {
              // For non-text cells from internal copy, use addToTable to preserve full instance
              onAddToTable(currentActiveTabId, cellData, targetRow, targetCol);
            } else if (cellData.type === 'text' || typeof cellData === 'string') {
              // For text cells, use editCellContent
              const content = typeof cellData === 'string' ? cellData : cellData.content;
              if (content) {
                onEditCellContent(currentActiveTabId, targetRow, targetCol, content);
              }
            }
          }
        }
      }
      markTableDirty(currentActiveTabId);
    };

    // Handle table expansion and pasting
    if (needsRowExpansion || needsColExpansion) {
      // First expand the table
      setTimeout(() => {
        // Add rows if needed
        if (needsRowExpansion && onAddRow) {
          const rowsToAdd = maxTargetRow - table.rows + 1;
          for (let i = 0; i < rowsToAdd; i++) {
            onAddRow(currentActiveTabId, 'after', table.rows - 1);
          }
        }
        
        // Add columns if needed
        if (needsColExpansion && onAddColumn) {
          const colsToAdd = maxTargetCol - table.cols + 1;
          for (let i = 0; i < colsToAdd; i++) {
            onAddColumn(currentActiveTabId, 'after', table.cols - 1);
          }
        }
        
        // Wait a bit more for the table state to update, then paste
        setTimeout(pasteDataAfterExpansion, 50);
      }, 0);
    } else {
      // No expansion needed, paste immediately
      setTimeout(pasteDataAfterExpansion, 0);
    }
  }, [copiedData, selectedCell, selectedRange, activeTabId, onEditCellContent, onAddToTable, onAddRow, onAddColumn, markTableDirty, openTables, setOpenTables, setActiveTabId, onOperation]);


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
      stringData: [rowStringData], // String representation for system clipboard
      sourceTableId: activeTabId,
      sourceRange: {
        startRow: rowIndex,
        endRow: rowIndex,
        startCol: 0,
        endCol: table.cols - 1
      }
    });
    
    // Note: Keeping data in internal clipboard only
    // navigator.clipboard?.writeText(rowStringData.join('\t'));
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
      stringData: [columnStringData], // String representation for system clipboard
      sourceTableId: activeTabId,
      sourceRange: {
        startRow: 0,
        endRow: table.rows - 1,
        startCol: colIndex,
        endCol: colIndex
      }
    });
    
    // Note: Keeping data in internal clipboard only
    // navigator.clipboard?.writeText(columnStringData.join('\n'));
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
  const handleCellSelectionChange = useCallback((cell: { row: number; col: number; originalRow?: number } | null) => {
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

  // Clear selection function
  const handleClear = useCallback(() => {
    if (!activeTabId) return;
    
    const table = openTables.find(t => t.id === activeTabId)?.instance;
    if (!table) return;
    
    // Check if entire table is selected (selectedRange covers the whole table)
    if (selectedRange && selectedRange.tableId === activeTabId) {
      const isWholeTable = selectedRange.startRow === 0 && 
                          selectedRange.endRow === table.rows - 1 && 
                          selectedRange.startCol === 0 && 
                          selectedRange.endCol === table.cols - 1;
                          
      if (isWholeTable) {
        // Clear entire table
        for (let row = 0; row < table.rows; row++) {
          for (let col = 0; col < table.cols; col++) {
            onRemoveCellContent(activeTabId, row, col);
          }
        }
        markTableDirty(activeTabId);
        if (onOperation) {
          onOperation(`Cleared entire table "${activeTabId}"`);
        }
        return;
      } else {
        // Clear selected range
        for (let row = selectedRange.startRow; row <= selectedRange.endRow; row++) {
          for (let col = selectedRange.startCol; col <= selectedRange.endCol; col++) {
            onRemoveCellContent(activeTabId, row, col);
          }
        }
        markTableDirty(activeTabId);
        if (onOperation) {
          onOperation(`Cleared selected area in table "${activeTabId}"`);
        }
        return;
      }
    }
    
    // Clear single selected cell
    if (selectedCell && selectedCell.tableId === activeTabId) {
      onRemoveCellContent(activeTabId, selectedCell.row, selectedCell.col);
      markTableDirty(activeTabId);
      if (onOperation) {
        onOperation(`Cleared cell (${selectedCell.row + 1}, ${String.fromCharCode(65 + selectedCell.col)}) in table "${activeTabId}"`);
      }
    }
  }, [activeTabId, selectedRange, selectedCell, openTables, onRemoveCellContent, markTableDirty, onOperation]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is in edit mode (input or textarea focused)
      const activeElement = document.activeElement;
      const isInEditMode = activeElement && (
        activeElement.tagName === 'INPUT' || 
        activeElement.tagName === 'TEXTAREA' || 
        (activeElement as HTMLElement).contentEditable === 'true'
      );
      
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'c') {
          e.preventDefault();
          handleCopy();
        } else if (e.key === 'v') {
          e.preventDefault();
          handlePaste();
        }
      } else if (e.key === 'Backspace' && !isInEditMode) {
        // Only handle backspace if not in edit mode
        e.preventDefault();
        handleClear();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown, { passive: false } as AddEventListenerOptions);
    return () => document.removeEventListener('keydown', handleKeyDown, { passive: false } as EventListenerOptions);
  }, [handleCopy, handlePaste, handleClear]);

  // Function to perform join operation
  const performJoin = useCallback((suggestion: JoinSuggestion) => {
    const leftTable = openTables.find(t => t.id === suggestion.leftTableId)?.instance;
    const rightTable = openTables.find(t => t.id === suggestion.rightTableId)?.instance;
    
    if (!leftTable || !rightTable) return;
    
    // Use column indices from suggestion
    const leftColIndex = suggestion.leftColumnIndex;
    const rightColIndex = suggestion.rightColumnIndex;
    
    if (leftColIndex < 0 || leftColIndex >= leftTable.cols || rightColIndex < 0 || rightColIndex >= rightTable.cols) {
      alert('Invalid column indices for join');
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
      // Inner join implementation - exclude right join column name to avoid duplication
      const rightNamesExcludingJoinCol = rightNames.filter((_, index) => index !== rightColIndex);
      joinedColumnNames = [...leftNames, ...rightNamesExcludingJoinCol];
      
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
            // Match found - combine rows (exclude right join column to avoid duplication)
            const rightRowExcludingJoinCol = rightRowData.filter((_, index) => index !== rightColIndex);
            const combinedRow = [...leftRowData, ...rightRowExcludingJoinCol];
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
      columnTypes: [...(leftTable.columnTypes || []), ...(rightTable.columnTypes || []).filter((_, index) => index !== rightColIndex)],
      x: Math.max((leftTable.x || 0), (rightTable.x || 0)) + 50,
      y: Math.max((leftTable.y || 0), (rightTable.y || 0)) + 50,
      width: Math.max((leftTable.width || 400), 400),
      height: Math.max((leftTable.height || 300), 300)
    };
    
    // Add joined table to open tables
    const newOpenTable: OpenTable = {
      id: joinedTableId,
      instance: normalizeTableInstance(joinedTable),
      isDirty: true,
      isNew: true,
      originalName: `${openTables.find(t => t.id === suggestion.leftTableId)?.originalName || 'Left'} ${suggestion.joinType.toUpperCase()} ${openTables.find(t => t.id === suggestion.rightTableId)?.originalName || 'Right'}`
    };
    
    setOpenTables(prev => [...prev, newOpenTable]);
    setActiveTabId(joinedTableId);
    setShowJoinPanel(false);
    
    console.log('Created joined table:', joinedTable);
  }, [openTables]);

  // Function to perform manual join
  const performManualJoin = useCallback(() => {
    const suggestion: JoinSuggestion = {
      leftTableId: manualJoin.leftTableId,
      rightTableId: manualJoin.rightTableId,
      leftColumn: manualJoin.leftColumn,
      rightColumn: manualJoin.rightColumn,
      leftColumnIndex: manualJoin.leftColumnIndex,
      rightColumnIndex: manualJoin.rightColumnIndex,
      joinType: manualJoin.joinType,
      confidence: 1.0
    };
    
    performJoin(suggestion);
    setShowManualJoin(false);
    
    // Reset manual join form
    setManualJoin({
      leftTableId: '',
      rightTableId: '',
      leftColumn: '',
      rightColumn: '',
      leftColumnIndex: -1,
      rightColumnIndex: -1,
      joinType: 'inner'
    });
  }, [manualJoin, performJoin]);

  // Function to save all tables
  const handleSaveAll = useCallback(() => {
    console.log(`[MultiTableEditor] handleSaveAll called`);
    const dirtyTables = openTables.filter(t => t.isDirty);
    console.log(`[MultiTableEditor] Found ${dirtyTables.length} dirty tables:`, dirtyTables.map(t => `${t.id} (${t.originalName})`));
    
    if (dirtyTables.length > 0) {
      console.log(`[MultiTableEditor] Opening save dialog`);
      setShowSaveDialog(true);
    } else {
      console.log(`[MultiTableEditor] No changes to save, canceling`);
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
            >
              Join Tables {joinSuggestions.length > 0 && `(${joinSuggestions.length})`}
            </button>
          )}
          
          
          <button onClick={handleSaveAll}>
            Save {openTables.filter(t => t.isDirty).length > 0 && `(${openTables.filter(t => t.isDirty).length})`}
          </button>
          
          <button onClick={onCancel}>Cancel</button>
          
          {onCaptureToCell && (
            <button 
              onClick={() => {
                if (selectedCell) {
                  // Use original row index if available for data operations
                  const rowToUse = selectedCell.originalRow ?? selectedCell.row;
                  onCaptureToCell?.(selectedCell.tableId, rowToUse, selectedCell.col);
                  markTableDirty(selectedCell.tableId);
                }
              }}
              disabled={!isCaptureEnabled || !selectedCell}
              title={!selectedCell ? "Click on a table cell first to capture content to it" : `Capture content to cell (${selectedCell.row + 1}, ${String.fromCharCode(65 + selectedCell.col)})`}
            >
              {selectedCell 
                ? `Capture to Cell (${selectedCell.row + 1}, ${String.fromCharCode(65 + selectedCell.col)})` 
                : "Capture to Cell"
              }
            </button>
          )}
          
          {selectedCell && (() => {
            const table = openTables.find(t => t.id === selectedCell.tableId)?.instance;
            // Use original row index if available, otherwise fall back to display row index
            const rowToUse = selectedCell.originalRow ?? selectedCell.row;
            const cell = table?.cells[rowToUse]?.[selectedCell.col];
            const isWebSource = cell?.source?.type === 'web';
            
            if (isWebSource) {
              return (
                <button 
                  onClick={() => {
                    const webSource = cell.source as any;
                    if (webSource.pageId && webSource.locator) {
                      const locatorString = encodeURIComponent(webSource.locator);
                      const baseUrl = chrome.runtime.getURL('viewer.html');
                      const viewerUrl = `${baseUrl}?snapshotId=${webSource.pageId}&locator=${locatorString}`;
                      chrome.tabs.create({ url: viewerUrl });
                    }
                  }}
                >
                  Source
                </button>
              );
            }
            return null;
          })()}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h4 style={{ margin: 0 }}>Join Tables</h4>
            <button 
              onClick={() => setShowManualJoin(!showManualJoin)}
              style={{ fontSize: '12px', padding: '4px 8px' }}
            >
              {showManualJoin ? 'Hide Manual Join' : 'Manual Join'}
            </button>
          </div>
          
          {/* Manual Join Interface */}
          {showManualJoin && (
            <div style={{
              backgroundColor: 'white',
              border: '1px solid #ddd',
              borderRadius: '4px',
              padding: '12px',
              marginBottom: '12px'
            }}>
              <h5 style={{ margin: '0 0 8px 0' }}>Manual Join Configuration</h5>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Left Table:</label>
                  <select 
                    value={manualJoin.leftTableId}
                    onChange={(e) => setManualJoin(prev => ({ ...prev, leftTableId: e.target.value, leftColumn: '', leftColumnIndex: -1 }))}
                    style={{ width: '100%', padding: '4px' }}
                  >
                    <option value="">Select table...</option>
                    {openTables.map(table => (
                      <option key={table.id} value={table.id}>{table.originalName}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Right Table:</label>
                  <select 
                    value={manualJoin.rightTableId}
                    onChange={(e) => setManualJoin(prev => ({ ...prev, rightTableId: e.target.value, rightColumn: '', rightColumnIndex: -1 }))}
                    style={{ width: '100%', padding: '4px' }}
                  >
                    <option value="">Select table...</option>
                    {openTables.map(table => (
                      <option key={table.id} value={table.id}>{table.originalName}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Left Column:</label>
                  <select 
                    value={manualJoin.leftColumn}
                    onChange={(e) => {
                      const selectedName = e.target.value;
                      const table = openTables.find(t => t.id === manualJoin.leftTableId)?.instance;
                      const columnIndex = table ? Array.from({ length: table.cols }, (_, i) => {
                        const name = table.columnNames?.[i] || `Column ${i + 1}`;
                        return { name, index: i };
                      }).find(col => col.name === selectedName)?.index ?? -1 : -1;
                      
                      setManualJoin(prev => ({ ...prev, leftColumn: selectedName, leftColumnIndex: columnIndex }));
                    }}
                    style={{ width: '100%', padding: '4px' }}
                    disabled={!manualJoin.leftTableId}
                  >
                    <option value="">Select column...</option>
                    {manualJoin.leftTableId && (() => {
                      const table = openTables.find(t => t.id === manualJoin.leftTableId)?.instance;
                      return table ? Array.from({ length: table.cols }, (_, i) => {
                        const name = table.columnNames?.[i] || `Column ${i + 1}`;
                        return <option key={i} value={name}>{name}</option>;
                      }) : [];
                    })()}
                  </select>
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Right Column:</label>
                  <select 
                    value={manualJoin.rightColumn}
                    onChange={(e) => {
                      const selectedName = e.target.value;
                      const table = openTables.find(t => t.id === manualJoin.rightTableId)?.instance;
                      const columnIndex = table ? Array.from({ length: table.cols }, (_, i) => {
                        const name = table.columnNames?.[i] || `Column ${i + 1}`;
                        return { name, index: i };
                      }).find(col => col.name === selectedName)?.index ?? -1 : -1;
                      
                      setManualJoin(prev => ({ ...prev, rightColumn: selectedName, rightColumnIndex: columnIndex }));
                    }}
                    style={{ width: '100%', padding: '4px' }}
                    disabled={!manualJoin.rightTableId}
                  >
                    <option value="">Select column...</option>
                    {manualJoin.rightTableId && (() => {
                      const table = openTables.find(t => t.id === manualJoin.rightTableId)?.instance;
                      return table ? Array.from({ length: table.cols }, (_, i) => {
                        const name = table.columnNames?.[i] || `Column ${i + 1}`;
                        return <option key={i} value={name}>{name}</option>;
                      }) : [];
                    })()}
                  </select>
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Join Type:</label>
                  <select 
                    value={manualJoin.joinType}
                    onChange={(e) => setManualJoin(prev => ({ ...prev, joinType: e.target.value as any }))}
                    style={{ width: '100%', padding: '4px' }}
                  >
                    <option value="inner">Inner Join</option>
                    <option value="left">Left Join</option>
                    <option value="right">Right Join</option>
                    <option value="full">Full Join</option>
                    <option value="union">Union</option>
                  </select>
                </div>
              </div>
              
              <button 
                onClick={performManualJoin}
                disabled={!manualJoin.leftTableId || !manualJoin.rightTableId || !manualJoin.leftColumn || !manualJoin.rightColumn}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#007acc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: manualJoin.leftTableId && manualJoin.rightTableId && manualJoin.leftColumn && manualJoin.rightColumn ? 'pointer' : 'not-allowed'
                }}
              >
                Perform Manual Join
              </button>
            </div>
          )}
          
          {/* Auto Suggestions */}
          <h5 style={{ margin: '0 0 8px 0' }}>Suggested Joins</h5>
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
                  <span style={{ fontSize: '12px' }}>
                    {openTables.find(t => t.id === suggestion.leftTableId)?.originalName}.{suggestion.leftColumn}
                    {' ↔ '}
                    {openTables.find(t => t.id === suggestion.rightTableId)?.originalName}.{suggestion.rightColumn}
                    <span style={{ color: '#666', marginLeft: '8px' }}>
                      (confidence: {Math.round(suggestion.confidence * 100)}%)
                    </span>
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
            <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>
              No automatic join relationships detected. Use Manual Join above to specify custom join criteria.
            </p>
          )}
        </div>
      )}

      {/* Active Table Content */}
      {activeTable && (
        <div 
          className={`table-container ${currentSuggestion ? 'has-suggestions' : ''}`} 
          style={{ position: 'relative' }}
        >
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
            setIsInEditor={setIsInEditor}
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
                ) : instance.type === 'visualization' ? (
                  <div className="visualization-thumbnail">
                    {instance.thumbnail ? (
                      <img
                        src={instance.thumbnail}
                        alt="visualization"
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    ) : (
                      <div className="visualization-thumb-placeholder" style={{ background: '#f0f8ff', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="#007acc">
                          <path d="M3 3v18h18v-2H5V3H3zm4 14h2v-6H7v6zm4 0h2v-8h-2v8zm4 0h2V7h-2v10z"/>
                        </svg>
                      </div>
                    )}
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
                          console.log(`[MultiTableEditor] Saving individual table: ${table.id} (${table.originalName})`);
                          const newTableId = onSaveTable(table.id, table.originalName, table.isDirty);
                          console.log(`[MultiTableEditor] Save returned newTableId: ${newTableId}`);
                          
                          if (newTableId) {
                            console.log(`[MultiTableEditor] Updating table ID from ${table.id} to ${newTableId}`);
                            // Update the table ID in openTables and clear dirty flag
                            setOpenTables(prev => prev.map(t => 
                              t.id === table.id ? { ...t, id: newTableId, isDirty: false } : t
                            ));
                            // Update activeTabId if this was the active table
                            if (activeTabId === table.id) {
                              console.log(`[MultiTableEditor] Updating activeTabId from ${table.id} to ${newTableId}`);
                              setActiveTabId(newTableId);
                            }
                          } else {
                            console.log(`[MultiTableEditor] No ID change, just clearing dirty flag for ${table.id}`);
                            // Just clear dirty flag if no ID change
                            setOpenTables(prev => prev.map(t => 
                              t.id === table.id ? { ...t, isDirty: false } : t
                            ));
                          }
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
                  console.log(`[MultiTableEditor] Save All & Close clicked`);
                  const dirtyTables = openTables.filter(t => t.isDirty);
                  console.log(`[MultiTableEditor] Found ${dirtyTables.length} dirty tables:`, dirtyTables.map(t => `${t.id} (${t.originalName})`));
                  
                  // Save all dirty tables and track ID changes
                  const idChanges: { [oldId: string]: string } = {};
                  dirtyTables.forEach(table => {
                    console.log(`[MultiTableEditor] Saving table: ${table.id} (${table.originalName})`);
                    const newTableId = onSaveTable(table.id, table.originalName, table.isDirty);
                    console.log(`[MultiTableEditor] Save returned newTableId: ${newTableId} for ${table.id}`);
                    
                    if (newTableId && newTableId !== table.id) {
                      console.log(`[MultiTableEditor] Tracking ID change: ${table.id} -> ${newTableId}`);
                      idChanges[table.id] = newTableId;
                    }
                  });
                  
                  console.log(`[MultiTableEditor] ID changes tracked:`, idChanges);
                  
                  // Update openTables with new IDs and clear dirty flags
                  setOpenTables(prev => {
                    const updated = prev.map(t => {
                      const newId = idChanges[t.id] || t.id;
                      const result = t.isDirty ? { ...t, id: newId, isDirty: false } : t;
                      if (t.isDirty) {
                        console.log(`[MultiTableEditor] Updated table state: ${t.id} -> ${result.id}, dirty: ${t.isDirty} -> ${result.isDirty}`);
                      }
                      return result;
                    });
                    console.log(`[MultiTableEditor] Updated openTables:`, updated.map(t => `${t.id} (dirty: ${t.isDirty})`));
                    return updated;
                  });
                  
                  // Update activeTabId if it changed
                  if (activeTabId && idChanges[activeTabId]) {
                    console.log(`[MultiTableEditor] Updating activeTabId from ${activeTabId} to ${idChanges[activeTabId]}`);
                    setActiveTabId(idChanges[activeTabId]);
                  }
                  
                  console.log(`[MultiTableEditor] Closing save dialog and closing editor`);
                  setShowSaveDialog(false);
                  onClose();
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