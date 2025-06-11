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

// 监听来自 background 的消息
browser.runtime.onMessage.addListener((message) => {
  console.log('Content script received message:', message);
  if (message.action === 'start_element_selection') {
    startElementSelection();
  } else if (message.action === 'exit_selection') {
    exitSelectionMode();
  }
});
