import React from 'react';
import { Instance } from '../types';

interface InstanceContextMenuProps {
  contextMenu: {
    visible: boolean;
    position: { x: number; y: number };
    instanceId?: string | null;
    multi?: boolean;
  };
  instances: Instance[];
  closeContextMenu: () => void;
  handleRename: (instance: Instance) => void;
  handleInfer: (instance: Instance) => void;
  handleDelete: (instance: Instance) => void;
  handleBatchDelete: () => void;
  handleBatchCreateSketch: () => void;
  handleBatchCreateTable: () => void;
  handleBatchInfer: () => void;
}

const InstanceContextMenu: React.FC<InstanceContextMenuProps> = ({
  contextMenu,
  instances,
  closeContextMenu,
  handleRename,
  handleInfer,
  handleDelete,
  handleBatchDelete,
  handleBatchCreateSketch,
  handleBatchCreateTable,
  handleBatchInfer,
}) => {
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
              handleBatchInfer();
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
              const instance = instances.find(i => i.id === contextMenu.instanceId);
              if (instance) handleRename(instance);
              closeContextMenu();
            }}
          >
            Rename
          </div>
          <div
            className="contextmenuoption"
            onClick={() => {
              const instance = instances.find(i => i.id === contextMenu.instanceId);
              if (instance) handleInfer(instance);
              closeContextMenu();
            }}
          >
            Infer
          </div>
          <div
            className="contextmenuoption"
            onClick={() => {
              const instance = instances.find(i => i.id === contextMenu.instanceId);
              if (instance) handleDelete(instance);
              closeContextMenu();
            }}
          >
            Delete
          </div>
          {(() => {
            const instance = instances.find(i => i.id === contextMenu.instanceId);
            if (instance?.source.type === 'web') {
              return (
                <div
                  className="contextmenuoption"
                  onClick={async () => {
                    const webSource = instance.source as any;
                    if (webSource.pageId && webSource.locator) {
                      try {
                        const locatorString = encodeURIComponent(JSON.stringify(webSource.locator));
                        const baseUrl = (window as any).browser?.runtime?.getURL('/viewer.html');
                        if (!baseUrl) {
                          throw new Error('Extension runtime not available');
                        }
                        const viewerUrl = baseUrl + `?snapshotId=${webSource.pageId}&locator=${locatorString}`;
                        await (window as any).browser?.tabs?.create({ url: viewerUrl });
                      } catch (error) {
                        console.error('Error opening snapshot viewer:', error);
                        if (webSource.url) {
                          const url = new URL(webSource.url);
                          if (webSource.locator) {
                            const { locatorToSelector } = await import('../utils');
                            const selector = locatorToSelector(webSource.locator);
                            url.searchParams.set('webseek_selector', selector);
                          }
                          if (webSource.elementId) {
                            url.searchParams.set('webseek_element_id', webSource.elementId);
                          }
                          window.open(url.toString(), '_blank');
                        }
                      }
                    } else if (webSource.url) {
                      const url = new URL(webSource.url);
                      if (webSource.locator) {
                        const { locatorToSelector } = await import('../utils');
                        const selector = locatorToSelector(webSource.locator);
                        url.searchParams.set('webseek_selector', selector);
                      }
                      if (webSource.elementId) {
                        url.searchParams.set('webseek_element_id', webSource.elementId);
                      }
                      window.open(url.toString(), '_blank');
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