// TableEditor.tsx
import React, { useState } from 'react';
import { browser } from 'wxt/browser';
import TableGrid from './tablegrid';
import { TableInstance, Instance, ProactiveSuggestion } from '../types';
import GhostInstance from './GhostInstance';
import './tableeditor.css';

interface TableEditorProps {
  tableId: string | null;
  instances: Instance[];
  htmlContext: Record<string, {pageURL: string, htmlContent: string}>;
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
  currentSuggestion?: ProactiveSuggestion;
}

const TableEditor: React.FC<TableEditorProps> = ({
  tableId,
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
  currentSuggestion,
}) => {
  const [selectedCell, setSelectedCell] = useState<{ row: number, col: number } | null>(null);
  
  // Function to navigate to source - open snapshot view if pageId exists, otherwise navigate to URL
  const navigateToSource = async (webSource: any) => {
    // Prefer snapshot view if pageId and locator are available
    if (webSource.pageId && webSource.locator) {
      try {
        // Construct viewer URL for snapshot
        const locatorString = encodeURIComponent(JSON.stringify(webSource.locator));
        const viewerUrl = browser.runtime.getURL('/viewer.html') + `?snapshotId=${webSource.pageId}&locator=${locatorString}`;
        
        // Open snapshot viewer in new tab
        await browser.tabs.create({ url: viewerUrl });
        return;
      } catch (error) {
        console.error('Error opening snapshot viewer:', error);
        // Fall through to URL navigation fallback
      }
    }
    
    // Fallback to URL navigation if snapshot view fails or isn't available
    // Get URL from htmlContext using pageId
    const pageContext = htmlContext[webSource.pageId];
    if (pageContext?.pageURL) {
      // Construct URL with highlighting parameters
      const url = new URL(pageContext.pageURL);
      if (webSource.locator) {
        // Import the helper function and convert locator to selector
        const { locatorToSelector } = await import('../utils');
        const selector = locatorToSelector(webSource.locator);
        url.searchParams.set('webseek_selector', selector);
      }
      
      try {
        // Check if the target webpage is already open
        const tabs = await browser.tabs.query({});
        const targetUrl = new URL(pageContext.pageURL);
        const targetOrigin = targetUrl.origin;
        const targetPathname = targetUrl.pathname;
        
        // Find existing tab with same origin and pathname
        const existingTab = tabs.find(tab => {
          if (!tab.url) return false;
          try {
            const tabUrl = new URL(tab.url);
            return tabUrl.origin === targetOrigin && tabUrl.pathname === targetPathname;
          } catch {
            return false;
          }
        });
        
        if (existingTab && existingTab.id) {
          // Switch to existing tab and update URL with highlighting parameters
          await browser.tabs.update(existingTab.id, {
            active: true,
            url: url.toString()
          });
          // Also focus the window containing the tab
          if (existingTab.windowId) {
            await browser.windows.update(existingTab.windowId, { focused: true });
          }
        } else {
          // Open in new tab if not found
          await browser.tabs.create({ url: url.toString() });
        }
      } catch (error) {
        console.error('Error navigating to source:', error);
        // Fallback to simple window.open
        window.open(url.toString(), '_blank');
      }
    } else {
      console.warn('No URL found for pageId:', webSource.pageId, 'Available contexts:', Object.keys(htmlContext));
    }
  };

  // Function to get the source of a cell; For embedded cells, it will check the source of the original instance
  const getCellSource = (table: TableInstance, row: number, col: number) => {
    const cell = table?.cells[row]?.[col];
    if (!cell) return null;
    if (cell.source?.type === 'web') {
      return cell.source;
    } else {
      if (cell.originalId) {
        return instances.find(inst => inst.id === cell.originalId)?.source || null;
      }
    }
  }

  if (!tableId) return null;

  const table = instances.find(inst =>
    inst.id === tableId && inst.type === 'table'
  ) as TableInstance | undefined;
  console.log("Table:", table);

  if (!table) return null;

  return (
    <div className="view-container" style={{ position: 'relative' }}>
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
        {selectedCell && (() => {
          // Check if selected cell has web source content
          const cellSource = getCellSource(table, selectedCell.row, selectedCell.col);
          if (cellSource?.type === 'web') {
            return (
              <button
                onClick={() => navigateToSource(cellSource as any)}
                style={{ marginLeft: '10px' }}
              >
                Source
              </button>
            );
          }
          return null;
        })()}
      </div>

      <div className="table-container" style={{ position: 'relative' }}>
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
        
        {/* Render ghost instances for proactive suggestions - positioned to overlay the table */}
        {currentSuggestion && currentSuggestion.instances.map((instanceEvent, index) => {
          // Use consistent positioning based on table grid structure
          const headerWidth = 50; // Row header width (matches tablegrid.tsx)
          const headerHeight = 30; // Column header height (matches tablegrid.tsx)
          
          return (
            <div 
              key={`ghost-${index}`} 
              style={{ 
                position: 'absolute',
                top: `${headerHeight + 10}px`, // Column header height + padding
                left: `${headerWidth + 10}px`, // Row header width + padding
                zIndex: 1000,
                pointerEvents: 'none'
              }}
            >
              <GhostInstance
                instanceEvent={instanceEvent}
                existingInstances={instances}
              />
            </div>
          );
        })}
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