import React, { useState, useRef, useEffect, useMemo } from 'react';
import { TableInstance, Instance, EmbeddedInstance, EmbeddedTextInstance, ProactiveSuggestion, InstanceEvent } from '../types';
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
  onCellSelectionChange?: (selectedCell: { row: number, col: number, originalRow?: number } | null) => void;
  onAddRow?: (position: 'before' | 'after', rowIndex: number) => void;
  onRemoveRow?: (rowIndex: number) => void;
  onAddColumn?: (position: 'before' | 'after', colIndex: number) => void;
  onRemoveColumn?: (colIndex: number) => void;
  onUpdateColumnType?: (colIndex: number, columnType: 'numeral' | 'categorical') => void;
  onUpdateColumnName?: (colIndex: number, columnName: string) => void;
  onLiftRowToHeader?: (rowIndex: number) => void;
  currentSuggestion?: ProactiveSuggestion;
  onAcceptSuggestion?: () => void;
  onDismissSuggestion?: () => void;
  // Copy/paste operations
  onCopyRow?: (rowIndex: number) => void;
  onCopyColumn?: (colIndex: number) => void;
  onPasteToRow?: (rowIndex: number) => void;
  onPasteToColumn?: (colIndex: number) => void;
  // Selection operations
  selectedRange?: { startRow: number; endRow: number; startCol: number; endCol: number } | null;
  onRangeSelectionChange?: (range: { startRow: number; endRow: number; startCol: number; endCol: number } | null) => void;
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
  onUpdateColumnName,
  onLiftRowToHeader,
  currentSuggestion,
  onAcceptSuggestion,
  onDismissSuggestion,
  onCopyRow,
  onCopyColumn,
  onPasteToRow,
  onPasteToColumn,
  selectedRange,
  onRangeSelectionChange
}) => {
  // These will be computed later based on effective table dimensions
  const [hoveredCell, setHoveredCell] = useState<{ row: number, col: number } | null>(null);
  const [editingCell, setEditingCell] = useState<{ row: number, col: number } | null>(null);
  const [editingColumnName, setEditingColumnName] = useState<number | null>(null);
  const [flashfillSuggestions, setFlashfillSuggestions] = useState<Map<string, string[]>>(new Map());
  const [dragPreview, setDragPreview] = useState<{ row: number, col: number }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const columnNameInputRef = useRef<HTMLDivElement>(null);
  
  // Box selection state
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{ row: number, col: number } | null>(null);
  const [currentRange, setCurrentRange] = useState<{ startRow: number; endRow: number; startCol: number; endCol: number } | null>(selectedRange || null);

  // Multi-selection states
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [selectedColumns, setSelectedColumns] = useState<Set<number>>(new Set());
  const [selectedCell, setSelectedCell] = useState<{ row: number, col: number, originalRow?: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    type: 'row' | 'column';
    index: number;
    position: { x: number; y: number };
  } | null>(null);

  // Add sort state after other useStates
  const [sortColumn, setSortColumn] = useState<number | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);

  // Filter states
  const [columnFilters, setColumnFilters] = useState<Map<number, {
    type: 'categorical' | 'numerical';
    values?: Set<string>; // for categorical
    min?: number; // for numerical
    max?: number; // for numerical
  }>>(new Map());
  const [openFilterDropdown, setOpenFilterDropdown] = useState<number | null>(null);

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

  // Memoize filtered and sorted rows
  const filteredAndSortedRows = useMemo(() => {
    // First apply filters
    let filteredRows = table.cells.map((row, idx) => ({ row, originalIndex: idx }));
    
    // Apply column filters
    columnFilters.forEach((filter, colIndex) => {
      filteredRows = filteredRows.filter(({ row }) => {
        const cell = row[colIndex];
        const cellValue = cell && cell.type === 'text' ? cell.content.trim() : '';
        
        if (filter.type === 'categorical' && filter.values && filter.values.size > 0) {
          // For categorical filters, check if the cell value is in the selected values
          return filter.values.has(cellValue);
        } else if (filter.type === 'numerical') {
          // If no range is specified, show all rows
          if (filter.min === undefined && filter.max === undefined) {
            return true;
          }
          
          const numValue = Number(cellValue);
          if (isNaN(numValue) || !isFinite(numValue)) {
            // For empty/non-numeric values in numerical columns, only include if they're specifically in range
            // This means empty values are excluded when a numerical filter is applied
            return false;
          }
          
          if (filter.min !== undefined && numValue < filter.min) return false;
          if (filter.max !== undefined && numValue > filter.max) return false;
          return true;
        }
        return true;
      });
    });
    
    // Then apply sorting
    if (sortColumn === null || sortDirection === null) {
      return filteredRows;
    }
    
    // Only sort if all filtered cells in the column are text or null
    const canSort = filteredRows.every(({ row }) => {
      const cell = row[sortColumn];
      return !cell || cell.type === 'text';
    });
    if (!canSort) return filteredRows;
    
    // Get the column type from table metadata
    const columnType = table.columnTypes?.[sortColumn] || 'categorical';
    
    // Pair each filtered row with its index for stable sort
    const paired = filteredRows.map(({ row, originalIndex }) => ({ row, idx: originalIndex }));
    paired.sort((a, b) => {
      const cellA = a.row[sortColumn];
      const cellB = b.row[sortColumn];
      // For formulas, use calculated result for sorting; for regular text, use content
      let valA = '';
      let valB = '';
      
      if (cellA && cellA.type === 'text') {
        const content = cellA.content.trim();
        if (content.startsWith('=')) {
          const calculated = evaluateFormula(content);
          // If formula evaluation fails, use the formula text for sorting
          valA = calculated === '#ERROR' ? content : calculated;
        } else {
          valA = content;
        }
      }
      
      if (cellB && cellB.type === 'text') {
        const content = cellB.content.trim();
        if (content.startsWith('=')) {
          const calculated = evaluateFormula(content);
          // If formula evaluation fails, use the formula text for sorting
          valB = calculated === '#ERROR' ? content : calculated;
        } else {
          valB = content;
        }
      }
      
      // Handle empty values - sort them to the end
      if (valA === '' && valB === '') return a.idx - b.idx;
      if (valA === '') return sortDirection === 'asc' ? 1 : -1;
      if (valB === '') return sortDirection === 'asc' ? -1 : 1;
      
      if (columnType === 'numeral') {
        // Numerical sorting
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
        
        // Both are non-numeric strings - sort alphabetically
        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return a.idx - b.idx;
      } else {
        // Categorical sorting - lexicographic string comparison
        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return a.idx - b.idx;
      }
    });
    return paired.map(p => ({ row: p.row, originalIndex: p.idx }));
  }, [table.cells, sortColumn, sortDirection, table.columnTypes, columnFilters]);

  // Helper function to get column name (custom or default A, B, C...)
  const getColumnName = (colIndex: number): string => {
    return table.columnNames?.[colIndex] || indexToLetters(colIndex);
  };

  // Formula evaluation functions
  const parseColumnReference = (ref: string): { col: number, row?: number } | null => {
    // Parse references like A1, B2, A:A (column), 1:1 (row)
    const cellMatch = ref.match(/^([A-Z]+)(\d+)$/);
    if (cellMatch) {
      const colLetters = cellMatch[1];
      const rowNum = parseInt(cellMatch[2]) - 1; // Convert to 0-based
      let col = 0;
      for (let i = 0; i < colLetters.length; i++) {
        col = col * 26 + (colLetters.charCodeAt(i) - 65 + 1);
      }
      col -= 1; // Convert to 0-based
      return { col, row: rowNum };
    }
    
    // Column range like A:A
    const colMatch = ref.match(/^([A-Z]+):([A-Z]+)$/);
    if (colMatch && colMatch[1] === colMatch[2]) {
      const colLetters = colMatch[1];
      let col = 0;
      for (let i = 0; i < colLetters.length; i++) {
        col = col * 26 + (colLetters.charCodeAt(i) - 65 + 1);
      }
      col -= 1; // Convert to 0-based
      return { col };
    }
    
    return null;
  };

  // Parse cell ranges like A1:A2, B1:C3
  const parseCellRange = (range: string): { startCol: number, endCol: number, startRow: number, endRow: number } | null => {
    const rangeMatch = range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
    if (!rangeMatch) return null;
    
    const startColLetters = rangeMatch[1];
    const startRowNum = parseInt(rangeMatch[2]) - 1; // Convert to 0-based
    const endColLetters = rangeMatch[3];
    const endRowNum = parseInt(rangeMatch[4]) - 1; // Convert to 0-based
    
    let startCol = 0;
    for (let i = 0; i < startColLetters.length; i++) {
      startCol = startCol * 26 + (startColLetters.charCodeAt(i) - 65 + 1);
    }
    startCol -= 1; // Convert to 0-based
    
    let endCol = 0;
    for (let i = 0; i < endColLetters.length; i++) {
      endCol = endCol * 26 + (endColLetters.charCodeAt(i) - 65 + 1);
    }
    endCol -= 1; // Convert to 0-based
    
    return {
      startCol,
      endCol,
      startRow: startRowNum,
      endRow: endRowNum
    };
  };

  // Get raw cell value without formula evaluation (to avoid circular dependency)
  const getRawCellValue = (row: number, col: number): number => {
    const cell = table.cells[row]?.[col];
    if (!cell || cell.type !== 'text') return 0;
    const textCell = cell as EmbeddedTextInstance;
    const content = textCell.content.trim();
    
    // Skip formulas to avoid infinite recursion
    if (content.startsWith('=')) return 0;
    
    const value = parseFloat(content);
    return isNaN(value) ? 0 : value;
  };


  // Safe mathematical expression evaluator without using Function() or eval()
  const evaluateMathExpression = (expr: string): number => {
    // Remove all whitespace
    expr = expr.replace(/\s/g, '');
    
    if (expr === '') return 0;
    
    // Handle parentheses first (recursive evaluation)
    while (expr.includes('(')) {
      const lastOpen = expr.lastIndexOf('(');
      const firstClose = expr.indexOf(')', lastOpen);
      if (firstClose === -1) throw new Error('Mismatched parentheses');
      
      const innerExpr = expr.substring(lastOpen + 1, firstClose);
      const innerResult = evaluateMathExpression(innerExpr);
      expr = expr.substring(0, lastOpen) + innerResult.toString() + expr.substring(firstClose + 1);
    }
    
    // Handle multiplication and division (left to right)
    let tokens = expr.split(/([+\-*/])/).filter(token => token !== '');
    
    for (let i = 1; i < tokens.length; i += 2) {
      if (tokens[i] === '*' || tokens[i] === '/') {
        const left = parseFloat(tokens[i - 1]);
        const right = parseFloat(tokens[i + 1]);
        if (isNaN(left) || isNaN(right)) throw new Error('Invalid number');
        
        const result = tokens[i] === '*' ? left * right : left / right;
        tokens.splice(i - 1, 3, result.toString());
        i -= 2; // Adjust index after splice
      }
    }
    
    // Handle addition and subtraction (left to right)
    let result = parseFloat(tokens[0]);
    if (isNaN(result)) throw new Error('Invalid number');
    
    for (let i = 1; i < tokens.length; i += 2) {
      const operator = tokens[i];
      const operand = parseFloat(tokens[i + 1]);
      if (isNaN(operand)) throw new Error('Invalid number');
      
      if (operator === '+') {
        result += operand;
      } else if (operator === '-') {
        result -= operand;
      }
    }
    
    return result;
  };

  const evaluateFormula = (formula: string): string => {
    try {
      // Remove leading = sign
      const expr = formula.startsWith('=') ? formula.slice(1) : formula;
      
      // Handle SUM function
      const sumMatch = expr.match(/SUM\(([^)]+)\)/i);
      if (sumMatch) {
        const range = sumMatch[1];
        
        // Try parsing as cell range first (A1:A2)
        const cellRange = parseCellRange(range);
        if (cellRange) {
          let sum = 0;
          for (let row = cellRange.startRow; row <= cellRange.endRow; row++) {
            for (let col = cellRange.startCol; col <= cellRange.endCol; col++) {
              sum += getRawCellValue(row, col);
            }
          }
          return sum.toString();
        }
        
        // Fall back to column reference (A:A or single cell A1)
        const ref = parseColumnReference(range);
        if (ref && ref.row === undefined) {
          // Column sum
          let sum = 0;
          for (let r = 0; r < table.rows; r++) {
            sum += getRawCellValue(r, ref.col);
          }
          return sum.toString();
        } else if (ref && ref.row !== undefined) {
          // Single cell
          return getRawCellValue(ref.row, ref.col).toString();
        }
        return '0';
      }

      // Handle AVG function
      const avgMatch = expr.match(/AVG\(([^)]+)\)/i);
      if (avgMatch) {
        const range = avgMatch[1];
        
        // Try parsing as cell range first (A1:A2)
        const cellRange = parseCellRange(range);
        if (cellRange) {
          let sum = 0;
          let count = 0;
          for (let row = cellRange.startRow; row <= cellRange.endRow; row++) {
            for (let col = cellRange.startCol; col <= cellRange.endCol; col++) {
              const cell = table.cells[row]?.[col];
              // Only count cells that actually have content (non-empty text cells)
              if (cell?.type === 'text') {
                const content = (cell as EmbeddedTextInstance).content.trim();
                // Skip formulas to avoid circular dependencies and only count non-empty content
                if (!content.startsWith('=') && content !== '') {
                  const value = parseFloat(content);
                  const numValue = isNaN(value) ? 0 : value;
                  sum += numValue;
                  count++;
                }
              }
            }
          }
          return count > 0 ? (sum / count).toString() : '0';
        }
        
        // Fall back to column reference (A:A or single cell A1)
        const ref = parseColumnReference(range);
        if (ref && ref.row === undefined) {
          // Column average
          let sum = 0;
          let count = 0;
          for (let r = 0; r < table.rows; r++) {
            const cell = table.cells[r]?.[ref.col];
            // Only count cells that actually have content (non-empty text cells)
            if (cell?.type === 'text') {
              const content = (cell as EmbeddedTextInstance).content.trim();
              // Skip formulas to avoid circular dependencies and only count non-empty content
              if (!content.startsWith('=') && content !== '') {
                const value = parseFloat(content);
                const numValue = isNaN(value) ? 0 : value;
                sum += numValue;
                count++;
              }
            }
          }
          return count > 0 ? (sum / count).toString() : '0';
        } else if (ref && ref.row !== undefined) {
          // Single cell
          return getRawCellValue(ref.row, ref.col).toString();
        }
        return '0';
      }

      // Handle basic mathematical expressions with cell references
      let processedExpr = expr;
      
      // Replace cell references with their values
      const cellRefs = expr.match(/[A-Z]+\d+/g) || [];
      
      for (const ref of cellRefs) {
        const parsed = parseColumnReference(ref);
        if (parsed && parsed.row !== undefined) {
          const value = getRawCellValue(parsed.row, parsed.col);
          // Use a more specific replacement to avoid partial matches
          processedExpr = processedExpr.replace(new RegExp('\\b' + ref + '\\b', 'g'), value.toString());
        }
      }

      // Evaluate the mathematical expression safely without using Function() or eval()
      // Only allow numbers, operators, and parentheses
      if (/^[0-9+\-*/().\s]+$/.test(processedExpr)) {
        try {
          const result = evaluateMathExpression(processedExpr.trim());
          return isNaN(result) || !isFinite(result) ? '#ERROR' : result.toString();
        } catch (error) {
          return '#ERROR';
        }
      }
      
      return '#ERROR';
    } catch (error) {
      return '#ERROR';
    }
  };


  // Flashfill pattern detection functions
  const detectPattern = (examples: string[]): { type: string; pattern?: any } | null => {
    if (examples.length < 2) return null;
    
    // Remove empty examples
    const validExamples = examples.filter(ex => ex.trim() !== '');
    if (validExamples.length < 2) return null;

    // Check for numeric sequence
    const numbers = validExamples.map(ex => parseFloat(ex)).filter(n => !isNaN(n));
    if (numbers.length === validExamples.length && numbers.length >= 2) {
      const diff = numbers[1] - numbers[0];
      let isArithmetic = true;
      for (let i = 2; i < numbers.length; i++) {
        if (Math.abs((numbers[i] - numbers[i-1]) - diff) > 0.001) {
          isArithmetic = false;
          break;
        }
      }
      if (isArithmetic) {
        return { type: 'arithmetic', pattern: { start: numbers[0], diff } };
      }
    }

    // Check for text concatenation patterns (like "Item 1", "Item 2")
    const textPattern = validExamples[0].match(/^(.+?)(\d+)(.*)$/);
    if (textPattern) {
      const [, prefix, numStr, suffix] = textPattern;
      const startNum = parseInt(numStr);
      if (!isNaN(startNum)) {
        let isTextSequence = true;
        for (let i = 1; i < validExamples.length; i++) {
          const expected = `${prefix}${startNum + i}${suffix}`;
          if (validExamples[i] !== expected) {
            isTextSequence = false;
            break;
          }
        }
        if (isTextSequence) {
          return { type: 'text_sequence', pattern: { prefix, suffix, startNum } };
        }
      }
    }

    // Check for text transformation patterns (like extracting first word, uppercase, etc.)
    if (validExamples.length >= 2) {
      // Check if all examples are uppercase of some source
      const sourceCol = findSourceColumn(validExamples);
      if (sourceCol !== null) {
        return { type: 'text_transform', pattern: { sourceCol, transform: 'uppercase' } };
      }
    }

    return null;
  };

  const findSourceColumn = (examples: string[]): number | null => {
    // Try to find a column that could be the source for transformation
    for (let col = 0; col < table.cols; col++) {
      if (col === selectedCell?.col) continue; // Skip current column
      
      let matches = 0;
      for (let i = 0; i < Math.min(examples.length, table.rows); i++) {
        const sourceCell = table.cells[i]?.[col];
        if (sourceCell?.type === 'text') {
          const sourceText = (sourceCell as EmbeddedTextInstance).content;
          // Check various transformations
          if (sourceText.toUpperCase() === examples[i] ||
              sourceText.toLowerCase() === examples[i] ||
              sourceText.split(' ')[0] === examples[i] ||
              sourceText.split(' ').pop() === examples[i]) {
            matches++;
          }
        }
      }
      if (matches === examples.length && matches >= 2) {
        return col;
      }
    }
    return null;
  };

  const generateFlashfillSuggestions = (row: number, col: number): string[] => {
    if (!selectedCell || selectedCell.col !== col) return [];
    
    // Get examples from cells above current position
    const examples: string[] = [];
    for (let r = 0; r < row; r++) {
      const cell = table.cells[r]?.[col];
      if (cell?.type === 'text') {
        examples.push((cell as EmbeddedTextInstance).content);
      } else {
        examples.push('');
      }
    }

    const pattern = detectPattern(examples.filter(ex => ex.trim() !== ''));
    if (!pattern) return [];

    const suggestions: string[] = [];
    
    switch (pattern.type) {
      case 'arithmetic':
        const nextNum = pattern.pattern.start + (row * pattern.pattern.diff);
        suggestions.push(nextNum.toString());
        break;
        
      case 'text_sequence':
        const nextText = `${pattern.pattern.prefix}${pattern.pattern.startNum + row}${pattern.pattern.suffix}`;
        suggestions.push(nextText);
        break;
        
      case 'text_transform':
        const sourceCell = table.cells[row]?.[pattern.pattern.sourceCol];
        if (sourceCell?.type === 'text') {
          const sourceText = (sourceCell as EmbeddedTextInstance).content;
          switch (pattern.pattern.transform) {
            case 'uppercase':
              suggestions.push(sourceText.toUpperCase());
              break;
          }
        }
        break;
    }

    return suggestions;
  };

  // Update flashfill suggestions when table changes
  useEffect(() => {
    const newSuggestions = new Map<string, string[]>();
    
    for (let row = 1; row < table.rows; row++) { // Start from row 1 to have examples
      for (let col = 0; col < table.cols; col++) {
        const cell = table.cells[row]?.[col];
        if (!cell || cell.type !== 'text' || (cell as EmbeddedTextInstance).content.trim() !== '') {
          continue; // Skip non-empty cells
        }
        
        const suggestions = generateFlashfillSuggestions(row, col);
        if (suggestions.length > 0) {
          newSuggestions.set(`${row}-${col}`, suggestions);
        }
      }
    }
    
    setFlashfillSuggestions(newSuggestions);
  }, [table.cells, selectedCell]);

  // Apply flashfill to a range of cells
  const applyFlashfillToCells = (startCell: { row: number, col: number }, targetCells: { row: number, col: number }[]) => {
    console.log('applyFlashfillToCells called:', { startCell, targetCells });
    
    // Get the pattern from cells above the start cell
    const examples: string[] = [];
    for (let r = 0; r <= startCell.row; r++) {
      const cell = table.cells[r]?.[startCell.col];
      if (cell?.type === 'text') {
        examples.push((cell as EmbeddedTextInstance).content);
      } else {
        examples.push('');
      }
    }

    console.log('Examples for pattern detection:', examples);
    const pattern = detectPattern(examples.filter(ex => ex.trim() !== ''));
    console.log('Detected pattern:', pattern);
    
    if (targetCells.length > 0) {
      if (pattern) {
        console.log('Applying detected pattern to cells...');
        // Apply pattern to each target cell
        targetCells.forEach(({ row, col }) => {
          let value = '';
          
          switch (pattern.type) {
            case 'arithmetic':
              const nextNum = pattern.pattern.start + (row * pattern.pattern.diff);
              value = nextNum.toString();
              break;
              
            case 'text_sequence':
              const nextText = `${pattern.pattern.prefix}${pattern.pattern.startNum + row}${pattern.pattern.suffix}`;
              value = nextText;
              break;
              
            case 'text_transform':
              const sourceCell = table.cells[row]?.[pattern.pattern.sourceCol];
              if (sourceCell?.type === 'text') {
                const sourceText = (sourceCell as EmbeddedTextInstance).content;
                switch (pattern.pattern.transform) {
                  case 'uppercase':
                    value = sourceText.toUpperCase();
                    break;
                }
              }
              break;
          }
          
          console.log(`Setting cell (${row}, ${col}) to: "${value}"`);
          if (value) {
            onEditCellContent(row, col, value);
          }
        });
      } else {
        console.log('No pattern detected, using last cell value as fallback...');
        // Fallback: use the last non-empty cell value
        const lastValue = examples.filter(ex => ex.trim() !== '').pop() || '';
        if (lastValue) {
          targetCells.forEach(({ row, col }) => {
            console.log(`Setting cell (${row}, ${col}) to last value: "${lastValue}"`);
            onEditCellContent(row, col, lastValue);
          });
        }
      }
    } else {
      console.log('No target cells');
    }
  };

  useEffect(() => {
    if (editingCell !== null && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingCell]);

  useEffect(() => {
    if (editingColumnName !== null && columnNameInputRef.current) {
      columnNameInputRef.current.focus();
      
      // Select all text in contentEditable div
      const range = document.createRange();
      range.selectNodeContents(columnNameInputRef.current);
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  }, [editingColumnName]);

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

  const handleCellClick = (row: number, col: number, originalRow?: number) => {
    setSelectedCell({ row, col, originalRow });
    setSelectedRows(new Set());
    setSelectedColumns(new Set());
    setEditingCell(null);
    
    // Clear range selection when clicking on individual cell
    if (currentRange) {
      setCurrentRange(null);
      onRangeSelectionChange?.(null);
    }
  };

  const handleContentClick = (e: React.MouseEvent, row: number, col: number, originalRow?: number) => {
    e.stopPropagation();
    setSelectedCell({ row, col, originalRow });
    setSelectedRows(new Set());
    setSelectedColumns(new Set());
    // Don't enter edit mode on single click - only select the cell
    
    // Clear range selection when clicking on individual cell
    if (currentRange) {
      setCurrentRange(null);
      onRangeSelectionChange?.(null);
    }
  };

  // Box selection handlers
  const handleCellMouseDown = (e: React.MouseEvent, row: number, col: number) => {
    if (e.button !== 0 || isReadOnly || editingCell) return; // Only left click
    
    e.preventDefault();
    setIsSelecting(true);
    setSelectionStart({ row, col });
    setCurrentRange({ startRow: row, endRow: row, startCol: col, endCol: col });
    
    // Clear other selections
    setSelectedRows(new Set());
    setSelectedColumns(new Set());
    setSelectedCell(null);
  };

  const handleCellMouseEnter = (row: number, col: number) => {
    if (!isSelecting || !selectionStart) return;
    
    const startRow = Math.min(selectionStart.row, row);
    const endRow = Math.max(selectionStart.row, row);
    const startCol = Math.min(selectionStart.col, col);
    const endCol = Math.max(selectionStart.col, col);
    
    const newRange = { startRow, endRow, startCol, endCol };
    setCurrentRange(newRange);
  };

  const handleMouseUp = useCallback(() => {
    if (isSelecting && currentRange) {
      onRangeSelectionChange?.(currentRange);
    }
    setIsSelecting(false);
    setSelectionStart(null);
  }, [isSelecting, currentRange, onRangeSelectionChange]);

  // Global mouse up handler
  useEffect(() => {
    if (isSelecting) {
      document.addEventListener('mouseup', handleMouseUp);
      return () => document.removeEventListener('mouseup', handleMouseUp);
    }
  }, [isSelecting, handleMouseUp]);

  const handleBlur = (e: React.FocusEvent, row: number, col: number) => {
    // Only blur if the new focus target is outside the cell
    const cellElement = e.currentTarget.closest('.table-cell');
    const relatedTarget = e.relatedTarget as HTMLElement;
    
    // If the new focus target is still within the same cell, don't blur
    if (cellElement && relatedTarget && cellElement.contains(relatedTarget)) {
      return;
    }
    
    const newValue = e.currentTarget.textContent || '';
    const cell = table.cells[row]?.[col];
    const originalValue = (cell && cell.type === 'text') ? (cell as EmbeddedTextInstance).content : '';
    
    // Only call onEditCellContent if the value actually changed
    if (newValue !== originalValue) {
      onEditCellContent(row, col, newValue);
    }
    setEditingCell(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, row: number, col: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const newValue = e.currentTarget.textContent || '';
      const cell = table.cells[row]?.[col];
      const originalValue = (cell && cell.type === 'text') ? (cell as EmbeddedTextInstance).content : '';
      
      // Only call onEditCellContent if the value actually changed
      if (newValue !== originalValue) {
        onEditCellContent(row, col, newValue);
      }
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

    const cell = table.cells[selectedCell.row]?.[selectedCell.col];

    if (e.key === 'F2' || e.key === 'Enter') {
      e.preventDefault();
      if (canEditCell(cell)) {
        setEditingCell(selectedCell);
      } else if (cell && cell.type === 'image') {
        alert('Image cells cannot be edited directly. Please remove the image first.');
      } else if (cell) {
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
        // Find the original row index for the new display row
        const newOriginalRow = newRow < filteredAndSortedRows.length ? filteredAndSortedRows[newRow].originalIndex : newRow;
        setSelectedCell({ row: newRow, col: newCol, originalRow: newOriginalRow });
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
    
    // Set range selection to cover the entire table
    const wholeTableRange = {
      startRow: 0,
      endRow: effectiveTable.rows - 1,
      startCol: 0,
      endCol: effectiveTable.cols - 1
    };
    
    setCurrentRange(wholeTableRange);
    onRangeSelectionChange?.(wholeTableRange);
    
    console.log('Corner clicked - setting whole table range:', wholeTableRange);
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

  // Column name editing handlers
  const handleColumnNameEdit = (colIndex: number) => {
    if (isReadOnly) return;
    setEditingColumnName(colIndex);
  };

  const handleColumnNameBlur = (colIndex: number, newName: string) => {
    if (onUpdateColumnName && newName.trim() !== getColumnName(colIndex)) {
      onUpdateColumnName(colIndex, newName.trim());
    }
    setEditingColumnName(null);
  };

  const handleColumnNameKeyDown = (e: React.KeyboardEvent, colIndex: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const newName = e.currentTarget.textContent || '';
      handleColumnNameBlur(colIndex, newName);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditingColumnName(null);
    }
  };

  const handleContextMenuAction = (action: string) => {
    if (!contextMenu) return;
    
    const { type, index } = contextMenu;
    
    switch (action) {
      case 'add-before':
        if (type === 'row' && onAddRow) {
          // Convert display row index to original row index
          const originalRowIndex = filteredAndSortedRows[index]?.originalIndex ?? index;
          onAddRow('before', originalRowIndex);
          // Clear sorting when rows are modified to avoid confusion
          setSortColumn(null);
          setSortDirection(null);
        } else if (type === 'column' && onAddColumn) {
          // Column indices don't change with sorting
          onAddColumn('before', index);
          // Clear sorting when columns are modified
          setSortColumn(null);
          setSortDirection(null);
        }
        break;
      case 'add-after':
        if (type === 'row' && onAddRow) {
          // Convert display row index to original row index
          const originalRowIndex = filteredAndSortedRows[index]?.originalIndex ?? index;
          onAddRow('after', originalRowIndex);
          // Clear sorting when rows are modified to avoid confusion
          setSortColumn(null);
          setSortDirection(null);
        } else if (type === 'column' && onAddColumn) {
          // Column indices don't change with sorting
          onAddColumn('after', index);
          // Clear sorting when columns are modified
          setSortColumn(null);
          setSortDirection(null);
        }
        break;
      case 'remove':
        if (type === 'row' && onRemoveRow) {
          // Convert display row index to original row index
          const originalRowIndex = filteredAndSortedRows[index]?.originalIndex ?? index;
          onRemoveRow(originalRowIndex);
          // Clear sorting when rows are modified to avoid confusion
          setSortColumn(null);
          setSortDirection(null);
        } else if (type === 'column' && onRemoveColumn) {
          // Column indices don't change with sorting
          onRemoveColumn(index);
          // Clear sorting when columns are modified
          setSortColumn(null);
          setSortDirection(null);
        }
        break;
      case 'lift-to-header':
        if (type === 'row' && onLiftRowToHeader) {
          // Convert display row index to original row index
          const originalRowIndex = filteredAndSortedRows[index]?.originalIndex ?? index;
          onLiftRowToHeader(originalRowIndex);
          // Clear sorting when rows are modified to avoid confusion
          setSortColumn(null);
          setSortDirection(null);
        }
        break;
      case 'copy-row':
        if (type === 'row' && onCopyRow) {
          // Convert display row index to original row index
          const originalRowIndex = filteredAndSortedRows[index]?.originalIndex ?? index;
          onCopyRow(originalRowIndex);
        }
        break;
      case 'copy-column':
        if (type === 'column' && onCopyColumn) {
          onCopyColumn(index);
        }
        break;
      case 'paste-to-row':
        if (type === 'row' && onPasteToRow) {
          // Convert display row index to original row index
          const originalRowIndex = filteredAndSortedRows[index]?.originalIndex ?? index;
          onPasteToRow(originalRowIndex);
        }
        break;
      case 'paste-to-column':
        if (type === 'column' && onPasteToColumn) {
          onPasteToColumn(index);
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

  // Close filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openFilterDropdown !== null) {
        const target = event.target as HTMLElement;
        if (!target.closest('.filter-dropdown')) {
          setOpenFilterDropdown(null);
        }
      }
    };

    if (openFilterDropdown !== null) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openFilterDropdown]);

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
              {editingColumnName === colIndex ? (
                <div
                  contentEditable
                  suppressContentEditableWarning
                  ref={columnNameInputRef}
                  onBlur={(e) => handleColumnNameBlur(colIndex, e.currentTarget.textContent || '')}
                  onKeyDown={(e) => handleColumnNameKeyDown(e, colIndex)}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    minWidth: '20px',
                    maxWidth: '80px',  // Match the display span's maxWidth
                    textAlign: 'center',
                    outline: 'none',
                    border: '1px solid #007acc',
                    borderRadius: '2px',
                    padding: '1px 2px',
                    backgroundColor: 'white',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {getColumnName(colIndex)}
                </div>
              ) : (
                <span 
                  onDoubleClick={() => handleColumnNameEdit(colIndex)}
                  style={{ 
                    cursor: isReadOnly ? 'default' : 'pointer',
                    maxWidth: '80px',  // Set maximum width for column headers
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    display: 'inline-block'
                  }}
                  title={(isReadOnly ? '' : 'Double-click to edit column name. ') + `Full name: ${getColumnName(colIndex)}`}
                >
                  {getColumnName(colIndex)}
                </span>
              )}
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
              <img
                src="/icon/filter.png"
                alt="Filter"
                onClick={e => {
                  e.stopPropagation();
                  if (!isReadOnly) {
                    setOpenFilterDropdown(openFilterDropdown === colIndex ? null : colIndex);
                  }
                }}
                style={{
                  width: '12px',
                  height: '12px',
                  cursor: isReadOnly ? 'default' : 'pointer',
                  opacity: columnFilters.has(colIndex) ? 1 : 0.6,
                  userSelect: 'none'
                }}
                title="Filter column"
              />
            </div>
          </div>
        </div>
      ))}

      {/* Filter Dropdowns */}
      {openFilterDropdown !== null && !isReadOnly && (
        <div
          style={{
            position: 'absolute',
            top: '30px',
            left: `${50 + openFilterDropdown * effectiveCellWidth}px`,
            zIndex: 2000
          }}
        >
          <FilterDropdown
            columnIndex={openFilterDropdown}
            columnType={table.columnTypes?.[openFilterDropdown] || 'categorical'}
            data={table.cells.map(row => {
              const cell = row[openFilterDropdown];
              return cell && cell.type === 'text' ? cell.content.trim() : '';
            })}
            currentFilter={columnFilters.get(openFilterDropdown)}
            onFilterChange={(filter) => {
              setColumnFilters(prev => {
                const newFilters = new Map(prev);
                if (filter) {
                  newFilters.set(openFilterDropdown, filter);
                } else {
                  newFilters.delete(openFilterDropdown);
                }
                return newFilters;
              });
            }}
            onClose={() => setOpenFilterDropdown(null)}
          />
        </div>
      )}

      {/* Row Headers */}
      {Array.from({ length: filteredAndSortedRows.length }, (_, displayRowIndex) => {
        const originalRowIndex = displayRowIndex < filteredAndSortedRows.length ? filteredAndSortedRows[displayRowIndex].originalIndex : displayRowIndex;
        return (
          <div
            key={`row-${displayRowIndex}`}
            className={`grid-header row-header ${selectedRows.has(originalRowIndex) ? 'selected-header' : ''}`}
            onClick={(e) => handleRowHeaderClick(originalRowIndex, e)}
            onContextMenu={(e) => handleRowContextMenu(e, originalRowIndex)}
            style={{
              gridRow: displayRowIndex + 2,
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
            {originalRowIndex + 1}
          </div>
        );
      })}

      {/* Content Cells */}
      {Array.from({ length: filteredAndSortedRows.length }, (_, displayRowIndex) => 
        Array.from({ length: effectiveTable.cols }, (_, colIndex) => {
          // Get cell and original row index for suggestion detection
          let cell;
          let originalRowIndex = displayRowIndex; // Default to display index
          
          if (displayRowIndex < filteredAndSortedRows.length && colIndex < filteredAndSortedRows[displayRowIndex].row.length) {
            // Use filtered and sorted data and get original row index
            cell = filteredAndSortedRows[displayRowIndex].row[colIndex];
            originalRowIndex = filteredAndSortedRows[displayRowIndex].originalIndex;
          } else {
            // Beyond filtered table dimensions - don't show anything
            return null;
          }
          
          const isHovered = hoveredCell?.row === displayRowIndex && hoveredCell?.col === colIndex;
          const isCellSelected = selectedCell?.row === displayRowIndex && selectedCell?.col === colIndex;
          const isEditing = editingCell?.row === displayRowIndex && editingCell?.col === colIndex;
          const isHeaderSelected = isSelectedViaHeader(displayRowIndex, colIndex);
          const isInRange = currentRange && 
            originalRowIndex >= currentRange.startRow && originalRowIndex <= currentRange.endRow &&
            colIndex >= currentRange.startCol && colIndex <= currentRange.endCol;
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
                  ${suggestion ? 'has-suggestion' : ''}
                  ${isInRange ? 'range-selected' : ''}
                  ${dragPreview.some(cell => cell.row === originalRowIndex && cell.col === colIndex) ? 'drag-preview' : ''}`}
              data-row={originalRowIndex}
              data-col={colIndex}
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
                  // Use original row index for data operations
                  onAddToTable(draggedInstance, originalRowIndex, colIndex);
                }
                setDraggingInstanceId(null);
                setHoveredCell(null);
              }}
              onClick={isReadOnly || isEditing ? undefined : () => handleCellClick(displayRowIndex, colIndex, originalRowIndex)}
              onMouseDown={isReadOnly || isEditing ? undefined : (e) => handleCellMouseDown(e, originalRowIndex, colIndex)}
              onMouseEnter={() => handleCellMouseEnter(originalRowIndex, colIndex)}
              onDoubleClick={isReadOnly || isEditing ? undefined : () => {
                if (canEditCell(cell)) {
                  setEditingCell({ row: displayRowIndex, col: colIndex });
                } else if (cell && cell.type === 'image') {
                  alert('Image cells cannot be edited directly. Please remove the image first.');
                } else if (cell) {
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
                  onBlur={isReadOnly ? undefined : (e) => handleBlur(e, originalRowIndex, colIndex)}
                  onKeyDown={isReadOnly ? undefined : (e) => handleKeyDown(e, originalRowIndex, colIndex)}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onMouseUp={(e) => e.stopPropagation()}
                  onSelect={(e) => e.stopPropagation()}
                  onFocus={(e) => e.stopPropagation()}
                >
                  {cell && cell.type === 'text' ? (cell as EmbeddedTextInstance).content : ''}
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
                  onClick={isReadOnly ? undefined : (e) => handleContentClick(e, displayRowIndex, colIndex, originalRowIndex)}
                >
                  {cell ? renderEmbeddedContent(cell, evaluateFormula) : null}
                  {!isReadOnly && !isEditing && (
                    <button
                      className="remove-cell-content"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveCellContent(originalRowIndex, colIndex);
                      }}
                    >
                      ×
                    </button>
                  )}
                  {!isReadOnly && !isEditing && cell && (
                    <div
                      className="fill-handle"
                      style={{
                        position: 'absolute',
                        bottom: '-1px',
                        right: '-1px',
                        width: '6px',
                        height: '6px',
                        backgroundColor: '#000',
                        cursor: 'crosshair',
                        zIndex: 10,
                        border: '1px solid white'
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        
                        // Use local variables to avoid React state race conditions
                        const dragStartCell = { row: originalRowIndex, col: colIndex };
                        let currentPreview: { row: number, col: number }[] = [];
                        
                        setDragPreview([]);
                        
                        const handleMouseMove = (e: MouseEvent) => {
                          // Find the cell under the mouse
                          const element = document.elementFromPoint(e.clientX, e.clientY);
                          const cellElement = element?.closest('.table-cell') as HTMLElement;
                          if (cellElement && cellElement.dataset.row && cellElement.dataset.col) {
                            const endRow = parseInt(cellElement.dataset.row);
                            const endCol = parseInt(cellElement.dataset.col);
                            
                            // Only fill in the same column
                            if (endCol === colIndex && endRow > originalRowIndex) {
                              const preview = [];
                              for (let r = originalRowIndex + 1; r <= endRow; r++) {
                                preview.push({ row: r, col: colIndex });
                              }
                              currentPreview = preview;
                              setDragPreview(preview);
                            } else {
                              // Clear preview if not in valid drag area
                              currentPreview = [];
                              setDragPreview([]);
                            }
                          } else {
                            // Clear preview if not over a cell
                            currentPreview = [];
                            setDragPreview([]);
                          }
                        };
                        
                        const handleMouseUp = () => {
                          console.log('Drag completed:', { dragStart: dragStartCell, dragPreview: currentPreview.length });
                          if (currentPreview.length > 0) {
                            console.log('Applying flashfill:', dragStartCell, currentPreview);
                            // Apply flashfill to all cells in preview
                            applyFlashfillToCells(dragStartCell, currentPreview);
                          }
                          setDragPreview([]);
                          document.removeEventListener('mousemove', handleMouseMove);
                          document.removeEventListener('mouseup', handleMouseUp);
                        };
                        
                        document.addEventListener('mousemove', handleMouseMove);
                        document.addEventListener('mouseup', handleMouseUp);
                      }}
                      title="Drag to fill down with pattern"
                    />
                  )}
                </div> : (
                // Empty cell - show flashfill suggestions if available
                flashfillSuggestions.has(`${originalRowIndex}-${colIndex}`) ? (
                  <div
                    className="flashfill-suggestion"
                    style={{
                      width: '100%',  
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#888',
                      fontStyle: 'italic',
                      fontSize: '11px',
                      cursor: 'pointer',
                      backgroundColor: 'rgba(0, 120, 215, 0.05)',
                      border: '1px dashed rgba(0, 120, 215, 0.3)'
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      const suggestions = flashfillSuggestions.get(`${originalRowIndex}-${colIndex}`);
                      if (suggestions && suggestions[0]) {
                        onEditCellContent(originalRowIndex, colIndex, suggestions[0]);
                      }
                    }}
                    title="Click to apply flashfill suggestion"
                  >
                    {flashfillSuggestions.get(`${originalRowIndex}-${colIndex}`)?.[0]}
                  </div>
                ) : null
              )
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
          {contextMenu.type === 'row' && onLiftRowToHeader && (
            <div
              className="contextmenuoption"
              onClick={() => handleContextMenuAction('lift-to-header')}
            >
              Lift Row to Header
            </div>
          )}
          
          {/* Copy/Paste separator */}
          <div style={{ borderTop: '1px solid #eee', margin: '4px 0' }}></div>
          
          {/* Copy option */}
          {((contextMenu.type === 'row' && onCopyRow) || (contextMenu.type === 'column' && onCopyColumn)) && (
            <div
              className="contextmenuoption"
              onClick={() => handleContextMenuAction(contextMenu.type === 'row' ? 'copy-row' : 'copy-column')}
            >
              Copy {contextMenu.type === 'row' ? 'Row' : 'Column'}
            </div>
          )}
          
          {/* Paste option - only show if there's something to paste */}
          {((contextMenu.type === 'row' && onPasteToRow) || (contextMenu.type === 'column' && onPasteToColumn)) && (
            <div
              className="contextmenuoption"
              onClick={() => handleContextMenuAction(contextMenu.type === 'row' ? 'paste-to-row' : 'paste-to-column')}
            >
              Paste to {contextMenu.type === 'row' ? 'Row' : 'Column'}
            </div>
          )}
          
          <div style={{ borderTop: '1px solid #eee', margin: '4px 0' }}></div>
          
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
function renderEmbeddedContent(embedded: EmbeddedInstance, evaluateFormula?: (formula: string) => string) {
  switch (embedded.type) {
    case 'text':
      const textContent = embedded.content;
      const isFormulaCell = textContent.startsWith('=');
      const displayContent = (isFormulaCell && evaluateFormula) 
        ? evaluateFormula(textContent) 
        : textContent;
      return (
        <p className={`cell-text ${isFormulaCell ? 'formula' : ''}`} style={{ margin: 0, fontSize: '12px' }}>
          {displayContent}
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

// FilterDropdown component
interface FilterDropdownProps {
  columnIndex: number;
  columnType: 'categorical' | 'numeral';
  data: string[];
  currentFilter?: {
    type: 'categorical' | 'numerical';
    values?: Set<string>;
    min?: number;
    max?: number;
  };
  onFilterChange: (filter: {
    type: 'categorical' | 'numerical';
    values?: Set<string>;
    min?: number;
    max?: number;
  } | null) => void;
  onClose: () => void;
}

type FilterState = {
  type: 'categorical' | 'numerical';
  values?: Set<string>;
  min?: number;
  max?: number;
};

const FilterDropdown: React.FC<FilterDropdownProps> = ({
  columnType,
  data,
  currentFilter,
  onFilterChange,
  onClose
}) => {
  const [tempFilter, setTempFilter] = useState<FilterState>(currentFilter || {
    type: columnType === 'numeral' ? 'numerical' : 'categorical',
    values: columnType === 'categorical' ? new Set<string>() : undefined
  });

  // Reset tempFilter when currentFilter changes
  useEffect(() => {
    setTempFilter(currentFilter || {
      type: columnType === 'numeral' ? 'numerical' : 'categorical',
      values: columnType === 'categorical' ? new Set<string>() : undefined
    });
  }, [currentFilter, columnType]);

  const uniqueValues = useMemo(() => {
    const values = new Set(data);
    const sortedValues = Array.from(values).sort();
    // Put empty string at the end if it exists
    if (values.has('')) {
      return sortedValues.filter(v => v !== '').concat(['']);
    }
    return sortedValues;
  }, [data]);

  const numericStats = useMemo(() => {
    if (columnType !== 'numeral') return null;
    const numbers = data
      .map(val => Number(val))
      .filter(num => !isNaN(num) && isFinite(num));
    if (numbers.length === 0) return null;
    return {
      min: Math.min(...numbers),
      max: Math.max(...numbers)
    };
  }, [data, columnType]);

  const handleApplyFilter = () => {
    if (columnType === 'categorical') {
      // If no values are selected, remove the filter (show all rows)
      if (!tempFilter.values || tempFilter.values.size === 0) {
        onFilterChange(null);
      } else {
        // Apply the filter with selected values
        const filterToApply = {
          ...tempFilter,
          type: 'categorical' as const
        };
        onFilterChange(filterToApply);
      }
    } else {
      // For numerical, only apply if there are actual constraints
      if (tempFilter.min !== undefined || tempFilter.max !== undefined) {
        const filterToApply = {
          ...tempFilter,
          type: 'numerical' as const
        };
        onFilterChange(filterToApply);
      } else {
        onFilterChange(null);
      }
    }
    onClose();
  };

  const handleClearFilter = () => {
    onFilterChange(null);
    onClose();
  };

  return (
    <div
      className="filter-dropdown"
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        background: 'white',
        border: '1px solid #ddd',
        borderRadius: '4px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        zIndex: 2000,
        minWidth: '200px',
        maxWidth: '300px',
        padding: '8px',
        maxHeight: '300px',
        overflowY: 'auto'
      }}
      onClick={e => e.stopPropagation()}
    >
      {columnType === 'categorical' ? (
        <div>
          <div style={{ marginBottom: '8px', fontWeight: 'bold', fontSize: '12px' }}>
            Filter by values:
          </div>
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {uniqueValues.map(value => (
              <label
                key={value}
                style={{
                  display: 'block',
                  margin: '4px 0',
                  fontSize: '11px',
                  cursor: 'pointer'
                }}
              >
                <input
                  type="checkbox"
                  checked={tempFilter.values?.has(value) || false}
                  onChange={(e) => {
                    const newValues = new Set<string>(tempFilter.values || []);
                    if (e.target.checked) {
                      newValues.add(value);
                    } else {
                      newValues.delete(value);
                    }
                    const newFilter = {
                      ...tempFilter,
                      values: newValues
                    } as FilterState;
                    setTempFilter(newFilter);
                  }}
                  style={{ marginRight: '6px' }}
                />
                {value || '(empty)'}
              </label>
            ))}
          </div>
        </div>
      ) : numericStats ? (
        <div>
          <div style={{ marginBottom: '8px', fontWeight: 'bold', fontSize: '12px' }}>
            Filter by range:
          </div>
          <div style={{ marginBottom: '8px', fontSize: '10px', color: '#666' }}>
            Range: {numericStats.min} - {numericStats.max}
          </div>
          <div style={{ marginBottom: '8px' }}>
            <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px' }}>
              Min:
              <input
                type="number"
                value={tempFilter.min ?? ''}
                onChange={(e) => {
                  const value = e.target.value === '' ? undefined : Number(e.target.value);
                  setTempFilter({
                    ...tempFilter,
                    min: value
                  } as FilterState);
                }}
                style={{
                  width: '100%',
                  padding: '2px 4px',
                  fontSize: '11px',
                  border: '1px solid #ccc',
                  borderRadius: '2px'
                }}
                placeholder={numericStats.min.toString()}
              />
            </label>
          </div>
          <div style={{ marginBottom: '8px' }}>
            <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px' }}>
              Max:
              <input
                type="number"
                value={tempFilter.max ?? ''}
                onChange={(e) => {
                  const value = e.target.value === '' ? undefined : Number(e.target.value);
                  setTempFilter({
                    ...tempFilter,
                    max: value
                  } as FilterState);
                }}
                style={{
                  width: '100%',
                  padding: '2px 4px',
                  fontSize: '11px',
                  border: '1px solid #ccc',
                  borderRadius: '2px'
                }}
                placeholder={numericStats.max.toString()}
              />
            </label>
          </div>
        </div>
      ) : (
        <div style={{ fontSize: '11px', color: '#666' }}>
          No numeric data to filter
        </div>
      )}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginTop: '8px',
        borderTop: '1px solid #eee',
        paddingTop: '8px'
      }}>
        <button
          onClick={handleApplyFilter}
          style={{
            flex: 1,
            padding: '4px 8px',
            fontSize: '11px',
            backgroundColor: '#007acc',
            color: 'white',
            border: 'none',
            borderRadius: '2px',
            cursor: 'pointer'
          }}
        >
          Apply
        </button>
        <button
          onClick={handleClearFilter}
          style={{
            flex: 1,
            padding: '4px 8px',
            fontSize: '11px',
            backgroundColor: '#f5f5f5',
            color: '#333',
            border: '1px solid #ddd',
            borderRadius: '2px',
            cursor: 'pointer'
          }}
        >
          Clear
        </button>
      </div>
    </div>
  );
};

export default TableGrid;