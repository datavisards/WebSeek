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

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Received message:', message, 'from', sender);
    
    // Handle proxy fetch requests
    if (message.type === 'PROXY_FETCH') {
      // Handle async response properly
      (async () => {
        try {
          console.log('[Background] Proxying fetch request to:', message.url);
          const response = await fetch(message.url, message.options);
          
          // Convert response to a serializable format
          const responseData = {
            ok: response.ok,
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            data: null as string | null,
            error: null as string | null
          };
          
          if (response.ok) {
            try {
              responseData.data = await response.text();
            } catch (e) {
              responseData.data = 'Could not read response data';
            }
          } else {
            try {
              responseData.error = await response.text();
            } catch (e) {
              responseData.error = `HTTP ${response.status}: ${response.statusText}`;
            }
          }
          
          console.log('[Background] Proxy response:', responseData);
          sendResponse(responseData);
        } catch (error) {
          console.error('[Background] Proxy fetch error:', error);
          sendResponse({
            ok: false,
            status: 0,
            statusText: 'Network Error',
            headers: {},
            data: null,
            error: error instanceof Error ? error.message : 'Network request failed'
          });
        }
      })();
      
      return true; // Indicates we will send a response asynchronously
    }
    
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
            locator: locator
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

  // Listen for tab URL changes (navigation)
  browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    // Only process complete navigation events for the active tab
    if (changeInfo.status === 'complete' && tab.url && tabId === selectedTabId) {
      console.log('[Background] Tab navigation detected:', tab.url);
      
      try {
        // Request the content script to create a new snapshot for the navigated page
        await browser.tabs.sendMessage(tabId, {
          type: 'CREATE_SNAPSHOT_AND_GET_ID'
        });
        console.log('[Background] Requested snapshot creation after navigation');
      } catch (error) {
        console.log('[Background] Could not request snapshot after navigation (content script may not be ready):', error);
      }
    }
  });

  browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) selectedTabId = tabs[0].id;
  });
});