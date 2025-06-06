import { browser, type Browser } from 'wxt/browser';
export default defineBackground(() => {
  let selectedTabId: number | null = null;
  let sidePanelPort: Browser.runtime.Port | null = null;

  // ALL your browser API code goes here!
  browser.runtime.onConnect.addListener((port) => {
    if (port.name === 'side-panel') {
      sidePanelPort = port;
      port.onDisconnect.addListener(() => (sidePanelPort = null));
    }
  });

  browser.runtime.onMessage.addListener((message, sender) => {
    console.log('Received message:', message, 'from', sender);
    if (message.action === 'element_selected') {
      if (sidePanelPort) {
        sidePanelPort.postMessage(message);
      }
    } else if (message.action === 'start_element_selection') {
      if (selectedTabId !== null) {
        browser.tabs.sendMessage(selectedTabId, { action: 'start_element_selection' });
      }
    } else if (message.action === 'exit_selection') {
      if (selectedTabId !== null) {
        browser.tabs.sendMessage(selectedTabId, { action: 'exit_selection' });
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