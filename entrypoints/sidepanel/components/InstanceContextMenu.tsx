import React from 'react';
import { Instance } from '../types';

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
            if (instance?.source.type === 'web') {
              return (
                <div
                  className="contextmenuoption"
                  onClick={async () => {
                    const webSource = instance.source as any;
                    console.log('Go to source clicked, webSource:', webSource);
                    if (webSource.pageId && webSource.locator) {
                      try {
                        const locatorString = encodeURIComponent(webSource.locator);
                        console.log('Locator string:', locatorString);
                        const baseUrl = chrome.runtime.getURL('viewer.html');
                        console.log('Base URL:', baseUrl);
                        const viewerUrl = `${baseUrl}?snapshotId=${webSource.pageId}&locator=${locatorString}`;
                        console.log('Generated viewer URL:', viewerUrl);
                        await chrome.tabs.create({ url: viewerUrl });
                      } catch (error) {
                        console.error('Error opening snapshot viewer:', error);
                        // Fallback: Get URL from htmlContext using pageId
                        const pageContext = htmlContext[webSource.pageId];
                        if (pageContext?.pageURL) {
                          const url = new URL(pageContext.pageURL);
                          if (webSource.locator) {
                            const { locatorToSelector } = await import('../utils');
                            const selector = locatorToSelector(webSource.locator);
                            url.searchParams.set('webseek_selector', selector);
                          }
                          window.open(url.toString(), '_blank');
                        }
                      }
                    } else {
                      // Fallback: Get URL from htmlContext using pageId for direct navigation
                      const pageContext = htmlContext[webSource.pageId];
                      if (pageContext?.pageURL) {
                        const url = new URL(pageContext.pageURL);
                        if (webSource.locator) {
                          const { locatorToSelector } = await import('../utils');
                          const selector = locatorToSelector(webSource.locator);
                          url.searchParams.set('webseek_selector', selector);
                        }
                        window.open(url.toString(), '_blank');
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