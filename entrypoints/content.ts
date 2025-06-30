import { browser, type Browser } from 'wxt/browser';

export default defineContentScript({
  matches: ['<all_urls>'],
  main(ctx) {
    // Any setup code can go here
  },
});

let highlightElement: HTMLElement | null = null;
let isSelecting = false;

// 用于保存当前的事件监听器，便于移除
let currentMouseMoveHandler: ((e: MouseEvent) => void) | null = null;
let currentClickHandler: ((e: MouseEvent) => void) | null = null;

function exitSelectionMode() {
  if (!isSelecting) return;

  // 清理高亮样式
  if (highlightElement) {
    highlightElement.style.border = '';
    highlightElement.style.boxSizing = '';
    highlightElement = null;
  }

  // 移除事件监听器
  if (currentMouseMoveHandler) {
    document.removeEventListener('mousemove', currentMouseMoveHandler);
    currentMouseMoveHandler = null;
  }

  if (currentClickHandler) {
    document.removeEventListener('click', currentClickHandler);
    currentClickHandler = null;
  }

  isSelecting = false;
}

function startElementSelection() {
  if (isSelecting) return;
  isSelecting = true;

  // 移除之前的事件监听器
  if (currentMouseMoveHandler) {
    document.removeEventListener('mousemove', currentMouseMoveHandler);
  }
  if (currentClickHandler) {
    document.removeEventListener('click', currentClickHandler);
  }

  // 定义 mousemove 事件处理函数
  const mouseMoveHandler = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // 移除之前的高亮元素
    if (highlightElement) {
      highlightElement.style.border = '';
      highlightElement.style.boxSizing = '';
    }

    const target = e.target as HTMLElement;
    target.style.border = '2px solid rgba(0, 123, 255, 0.5)';
    target.style.boxSizing = 'border-box';
    highlightElement = target;

    // 移除之前的 click 事件监听器
    if (currentClickHandler) {
      document.removeEventListener('click', currentClickHandler);
    }

    // 定义 click 事件处理函数
    const clickHandler = (clickEvent: MouseEvent) => {
      clickEvent.preventDefault();
      clickEvent.stopPropagation();

      const data = target.innerText.trim() || (target instanceof HTMLImageElement ? target.src : null);
      const htmlContent = document.documentElement.outerHTML;
      if (data) {
        browser.runtime.sendMessage({
          action: 'element_selected',
          type: target instanceof HTMLImageElement ? 'image' : 'text',
          data,
          outerHTML: htmlContent
        });
      }

      exitSelectionMode();
    };

    // 添加 click 事件监听器（仅触发一次）
    document.addEventListener('click', clickHandler, { once: true });
    currentClickHandler = clickHandler;
  };
  document.addEventListener('mousemove', mouseMoveHandler);
  currentMouseMoveHandler = mouseMoveHandler;
}

/**
 * 截图逻辑实现
 */
function startScreenshot(): void {
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.zIndex = '99999';
  overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
  overlay.style.pointerEvents = 'auto';
  overlay.style.cursor = 'crosshair';

  let startX = 0;
  let startY = 0;
  let endX = 0;
  let endY = 0;
  let isDrawing = false;
  let selectionDiv: HTMLDivElement | null = null;

  overlay.addEventListener('mousedown', (e: MouseEvent) => {
    isDrawing = true;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

    startX = e.clientX + scrollLeft;
    startY = e.clientY + scrollTop;

    selectionDiv = document.createElement('div');
    selectionDiv.style.position = 'absolute';
    selectionDiv.style.left = `${startX}px`;
    selectionDiv.style.top = `${startY}px`;
    selectionDiv.style.width = '0px';
    selectionDiv.style.height = '0px';
    selectionDiv.style.border = '2px dashed rgba(0, 0, 0, 0.8)';
    selectionDiv.style.backgroundColor = 'rgba(0, 0, 255, 0.3)';
    selectionDiv.style.pointerEvents = 'none';
    selectionDiv.style.boxSizing = 'border-box';
    selectionDiv.style.zIndex = '100000';
    document.body.appendChild(selectionDiv);
  });

  overlay.addEventListener('mousemove', (e: MouseEvent) => {
    if (!isDrawing || !selectionDiv) return;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

    endX = e.clientX + scrollLeft;
    endY = e.clientY + scrollTop;
    const left = Math.min(startX, endX);
    const top = Math.min(startY, endY);
    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);

    selectionDiv.style.left = `${left}px`;
    selectionDiv.style.top = `${top}px`;
    selectionDiv.style.width = `${width}px`;
    selectionDiv.style.height = `${height}px`;
  });

  overlay.addEventListener('mouseup', async (e: MouseEvent) => {
    if (!isDrawing || !selectionDiv) return;
    isDrawing = false;

    document.body.removeChild(overlay);
    document.body.removeChild(selectionDiv);
    selectionDiv = null;

    const cropLeft = Math.min(startX, endX);
    const cropTop = Math.min(startY, endY);
    const cropWidth = Math.abs(endX - startX);
    const cropHeight = Math.abs(endY - startY);

    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(document.body, {
        x: cropLeft,
        y: cropTop,
        width: cropWidth,
        height: cropHeight,
        scale: window.devicePixelRatio || 1,
        useCORS: true
      });

      const htmlContent = document.documentElement.outerHTML;
      const screenshotData = {
        action: "screenshot_finished",
        data: canvas.toDataURL('image/png'),
        dimensions: {
          width: cropWidth,
          height: cropHeight
        },
        outerHTML: htmlContent
      };

      if (typeof browser !== 'undefined') {
        browser.runtime.sendMessage(screenshotData);
      } else if (typeof chrome !== 'undefined') {
        chrome.runtime.sendMessage(screenshotData);
      }
    } catch (err) {
      console.error('截图失败:', err);
    }
  });

  overlay.addEventListener('contextmenu', (e: MouseEvent) => {
    e.preventDefault();
    if (selectionDiv) {
      document.body.removeChild(selectionDiv);
    }
    document.body.removeChild(overlay);
  });

  document.body.appendChild(overlay);
}

// 监听来自 background 的消息
browser.runtime.onMessage.addListener((message) => {
  console.log('Content script received message:', message);
  if (message.action === 'start_element_selection') {
    startElementSelection();
  } else if (message.action === 'start_screenshot_capture') {
    startScreenshot();
  } else if (message.action === 'exit_selection') {
    exitSelectionMode();
  }
});
