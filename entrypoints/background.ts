import { browser, type Browser } from 'wxt/browser';
export default defineBackground(() => {
  let selectedTabId: number | null = null;
  let sidePanelPort: Browser.runtime.Port | null = null;

  // ALL your browser API code goes here!
  browser.runtime.onConnect.addListener((port) => {
    console.log('Port connected:', port.name);
    if (port.name === 'side-panel') {
      sidePanelPort = port;

      port.onMessage.addListener((msg) => {
        console.log('Background received message from side-panel:', msg);
        // Handle messages from the side panel here
        if (msg.action === 'start_element_selection') {
          if (selectedTabId !== null) {
            browser.tabs.sendMessage(selectedTabId, { action: 'start_element_selection' });
          }
        } else if (msg.action === 'start_screenshot_capture') {
          if (selectedTabId !== null) {
            browser.tabs.sendMessage(selectedTabId, { action: 'start_screenshot_capture' });
          }
        } else if (msg.action === 'exit_selection') {
          if (selectedTabId !== null) {
            browser.tabs.sendMessage(selectedTabId, { action: 'exit_selection' });
          }
        }
      });

      port.postMessage({ action: 'connected', tabId: selectedTabId });
      port.onDisconnect.addListener(() => {
        sidePanelPort = null;
      });
    }
  });

  browser.runtime.onMessage.addListener((message, sender) => {
    console.log('Received message:', message, 'from', sender);
    if (message.action === 'element_selected' || message.action === 'screenshot_finished' || message.action === 'snapshot_ready') {
      if (sidePanelPort) {
        const tabId = selectedTabId;
        if (tabId !== null) {
          // Always use the pageId from content.ts (now always provided)
          const pageId = message.pageId;
          
          // Create the source object according to the WebCaptureSource interface
          // Always use the locator object from content script
          const locator = message.locator;
          
          const source = {
            type: 'web' as const,
            pageId: pageId,
            url: message.url || sender.url || '',
            locator: locator,
            elementId: message.elementId || '',
            capturedAt: message.capturedAt || new Date().toISOString()
          };
          
          sidePanelPort.postMessage({
            ...message,
            source,
            pageId: pageId,
            pageURL: sender.url,
          });
        }
      }
    }
  });

  browser.tabs.onActivated.addListener(({ tabId }) => {
    selectedTabId = tabId;
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    if (tabId === selectedTabId) selectedTabId = null;
  });

  browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) selectedTabId = tabs[0].id;
  });
});