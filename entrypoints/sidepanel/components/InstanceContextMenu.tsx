import React, { useState } from 'react';
import { browser } from 'wxt/browser';
import { Instance, TableInstance, VisualizationInstance } from '../types';

interface InstanceContextMenuProps {
  contextMenu: {
    visible: boolean;
    position: { x: number; y: number };
    instanceIds: string[];
    multi?: boolean;
  };
  instances: Instance[];
  htmlContext: Record<string, {pageURL: string, htmlContent: string}>;
  closeContextMenu: () => void;
  handleRename: (instance: Instance) => void;
  handleInfer: (instanceIds: string[]) => void;
  handleDelete: (instance: Instance) => void;
  handleBatchDelete: () => void;
  handleBatchCreateSketch: () => void;
  handleBatchCreateTable: () => void;
}

async function exportTableAsXLSX(instance: TableInstance) {
  try {
    const XLSX = await import('xlsx');
    const header = instance.columnNames ?? [];
    const rows = instance.cells.map(row =>
      row.map(cell => {
        if (!cell) return '';
        if (cell.type === 'text') return (cell as any).content ?? '';
        if (cell.type === 'image') return (cell as any).src ?? '';
        return '';
      })
    );
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, `${(instance as any).label || instance.id || 'table'}.xlsx`);
  } catch (e) {
    console.error('Export XLSX failed:', e);
    alert('Could not export as XLSX.');
  }
}

async function exportVisualization(instance: VisualizationInstance, format: 'svg' | 'png' | 'jpg') {
  try {
    const vegaEmbed = (await import('vega-embed')).default;
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;left:-9999px;top:-9999px;';
    document.body.appendChild(container);

    if (format === 'svg') {
      const result = await vegaEmbed(container, instance.spec as any, { actions: false, renderer: 'svg' });
      const svgEl = container.querySelector('svg');
      if (svgEl) {
        const svgData = new XMLSerializer().serializeToString(svgEl);
        const blob = new Blob([svgData], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(instance as any).label || instance.id || 'visualization'}.svg`;
        a.click();
        URL.revokeObjectURL(url);
      }
      result.finalize();
    } else {
      const result = await vegaEmbed(container, instance.spec as any, { actions: false, renderer: 'canvas' });
      const canvas = container.querySelector('canvas') as HTMLCanvasElement;
      if (canvas) {
        const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
        const url = canvas.toDataURL(mimeType, 0.95);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(instance as any).label || instance.id || 'visualization'}.${format}`;
        a.click();
      }
      result.finalize();
    }

    document.body.removeChild(container);
  } catch (e) {
    console.error('Export visualization failed:', e);
    alert('Could not export visualization.');
  }
}

const VizExportSubmenu: React.FC<{ instance: VisualizationInstance; onDone: () => void }> = ({ instance, onDone }) => (
  <div style={{ borderTop: '1px solid #eee' }}>
    {(['svg', 'png', 'jpg'] as const).map(fmt => (
      <div
        key={fmt}
        className="contextmenuoption"
        style={{ paddingLeft: '20px' }}
        onClick={() => { exportVisualization(instance, fmt); onDone(); }}
      >
        Export as {fmt.toUpperCase()}
      </div>
    ))}
  </div>
);

const InstanceContextMenu: React.FC<InstanceContextMenuProps> = ({
  contextMenu,
  instances,
  htmlContext,
  closeContextMenu,
  handleRename,
  handleInfer,
  handleDelete,
  handleBatchDelete,
  handleBatchCreateSketch,
  handleBatchCreateTable,
}) => {
  const [showVizExport, setShowVizExport] = useState(false);

  if (!contextMenu.visible) return null;

  return (
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
        minWidth: '140px',
      }}
      onClick={closeContextMenu}
    >
      {contextMenu.multi ? (
        <>
          <div
            className="contextmenuoption"
            onClick={() => {
              handleBatchDelete();
              closeContextMenu();
            }}
          >
            Delete Selected
          </div>
          <div
            className="contextmenuoption"
            onClick={() => {
              handleBatchCreateSketch();
              closeContextMenu();
            }}
          >
            Create Sketch from Selected
          </div>
          <div
            className="contextmenuoption"
            onClick={() => {
              handleBatchCreateTable();
              closeContextMenu();
            }}
          >
            Create Table from Selected
          </div>
          <div
            className="contextmenuoption"
            onClick={() => {
              handleInfer(contextMenu.instanceIds);
              closeContextMenu();
            }}
          >
            Infer on Selected
          </div>
        </>
      ) : (
        <>
          <div
            className="contextmenuoption"
            onClick={() => {
              const instance = instances.find(i => i.id === contextMenu.instanceIds[0]);
              if (instance) handleRename(instance);
              closeContextMenu();
            }}
          >
            Rename
          </div>
          <div
            className="contextmenuoption"
            onClick={() => {
              handleInfer(contextMenu.instanceIds);
              closeContextMenu();
            }}
          >
            Infer
          </div>
          <div
            className="contextmenuoption"
            onClick={() => {
              const instance = instances.find(i => i.id === contextMenu.instanceIds[0]);
              if (instance) handleDelete(instance);
              closeContextMenu();
            }}
          >
            Delete
          </div>
          {(() => {
            const instance = instances.find(i => i.id === contextMenu.instanceIds[0]);
            if (instance?.type === 'table') {
              return (
                <div
                  className="contextmenuoption"
                  onClick={(e) => {
                    e.stopPropagation();
                    exportTableAsXLSX(instance as TableInstance);
                    closeContextMenu();
                  }}
                >
                  Export as XLSX
                </div>
              );
            }
            if (instance?.type === 'visualization') {
              return (
                <>
                  <div
                    className="contextmenuoption"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowVizExport(v => !v);
                    }}
                  >
                    Export as ▸
                  </div>
                  {showVizExport && (
                    <VizExportSubmenu
                      instance={instance as VisualizationInstance}
                      onDone={closeContextMenu}
                    />
                  )}
                </>
              );
            }
            return null;
          })()}
          {(() => {
            const instance = instances.find(i => i.id === contextMenu.instanceIds[0]);
            if (instance?.source.type === 'web') {
              const webSource = instance.source as any;
              const isSorted = webSource.sortingApplied;

              return (
                <div
                  className="contextmenuoption"
                  onClick={async (e) => {
                    e.stopPropagation();
                    console.log('Go to source clicked, webSource:', webSource);

                    // Show warning if cell was moved by sorting
                    if (isSorted) {
                      const proceed = confirm(
                        '⚠️ This cell was moved from its original position due to table sorting.\n\n' +
                        'The source link points to the original position, not the current position in the sorted table.\n\n' +
                        'Do you want to proceed to the original source location?'
                      );
                      if (!proceed) {
                        closeContextMenu();
                        return;
                      }
                    }

                    // Navigate to source
                    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
                    if (tabs[0]?.id) {
                      const pageUrl = webSource.url || webSource.pageUrl;
                      if (pageUrl) {
                        await browser.tabs.update(tabs[0].id, { url: pageUrl });
                      }
                    }
                    closeContextMenu();
                  }}
                >
                  Go to Source
                </div>
              );
            }
            return null;
          })()}
        </>
      )}
    </div>
  );
};

export default InstanceContextMenu;
