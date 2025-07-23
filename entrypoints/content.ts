import { browser } from 'wxt/browser';

let highlightElement: HTMLElement | null = null;
let isSelecting = false;

// --- Helper Functions for Element Selection & Data Generation ---

function generateUniqueElementId(element: HTMLElement): string {
  if (element.id) return element.id;

  const dataAttrs = ['data-id', 'data-testid', 'data-test', 'data-cy', 'data-asin'];
  for (const attr of dataAttrs) {
    const value = element.getAttribute(attr);
    if (value) return `${attr}:${value}`;
  }

  const tag = element.tagName.toLowerCase();
  const classes = element.className ? element.className.replace(/\s+/g, '.') : '';
  const text = element.innerText?.substring(0, 20).replace(/\s+/g, '_') || '';

  return `${tag}${classes ? '.' + classes : ''}${text ? ':' + text : ''}`;
}

// REVISED: This function is now much more robust for sites like Amazon.
function generateOptimalSelector(element: HTMLElement): string {
  // Strategy 1: Prioritize stable, unique identifiers.
  // data-asin is perfect for e-commerce sites.
  let current: HTMLElement | null = element;
  while (current && current !== document.body) {
    const asin = current.getAttribute('data-asin');
    if (asin && asin.trim() !== '') {
      // Found a stable product container! This is the best selector.
      // We return a selector that finds the container and then looks for the specific element type within it.
      const tag = element.tagName.toLowerCase();
      // This creates a selector like `[data-asin="B08KTZ8249"] img.s-image`
      // It's very specific but also very stable.
      let selector = `[data-asin="${asin}"]`;
      if (element !== current) {
        // If the clicked element is a child of the ASIN container,
        // add its tag and classes for more precision.
        selector += ` ${element.tagName.toLowerCase()}`;
        if (element.className && element.className.trim()) {
          const classes = (typeof element.className === 'string') ? element.className.split(' ').filter(c => c.trim()) : [];
          if (classes.length > 0) {
            selector += `.${classes.join('.')}`;
          }
        } else {
          // For elements without classes, use nth-of-type to make selector more specific
          const parent = element.parentElement;
          if (parent) {
            const tagName = element.tagName.toLowerCase();
            const siblings = Array.from(parent.children).filter(el => el.tagName.toLowerCase() === tagName);
            if (siblings.length > 1) {
              const index = siblings.indexOf(element) + 1;
              selector += `:nth-of-type(${index})`;
            }
          }
        }
      }
      return selector;
    }
    current = current.parentElement;
  }

  // Strategy 2: Fallback to IDs or data-attributes if no ASIN container is found.
  if (element.id) {
    return `#${element.id.trim().replace(/\s/g, '\\ ')}`;
  }
  const dataAttrs = ['data-id', 'data-testid', 'data-test', 'data-cy'];
  for (const attr of dataAttrs) {
    const value = element.getAttribute(attr);
    if (value && document.querySelectorAll(`[${attr}="${value}"]`).length === 1) {
      return `[${attr}="${value}"]`;
    }
  }

  // Strategy 3: Brittle path-based selector as a last resort.
  const path: string[] = [];
  current = element;
  while (current && current !== document.body) {
    let selectorPart = current.tagName.toLowerCase();
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children);
      const tagName = current.tagName;
      const sameTagSiblings = siblings.filter(el => el.tagName === tagName);
      if (sameTagSiblings.length > 1) {
        const index = sameTagSiblings.indexOf(current) + 1;
        selectorPart += `:nth-of-type(${index})`;
      }
    }
    path.unshift(selectorPart);
    current = current.parentElement;
  }
  return path.join(' > ');
}


function generateHTMLSnippet(element: HTMLElement): string {
  let snippet = element.outerHTML;
  if (snippet.length > 500) {
    const openTagMatch = snippet.match(/^<[^>]*>/);
    const openTag = openTagMatch ? openTagMatch[0] : '';
    const closeTag = `</${element.tagName.toLowerCase()}>`;
    const remainingLength = 500 - openTag.length - closeTag.length - 3;
    if (remainingLength > 0) {
      const content = element.innerHTML.substring(0, remainingLength);
      snippet = `${openTag}${content}...${closeTag}`;
    } else {
      snippet = openTag + '...' + closeTag;
    }
  }
  return snippet;
}

// --- Element Selection Mode (User clicks on page) ---

let currentMouseMoveHandler: ((e: MouseEvent) => void) | null = null;
let currentClickHandler: ((e: MouseEvent) => void) | null = null;

function exitSelectionMode() {
  if (!isSelecting) return;
  if (highlightElement) {
    highlightElement.style.border = '';
    highlightElement.style.boxSizing = '';
    highlightElement = null;
  }
  if (currentMouseMoveHandler) document.removeEventListener('mousemove', currentMouseMoveHandler);
  if (currentClickHandler) document.removeEventListener('click', currentClickHandler);
  currentMouseMoveHandler = null;
  currentClickHandler = null;
  isSelecting = false;
}

function startElementSelection() {
  if (isSelecting) return;
  isSelecting = true;
  exitSelectionMode(); // Clean up any previous state
  isSelecting = true;

  const mouseMoveHandler = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (highlightElement) {
      highlightElement.style.border = '';
      highlightElement.style.boxSizing = '';
    }
    const target = e.target as HTMLElement;
    target.style.border = '2px solid rgba(0, 123, 255, 0.5)';
    target.style.boxSizing = 'border-box';
    highlightElement = target;
  };

  const clickHandler = (clickEvent: MouseEvent) => {
    clickEvent.preventDefault();
    clickEvent.stopPropagation();

    const target = clickEvent.target as HTMLElement;
    const data = target.innerText.trim() || (target instanceof HTMLImageElement ? target.src : null);
    if (data) {
      const selector = generateOptimalSelector(target);
      const elementId = generateUniqueElementId(target);
      const htmlSnippet = generateHTMLSnippet(target);

      browser.runtime.sendMessage({
        action: 'element_selected',
        type: target instanceof HTMLImageElement ? 'image' : 'text',
        data, selector, elementId, htmlSnippet,
        url: window.location.href,
        capturedAt: new Date().toISOString()
      });
    }
    exitSelectionMode();
  };

  document.addEventListener('mousemove', mouseMoveHandler);
  document.addEventListener('click', clickHandler, { once: true });
  currentMouseMoveHandler = mouseMoveHandler;
  currentClickHandler = clickHandler;
}

// --- Screenshot Logic ---
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

      const screenshotData = {
        action: "screenshot_finished",
        data: canvas.toDataURL('image/png'),
        dimensions: {
          width: cropWidth,
          height: cropHeight
        },
        url: window.location.href,
        capturedAt: new Date().toISOString()
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

// --- Element Highlighting Logic ---

function highlightTargetElement(selector: string, elementId?: string): boolean {
  let targetElement: HTMLElement | null = null;

  if (selector) {
    try {
      // First try the exact selector
      targetElement = document.querySelector(selector) as HTMLElement;
      
      // If not found and selector doesn't have nth-of-type, try to find all matching elements
      // and pick the most appropriate one
      if (!targetElement && !selector.includes(':nth-of-type')) {
        const elements = document.querySelectorAll(selector) as NodeListOf<HTMLElement>;
        if (elements.length > 0) {
          // For text elements, try to find one with visible text content
          for (const element of elements) {
            if (element.innerText && element.innerText.trim() && 
                element.offsetWidth > 0 && element.offsetHeight > 0) {
              targetElement = element;
              break;
            }
          }
          // If no visible text element found, just use the first one
          if (!targetElement) {
            targetElement = elements[0];
          }
        }
      }
    } catch (error) {
      console.warn('Invalid selector:', selector, error);
    }
  }

  if (!targetElement && elementId) {
    if (elementId.startsWith('#') || !elementId.includes(':')) {
      const id = elementId.startsWith('#') ? elementId.slice(1) : elementId;
      targetElement = document.getElementById(id);
    } else {
      const [attr, value] = elementId.split(':');
      if (attr && value) {
        targetElement = document.querySelector(`[${attr}="${value}"]`) as HTMLElement;
      }
    }
  }

  if (!targetElement) {
    // This is now expected on initial tries, so we downgrade from warn to log
    // console.log('Could not find target element yet. Waiting for DOM changes...');
    return false;
  }

  targetElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });

  const originalStyle = {
    border: targetElement.style.border,
    boxShadow: targetElement.style.boxShadow,
    outline: targetElement.style.outline,
    backgroundColor: targetElement.style.backgroundColor
  };

  targetElement.style.border = '3px solid #ff6b35';
  targetElement.style.boxShadow = '0 0 20px rgba(255, 107, 53, 0.8)';
  targetElement.style.outline = '2px solid rgba(255, 107, 53, 0.3)';
  targetElement.style.backgroundColor = 'rgba(255, 107, 53, 0.1)';

  setTimeout(() => {
    if (targetElement) { // Check if element still exists
      targetElement.style.border = originalStyle.border;
      targetElement.style.boxShadow = originalStyle.boxShadow;
      targetElement.style.outline = originalStyle.outline;
      targetElement.style.backgroundColor = originalStyle.backgroundColor;
    }
  }, 5000);

  return true;
}

function findAndHighlightOnLoad(selector: string, elementId?: string) {
  const timeout = 15000; // Wait up to 15 seconds
  let observer: MutationObserver | null = null;

  const cleanup = () => {
    if (observer) observer.disconnect();
    // Clean up the URL to remove the custom parameters
    if (window.history.replaceState) {
      const url = new URL(window.location.href);
      url.searchParams.delete('webseek_selector');
      url.searchParams.delete('webseek_element_id');
      window.history.replaceState({}, document.title, url.toString());
    }
  };

  const attemptToHighlight = () => {
    if (highlightTargetElement(selector, elementId)) {
      cleanup(); // Found it, stop observing and clean URL
      return true;
    }
    return false;
  };

  // First attempt, in case the page is static and loads fast
  if (attemptToHighlight()) {
    return;
  }

  // If not found, set up a MutationObserver to watch for dynamic changes
  observer = new MutationObserver((mutations) => {
    // Check if the element now exists after a DOM change
    // No need to iterate mutations, just re-run the check
    if (attemptToHighlight()) {
      // Success! Observer will be disconnected in cleanup()
    }
  });

  observer.observe(document.body, {
    childList: true, // Watch for added/removed nodes
    subtree: true    // Watch all descendants of `body`
  });

  // Failsafe: Stop observing after the timeout period
  setTimeout(() => {
    if (observer) {
      observer.disconnect();
      console.warn('Highlighting timed out. Could not find element.');
    }
    cleanup();
  }, timeout);
}

export default defineContentScript({
  matches: ['<all_urls>'],
  main(ctx) {
    console.log('WebSeek content script loaded into page.'); // Helpful for debugging

    // --- Message Listener from Background Script ---
    // This is safe to add here.
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'start_element_selection') {
        startElementSelection();
      } else if (message.action === 'start_screenshot_capture') {
        startScreenshot();
      } else if (message.action === 'exit_selection') {
        exitSelectionMode();
      } else if (message.action === 'highlight_element') {
        const success = highlightTargetElement(message.selector, message.elementId);
        sendResponse({ success });
        return true;
      }
    });

    // --- Page Load and URL Parameter Logic ---
    // MOVED HERE: This code now runs safely inside the page context.
    const initialUrlParams = new URLSearchParams(window.location.search);
    const initialSelector = initialUrlParams.get('webseek_selector');
    const initialElementId = initialUrlParams.get('webseek_element_id');

    if (initialSelector) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          findAndHighlightOnLoad(initialSelector, initialElementId || undefined);
        });
      } else {
        findAndHighlightOnLoad(initialSelector, initialElementId || undefined);
      }
    }

    // --- Hash Change Listener ---
    // MOVED HERE: This listener is now added in the correct context.
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash;
      if (hash.startsWith('#webseek:')) {
        try {
          const params = new URLSearchParams(hash.slice(9));
          const selector = params.get('selector');
          const elementId = params.get('element_id');
          if (selector) {
            findAndHighlightOnLoad(selector, elementId || undefined);
            if (window.history.replaceState) {
              window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
            }
          }
        } catch (error) {
          console.warn('Failed to parse webseek hash parameters:', error);
        }
      }
    });
  },
});