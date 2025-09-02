// import htmlclean from 'htmlclean';
import { Instance, EmbeddedInstance, TextInstance, EmbeddedImageInstance, EmbeddedSketchInstance, EmbeddedTableInstance, EmbeddedTextInstance, ImageInstance, SketchInstance, TableInstance, SketchItem, VisualizationInstance, InstanceSource, WebCaptureSource, ManualSource, Locator, InstanceEvent } from './types';

// Helper function to generate meaningful IDs for different instance types
export const generateTypedId = (type: string, existingInstances: any[] = []) => {
  const typeMap: { [key: string]: string } = {
    'text': 'Text',
    'image': 'Image', 
    'sketch': 'Sketch',
    'table': 'Table',
    'visualization': 'Visualization'
  };
  
  const prefix = typeMap[type] || 'Instance';
  
  // Find the highest existing number for this type
  const regex = new RegExp(`^${prefix}(\d+)$`);
  let maxNum = 0;
  
  existingInstances.forEach(inst => {
    if (inst.id) {
      const match = inst.id.match(regex);
      if (match) {
        maxNum = Math.max(maxNum, parseInt(match[1]));
      }
    }
  });
  
  return `${prefix}${maxNum + 1}`;
};

// Helper function to generate temporary ID with suffix for editing existing instances
export const generateEditingId = (originalId: string) => {
  const match = originalId.match(/^(.+?)(_\d+)?$/);
  const baseId = match ? match[1] : originalId;
  
  // Find the next available suffix number
  let suffix = 1;
  const existingIds = new Set(); // This would need to be passed from context in real usage
  
  // For now, just append _1, _2, etc. 
  let newId = `${baseId}_${suffix}`;
  while (existingIds.has(newId)) {
    suffix++;
    newId = `${baseId}_${suffix}`;
  }
  
  return newId;
};

// Keep the old function for backward compatibility with existing code that still needs it
export const generateId = () => '_' + Math.random().toString(36).substring(2, 9);

/**
 * A simple, fast hashing function for deterministic ID generation.
 * Based on cyrb53 - a high-quality, non-cryptographic hash function.
 */
const cyrb53 = (str: string, seed = 0): string => {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0, ch; i < str.length; i++) {
        ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return "aid-" + (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
};

/**
 * A list of known stable attributes to prioritize for signatures.
 * This can be customized for specific sites.
 */
const STABLE_ATTRIBUTES = ['id', 'data-asin', 'data-testid', 'data-csa-c-id', 'name', 'data-cy', 'data-test'];

/**
 * Generates a highly robust, deterministic signature for an element using a hybrid approach.
 * @param element The DOM element.
 * @returns A signature string ready to be hashed.
 */
function generateHybridSignature(element: Element): string {
    // === PRIORITY 1: Check for stable attributes ===
    for (const attrName of STABLE_ATTRIBUTES) {
        if (element.hasAttribute(attrName)) {
            const attrValue = element.getAttribute(attrName);
            // Return a signature based on the attribute name and value
            return `attr:${attrName}=${attrValue}`;
        }
    }

    // === PRIORITY 2: Check for meaningful content hash ===
    // We get the text content, but only from the element itself, not its children.
    let immediateText = '';
    if (typeof window !== 'undefined' && typeof Node !== 'undefined') {
        for (const childNode of Array.from(element.childNodes)) {
            if (childNode.nodeType === Node.TEXT_NODE) {
                immediateText += childNode.textContent;
            }
        }
    }
    const normalizedText = immediateText.trim().replace(/\s+/g, ' ');

    // Only use text if it's substantial enough to be unique
    if (normalizedText.length > 10) { 
        // We only hash the first 100 chars to keep it efficient and stable
        const textSnippet = normalizedText.substring(0, 100);
        const textHash = cyrb53(textSnippet);
        
        // We still anchor it to the nearest parent ID for more context
        const parentAnchor = getNearestParentIdSignature(element.parentElement);
        return `${parentAnchor.signature}:text-hash=${textHash}`;
    }

    // === PRIORITY 3 (Fallback): Use the structural path ===
    // This is our previous, more brittle method, used only when necessary.
    const parentAnchor = getNearestParentIdSignature(element.parentElement);
    const structuralPath = getRelativeStructuralPath(element, parentAnchor.element);
    return `${parentAnchor.signature}:${structuralPath}`;
}

// Helper function to find the nearest anchor (parent with ID or BODY)
function getNearestParentIdSignature(startElement: Element | null): { signature: string, element: Element | null } {
    let current = startElement;
    while (current && current.tagName !== 'BODY') {
        if (current.id) {
            return { signature: `id:${current.id}`, element: current };
        }
        current = current.parentElement;
    }
    const bodyElement = typeof document !== 'undefined' ? document.body : null;
    return { signature: 'body', element: bodyElement };
}

// Helper function to get the path relative to a given anchor element
function getRelativeStructuralPath(element: Element, anchorElement: Element | null): string {
    const path: string[] = [];
    let current: Element | null = element;

    // Stop when we reach the anchor or the body
    while (current && current !== anchorElement && current.tagName !== 'BODY') {
        const tagName = current.tagName;
        let siblingIndex = 0;
        let sibling = current.previousElementSibling;
        while (sibling) {
            if (sibling.tagName === tagName) {
                siblingIndex++;
            }
            sibling = sibling.previousElementSibling;
        }
        path.push(`${tagName}[${siblingIndex}]`);
        current = current.parentElement;
    }
    return path.reverse().join('/');
}

/**
 * Generates a deterministic, stable ID for any DOM element using the hybrid approach.
 * This ID will be the same across page reloads for elements with stable attributes or content.
 * @param element The target DOM element.
 * @returns A stable ID string like "aid-a1b2c3d4"
 */
function generateStableId(element: Element): string {
    const signature = generateHybridSignature(element);
    return cyrb53(signature);
}

/**
 * Find an element based on a Locator object.
 * This replaces the brittle CSS selector string approach.
 */
export function findElementByLocator(locator: Locator): HTMLElement | null {
  // Only run in browser environment
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return null;
  }
  
  // First ensure stable IDs are injected into the page
  injectStableIdsIntoLivePage();
  return document.querySelector(`[data-aid-id="${locator}"]`);
}

/**
 * Convert a Locator string to a CSS selector string for backward compatibility.
 */
export function locatorToSelector(locator: Locator): string {
  return `[data-aid-id="${locator}"]`;
}

// Helper function to create proper source from legacy sourcePageId or create manual source
function createInstanceSource(input: any): InstanceSource {
    // If input has the new source structure, use it
    if (input.source && typeof input.source === 'object') {
        if (input.source.type === 'web' || input.source.type === 'manual') {
            return input.source;
        }
    }
    
    // Legacy support: convert sourcePageId to WebCaptureSource
    if (input.sourcePageId || input.pageId) {
        let locator: Locator;
        
        // Convert legacy selector to new locator format
        if (input.locator) {
            // Use the locator if available
            locator = input.locator;
        } else {
            // If no locator, use a fallback
            locator = 'unknown';
        }
        
        return {
            type: 'web',
            pageId: input.pageId || input.sourcePageId, // Prefer new pageId over legacy sourcePageId
            locator: locator
        };
    }
    
    // Default to manual source
    return {
        type: 'manual'
    };
}

export const getVisualizationThumbnail = async (spec: object): Promise<string> => {
    try {
        const response = await fetch(`http://${import.meta.env.VITE_BACKEND_URL}/api/render-interactive-svg/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...spec,
                // Use responsive sizing for better display
                width: 'container',
                height: 'container'
            })
        });
        if (!response.ok) throw new Error('Failed to fetch visualization');
        
        const svgContent = await response.text();
        // Convert SVG to data URL
        const svgBlob = new Blob([svgContent], { type: 'image/svg+xml' });
        return await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                resolve(reader.result as string);
            };
            reader.onerror = () => {
                console.error('Failed to read SVG blob');
                reject('Failed to read SVG blob');
            };
            reader.readAsDataURL(svgBlob);
        });
    } catch (err: any) {
        console.error(err.message || err);
        return '';
    }
};

// Get the geometry of an instance
export function getInstanceGeometry(inst: any) {
    let x = inst.x ?? 0;
    let y = inst.y ?? 0;
    let width: number;
    let height: number;
    if (inst.type === 'text') {
        width = inst.width ?? 100;
        height = inst.height ?? 20;
    } else if (inst.type === 'image') {
        width = inst.width ?? 100;
        height = inst.height ?? 100;
    } else if (inst.type === 'sketch' || inst.type === 'table') {
        width = inst.width ?? 400;
        height = inst.height ?? 300;
    } else {
        width = inst.width ?? 100;
        height = inst.height ?? 100;
    }
    return { x, y, width, height };
}

function sanitizeJSONString(jsonString: any): any {
    if (typeof jsonString !== 'string') {
        return jsonString;
    }

    // Replace invalid escaped single quotes (e.g., `\'`) with plain quotes (`'`)
    let sanitized = jsonString.replace(/\\'/g, "'");

    // Replace escaped spaces (`\s`) with actual spaces
    sanitized = sanitized.replace(/\\s/g, ' ');

    return sanitized;
}

export function extractJSONFromResponse(response: string) {
    try {
        // Use a regular expression to find JSON-like structures in the response
        const jsonMatch = response.match(/{[\s\S]*}/);

        // If a match is found, parse it into a JavaScript object
        if (jsonMatch) {
            const jsonString = jsonMatch[0];
            return JSON.parse(sanitizeJSONString(jsonString));
        } else {
            throw new Error("No JSON found in the response");
        }
    } catch (error: any) {
        console.log("Error extracting JSON from response:", error.message || error);
        return null;
    }
}
// Convert column index to Excel-style letters (0 -> A, 1-> B, etc.)
export const indexToLetters = (index: number): string => {
    let letters = '';
    do {
        letters = String.fromCharCode(65 + (index % 26)) + letters;
        index = Math.floor(index / 26) - 1;
    } while (index >= 0);
    return letters;
};

/**
 * Normalizes a table instance to ensure it has required columnNames and columnTypes
 * This is needed for backward compatibility with existing table instances
 */
export const normalizeTableInstance = (table: any): any => {
    if (table.type !== 'table') return table;
    
    const normalizedTable = { ...table };
    
    // Ensure columnNames exist
    if (!normalizedTable.columnNames || normalizedTable.columnNames.length !== normalizedTable.cols) {
        normalizedTable.columnNames = Array.from({ length: normalizedTable.cols }, (_, i) => indexToLetters(i));
    }
    
    // Ensure columnTypes exist
    if (!normalizedTable.columnTypes || normalizedTable.columnTypes.length !== normalizedTable.cols) {
        normalizedTable.columnTypes = Array.from({ length: normalizedTable.cols }, () => 'categorical' as const);
    }
    
    return normalizedTable;
};

/**
 * Injects stable IDs into all elements in a document for reliable element tracking.
 * Uses deterministic ID generation based on element structure for consistency across reloads.
 * This creates a bridge between original DOM and cleaned DOM.
 */
export const injectStableIds = (doc: Document): Document => {
    const allElements = doc.querySelectorAll('*');
    allElements.forEach(el => {
        // Only inject if the element doesn't already have a stable ID
        if (!el.hasAttribute('data-aid-id')) {
            const stableId = generateStableId(el);
            el.setAttribute('data-aid-id', stableId);
        }
    });
    return doc;
};

/**
 * Injects stable IDs into a live page's DOM (for navigation purposes).
 * Uses deterministic ID generation for consistency across page reloads.
 */
export const injectStableIdsIntoLivePage = (): void => {
    // Only run in browser environment
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return;
    }
    
    const allElements = document.querySelectorAll('*');
    allElements.forEach(el => {
        // Only inject if the element doesn't already have a stable ID
        if (!el.hasAttribute('data-aid-id')) {
            const stableId = generateStableId(el);
            el.setAttribute('data-aid-id', stableId);
        }
    });
};

/**
 * Creates a stable ID locator for a given element.
 * Ensures stable IDs are injected and returns the most reliable locator type.
 */
export const createStableIdLocator = (element: HTMLElement): Locator => {
    // Only run in browser environment
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return 'body';
    }
    
    // Ensure stable IDs are injected
    injectStableIdsIntoLivePage();
    
    const stableId = element.getAttribute('data-aid-id');
    if (stableId) {
        return stableId;
    }
    
    // If no stable ID is available, we should still try to generate one
    // or return a fallback stable ID
    return 'unknown';
};


/**
 * Sets up a MutationObserver to inject stable IDs into dynamically added content.
 * Uses deterministic ID generation for consistency.
 * Call this once when the page loads to handle SPAs and dynamic content.
 */
export const setupStableIdObserver = (): (() => void) => {
    // Only run in browser environment
    if (typeof window === 'undefined' || typeof document === 'undefined' || typeof MutationObserver === 'undefined') {
        return () => {}; // Return no-op cleanup function
    }
    
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    const element = node as Element;
                    
                    // Inject stable ID for the new element if it doesn't have one
                    if (!element.hasAttribute('data-aid-id')) {
                        const stableId = generateStableId(element);
                        element.setAttribute('data-aid-id', stableId);
                    }
                    
                    // Inject stable IDs for all descendants
                    const descendants = element.querySelectorAll('*');
                    descendants.forEach((descendant) => {
                        if (!descendant.hasAttribute('data-aid-id')) {
                            const stableId = generateStableId(descendant);
                            descendant.setAttribute('data-aid-id', stableId);
                        }
                    });
                }
            });
        });
    });
    
    // Start observing
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    // Return cleanup function
    return () => observer.disconnect();
};

export const cleanHTML = (htmlString: string): string => {
    // Define reusable tag sets
    const voidTags = new Set<string>([
        'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
        'keygen', 'link', 'meta', 'param', 'source', 'track', 'wbr'
    ]);
    const inlineTags = new Set<string>([
        'a', 'abbr', 'acronym', 'b', 'bdo', 'big', 'cite', 'code', 'dfn',
        'em', 'i', 'kbd', 'label', 'map', 'object', 'output',
        'q', 'samp', 'select', 'small', 'span', 'strong', 'sub', 'sup',
        'textarea', 'time', 'tt', 'var', 'div'
    ]);

    // Parse HTML into DOM
    const parser = new DOMParser();
    let doc = parser.parseFromString(htmlString, 'text/html');

    // 1. INJECT STABLE IDs as the very first step
    doc = injectStableIds(doc);

    // Remove head element
    if (doc.head) doc.head.remove();

    // Remove unwanted tags
    const tagsToRemove = ['script', 'noscript', 'style'];
    tagsToRemove.forEach(tag => {
        const elements = doc.querySelectorAll(tag);
        elements.forEach(el => el.remove());
    });

    // Remove tracking pixels and analytics images
    doc.querySelectorAll('img').forEach(img => {
        const src = img.getAttribute('src') || '';
        if (src.includes('sync') || src.includes('.php') || src.includes('serving') || 
            src.includes('analytics') || src.includes('tracking') || src.includes('beacon')) {
            img.remove();
        }
    });

    // Remove external stylesheets that can trigger network requests
    doc.querySelectorAll('link[rel="stylesheet"]').forEach(link => link.remove());

    // 2. Remove all attributes except src and data-aid-id
    const allElements = doc.querySelectorAll('*');
    allElements.forEach(el => {
        const attributes = Array.from(el.attributes);
        attributes.forEach(attr => {
            // Keep 'src' and our stable ID 'data-aid-id'
            if (attr.name !== 'src' && attr.name !== 'data-aid-id') {
                el.removeAttribute(attr.name);
            }
        });
    });

    // Remove comments
    const comments = doc.createNodeIterator(
        doc,
        NodeFilter.SHOW_COMMENT
    );
    let commentNode: Node | null;
    while ((commentNode = comments.nextNode())) {
        commentNode.parentNode?.removeChild(commentNode);
    }

    // Remove empty nodes (elements and text nodes)
    function removeEmptyNodes(node: Node): boolean {
        // Skip void elements (self-closing tags like img)
        if (node.nodeType === Node.ELEMENT_NODE && voidTags.has(node.nodeName.toLowerCase())) {
            return false;
        }

        // Remove empty text nodes
        if (node.nodeType === Node.TEXT_NODE) {
            if (node.textContent?.trim() === '') {
                node.parentNode?.removeChild(node);
                return true;
            }
            return false;
        }

        // Process element nodes
        if (node.nodeType === Node.ELEMENT_NODE) {
            // Process children in reverse order
            for (let i = node.childNodes.length - 1; i >= 0; i--) {
                removeEmptyNodes(node.childNodes[i]);
            }

            // Remove if no children remain (skip body)
            if (node.childNodes.length === 0 && node !== doc.body) {
                node.parentNode?.removeChild(node);
                return true;
            }
            return false;
        }
        return false;
    }

    // Start removal from body
    if (doc.body) {
        removeEmptyNodes(doc.body);
    }

    // Flatten inline elements with single children
    function flattenInlineElements(node: Node): void {
        if (node.nodeType !== Node.ELEMENT_NODE) return;

        // Recursively flatten children
        for (let i = 0; i < node.childNodes.length; i++) {
            flattenInlineElements(node.childNodes[i]);
        }

        // Flatten eligible inline elements
        if (inlineTags.has(node.nodeName.toLowerCase()) && node.childNodes.length === 1) {
            const child = node.firstChild;
            if (child) {
                node.parentNode?.replaceChild(child, node);
            }
        }
    }

    if (doc.body) {
        flattenInlineElements(doc.body);
    }

    // Get cleaned HTML
    const result = doc.body ? doc.body.innerHTML : '';

    // Remove empty lines and tabs
    return result
        .split('\n')
        .filter(line => line.trim() !== '')
        .join('\n')
        .replace(/\t/g, '');
};

export const cleanHTMLScript = (htmlString: string): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');

  // Remove all <script> elements
  doc.querySelectorAll('script').forEach(script => script.remove());

  // Also remove any inline event handler attributes? (Not requested — left intact.)
  // If you later want to remove on* attributes for safety, uncomment the block below.
  /*
  doc.querySelectorAll('*').forEach(el => {
    Array.from(el.attributes).forEach(attr => {
      if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
    });
  });
  */

  // Return full HTML (including head) or just body.innerHTML depending on needs.
  // Here we return the entire document's HTML (including <!doctype> lost by parser) by serializing:
  return doc.documentElement ? doc.documentElement.outerHTML : doc.body?.innerHTML || '';
};

export const generateInstanceContext = async (instances: Instance[]): Promise<any> => {
    let image_num = 0;
    let imageMap = new Map<string, number>();
    let imageContext: any = [], textContext = '';
    const getImageIndex = (id: string, src: string): number => {
        if (imageMap.has(id)) {
            return imageMap.get(id)!;
        } else {
            image_num += 1;
            imageMap.set(id, image_num);
            imageContext.push({
                "type": "image_url",
                "image_url": {
                    "url": src
                }
            })
            return image_num;
        }
    }


    // Helper function to process instances and collect image URLs for imageContext
    const processInstanceForImages = (instance: Instance): void => {
        if (instance.type === 'image') {
            getImageIndex(instance.id, instance.src);
        } else if (instance.type === 'sketch' && instance.thumbnail) {
            getImageIndex(instance.id, instance.thumbnail);
            // Process embedded instances in sketch content
            instance.content.forEach(item => {
                if (item.type === 'instance' && item.instance.type === 'image' && !item.instance.originalId) {
                    getImageIndex(item.instance.id, item.instance.src);
                }
            });
        } else if (instance.type === 'table') {
            // Process embedded instances in table cells
            instance.cells.forEach(rowArr => {
                rowArr.forEach(cell => {
                    if (cell && cell.type === 'image' && !cell.originalId) {
                        getImageIndex(cell.id, cell.src);
                    } else if (cell && cell.type === 'visualization' && cell.thumbnail && !cell.originalId) {
                        getImageIndex(cell.id, cell.thumbnail);
                    }
                });
            });
        } else if (instance.type === 'visualization' && instance.thumbnail) {
            getImageIndex(instance.id, instance.thumbnail);
        }
    };

    const instanceToJSON = (instance: Instance): string => {
        // Process the instance to collect images for imageContext
        processInstanceForImages(instance);
        
        // Use JSON.stringify directly on the instance
        return JSON.stringify(instance);
    }


    instances.forEach(instance => {
        textContext += `Instance ID: ${instance.id}\nType: ${instance.type}\nContent: ${instanceToJSON(instance)}\n\n`;
    })

    // Add paragraph linking image IDs to imageContext indices
    // if (imageMap.size > 0) {
    //     textContext += "Image Context Reference:\n";
    //     Array.from(imageMap.entries()).forEach(([imageId, index]) => {
    //         textContext += `Image ID "${imageId}" corresponds to image ${index} in the images you received.\n`;
    //     });
    //     textContext += "\n";
    // }

    return { imageContext, textContext };
}

export async function parseInstance(input: any): Promise<Instance | EmbeddedInstance> {
    if (typeof input !== 'object' || input === null) {
        throw new Error('Input must be an object');
    }

    const type = input.type;
    if (typeof type !== 'string') {
        throw new Error('Input must have a string type field');
    }

    switch (type) {
        case 'text':
            return parseTextInstance(input);
        case 'image':
            return parseImageInstance(input);
        case 'sketch':
            return await parseSketchInstance(input);
        case 'table':
            return await parseTableInstance(input);
        case 'visualization':
            let visualization = await parseVisualizationInstance(input);
            return visualization;
        default:
            throw new Error(`Unknown type: ${type}`);
    }
}

// Helper functions for each type
function parseTextInstance(input: any): TextInstance | EmbeddedTextInstance {
    const id = input.id || generateId();
    const content = input.content || input.text || '';
    const source = createInstanceSource(input);

    if (hasGeometricProperties(input)) {
        return {
            type: 'text',
            id,
            source,
            content,
            x: input.x,
            y: input.y,
            width: input.width,
            height: input.height,
            originalId: input.originalId,
        };
    }

    return {
        type: 'text',
        id,
        source,
        content,
        originalId: input.originalId,
    };
}

function parseImageInstance(input: any): ImageInstance | EmbeddedImageInstance {
    const id = input.id || generateId();
    const source = createInstanceSource(input);

    if (hasGeometricProperties(input)) {
        return {
            type: 'image',
            id,
            source,
            src: input.src,
            x: input.x,
            y: input.y,
            width: input.width,
            height: input.height,
            originalId: input.originalId,
        };
    }

    return {
        type: 'image',
        id,
        source,
        src: input.src,
        originalId: input.originalId,
    };
}

async function parseSketchInstance(input: any): Promise<SketchInstance | EmbeddedSketchInstance> {
    const id = input.id || generateId();
    const source = createInstanceSource(input);

    if (hasGeometricProperties(input)) {
        return {
            type: 'sketch',
            id,
            source,
            x: input.x,
            y: input.y,
            width: input.width,
            height: input.height,
            content: await parseSketchContent(input.content || []),
            thumbnail: input.thumbnail || '',
            originalId: input.originalId,
        };
    }

    return {
        type: 'sketch',
        id,
        source,
        originalId: input.originalId,
    };
}

async function parseTableInstance(input: any): Promise<TableInstance | EmbeddedTableInstance> {
    const id = input.id || generateId();
    const source = createInstanceSource(input);
    let tableData: any;

    // Handle both table formats (nested content vs flat)
    if (input.content && typeof input.content === 'object') {
        tableData = input.content;
    } else {
        tableData = input;
    }

    // Convert flat or 2D cells to 2D array
    let cells: Array<Array<EmbeddedInstance | null>> = [];
    if (Array.isArray(tableData.cells) && Array.isArray(tableData.cells[0])) {
        // Already 2D
        cells = await Promise.all(tableData.cells.map(async (row: any[]) =>
            await Promise.all(row.map(async cell => cell ? await parseInstance(cell) as EmbeddedInstance : null))
        ));
    } else if (Array.isArray(tableData.cells)) {
        // Flat array with row/col
        const maxRow = Math.max(0, ...tableData.cells.map((cell: any) => cell.row || 0));
        const maxCol = Math.max(0, ...tableData.cells.map((cell: any) => cell.col || 0));
        cells = Array.from({ length: maxRow + 1 }, () => Array(maxCol + 1).fill(null));
        for (const cell of tableData.cells) {
            if (typeof cell.row === 'number' && typeof cell.col === 'number') {
                cells[cell.row][cell.col] = cell.content ? await parseInstance(cell.content) as EmbeddedInstance : null;
            }
        }
    }

    const table: any = {
        type: 'table',
        id,
        source,
        rows: tableData.rows || (cells.length),
        cols: tableData.cols || (cells[0]?.length || 0),
        cells,
        x: input.x || 0,
        y: input.y || 0,
        width: input.width || 400,
        height: input.height || 300,
        originalId: input.originalId,
    };

    return normalizeTableInstance(table);
}

async function parseVisualizationInstance(input: any): Promise<VisualizationInstance> {
    const id = input.id || generateId();
    const source = createInstanceSource(input);
    
    if (!input.thumbnail) {
        input.thumbnail = await getVisualizationThumbnail(input.spec);
    }
    
    return {
        type: 'visualization' as const,
        id,
        source,
        spec: input.spec,
        thumbnail: input.thumbnail,
        originalId: input.originalId,
        x: input.x,
        y: input.y,
        width: input.width,
        height: input.height
    };
}

// Helper for sketch content
async function parseSketchContent(items: any[]): Promise<SketchItem[]> {
    return Promise.all(items.map(async item => {
        switch (item.type) {
            case 'stroke':
                return {
                    type: 'stroke',
                    id: item.id || Math.random().toString(36).substring(2, 9),
                    points: item.points || [],
                    color: item.color || '#000000',
                    width: item.width || 1,
                };
            case 'instance':
                return {
                    type: 'instance',
                    id: item.id || Math.random().toString(36).substring(2, 9),
                    instance: await parseInstance(item.instance) as EmbeddedInstance,
                    x: item.x || 0,
                    y: item.y || 0,
                    width: item.width || 0,
                    height: item.height || 0,
                };
            default:
                throw new Error(`Unknown sketch item type: ${item.type}`);
        }
    }));
}

// Check for geometric properties
function hasGeometricProperties(obj: any): boolean {
    return (
        typeof obj.x === 'number' &&
        typeof obj.y === 'number' &&
        typeof obj.width === 'number' &&
        typeof obj.height === 'number'
    );
}

// Markdown detection and rendering utilities
export const detectMarkdown = (text: string): boolean => {
    // Common markdown patterns
    const markdownPatterns = [
        /^#{1,6}\s+/m,                    // Headers (# ## ### etc.)
        /\*\*.*?\*\*/,                    // Bold (**text**)
        /\*.*?\*/,                        // Italic (*text*)
        /`.*?`/,                          // Inline code (`code`)
        /```[\s\S]*?```/,                 // Code blocks (```code```)
        /\[.*?\]\(.*?\)/,                 // Links ([text](url))
        /^\s*[-*+]\s+/m,                  // Unordered lists (- * +)
        /^\s*\d+\.\s+/m,                  // Ordered lists (1. 2. etc.)
        /^\s*>\s+/m,                      // Blockquotes (> text)
        /^\s*\|.*\|.*\|/m,                // Tables (| col1 | col2 |)
        /~~.*?~~/,                        // Strikethrough (~~text~~)
        /^---+$/m,                        // Horizontal rules (---)
        /^===+$/m,                        // Horizontal rules (===)
    ];

    return markdownPatterns.some(pattern => pattern.test(text));
};

export const renderMarkdown = (text: string): string => {
    if (!detectMarkdown(text)) {
        return text;
    }

    let html = text;

    // Escape HTML characters first
    html = html
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Italic
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Inline code
    html = html.replace(/`(.*?)`/g, '<code>$1</code>');

    // Code blocks
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // Unordered lists
    html = html.replace(/^\s*[-*+]\s+(.*$)/gim, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

    // Ordered lists
    html = html.replace(/^\s*\d+\.\s+(.*$)/gim, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ol>$1</ol>');

    // Blockquotes
    html = html.replace(/^\s*>\s+(.*$)/gim, '<blockquote>$1</blockquote>');

    // Strikethrough
    html = html.replace(/~~(.*?)~~/g, '<del>$1</del>');

    // Horizontal rules
    html = html.replace(/^---+$/gim, '<hr>');
    html = html.replace(/^===+$/gim, '<hr>');

    // Line breaks
    html = html.replace(/\n/g, '<br>');

    return html;
};

/**
 * Ensures all instances have valid, non-empty, and unique IDs. If not, generates a new unique ID using type-based prefix.
 * @param instances Array of instances to check
 * @param existingIds Array of IDs already in use (optional)
 * @returns Array of instances with valid, unique IDs
 */
export function ensureValidInstanceIds(instances: any[], existingIds: string[] = []): any[] {
    const usedIds = new Set(existingIds.map(id => id.toLowerCase()));
    return instances.map(inst => {
        let id = inst.id;
        // If missing, empty, or duplicate (case-insensitive), generate a new one
        if (!id || typeof id !== 'string' || usedIds.has(id.toLowerCase())) {
            id = generateId();
        }
        usedIds.add(id.toLowerCase());
        return { ...inst, id };
    });
}

/**
 * Create a sketch thumbnail as a data URL
 */
export const createSketchThumbnail = async (
    sketch: SketchInstance,
    currentStroke: { id: string; points: { x: number; y: number }[] } | null,
    sketchColor: string,
    sketchWidth: number,
    wrapTextForThumbnail: (
        ctx: CanvasRenderingContext2D,
        text: string,
        maxWidth: number,
        maxHeight: number
    ) => string[],
    canvasWidth: number,
    canvasHeight: number
): Promise<string> => {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvasWidth;
    tempCanvas.height = canvasHeight;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return '';

    // Fill background as white
    tempCtx.fillStyle = 'white';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    // Draw all strokes
    sketch.content.forEach(item => {
        if (item.type === 'stroke') {
            tempCtx.beginPath();
            tempCtx.strokeStyle = item.color;
            tempCtx.lineWidth = item.width;
            tempCtx.lineCap = 'round';
            tempCtx.lineJoin = 'round';
            item.points.forEach((point: { x: number; y: number }, i: number) => {
                if (i === 0) {
                    tempCtx.moveTo(point.x, point.y);
                } else {
                    tempCtx.lineTo(point.x, point.y);
                }
            });
            tempCtx.stroke();
        }
        // Draw embedded text items
        else if (item.type === 'instance' && item.instance.type === 'text') {
            tempCtx.save();
            tempCtx.fillStyle = '#000';
            tempCtx.font = '12px sans-serif';
            const lines = wrapTextForThumbnail(
                tempCtx,
                item.instance.content,
                item.width,
                item.height
            );
            lines.forEach((line: string, i: number) => {
                tempCtx.fillText(
                    line,
                    item.x,
                    item.y + 12 + (i * 15)
                );
            });
            tempCtx.restore();
        }
        // Queue image drawing (async)
        else if (item.type === 'instance' && item.instance.type === 'image') {
            const img = new window.Image();
            img.src = item.instance.src;
            img.onload = () => {
                tempCtx.drawImage(img, item.x, item.y, item.width, item.height);
            };
        }
        else if (item.type === 'instance' && item.instance.type === 'table') {
            const table = item.instance;
            const cellWidth = item.width / table.cols;
            const cellHeight = item.height / table.rows;
            for (let r = 0; r < table.rows; r++) {
                for (let c = 0; c < table.cols; c++) {
                    const cell = table.cells[r][c];
                    if (!cell) continue;
                    // Draw cell border
                    tempCtx.strokeStyle = '#ccc';
                    tempCtx.lineWidth = 1;
                    tempCtx.strokeRect(
                        item.x + c * cellWidth,
                        item.y + r * cellHeight,
                        cellWidth,
                        cellHeight
                    );
                    // Draw content of the first item in the cell
                    if (cell) {
                        if (cell.type === 'text') {
                            tempCtx.fillStyle = '#000';
                            tempCtx.font = '10px sans-serif';
                            const lines = wrapTextForThumbnail(
                                tempCtx,
                                cell.content,
                                cellWidth - 4,
                                cellHeight - 4
                            );
                            lines.forEach((line: string, i: number) => {
                                tempCtx.fillText(
                                    line,
                                    item.x + c * cellWidth + 2,
                                    item.y + r * cellHeight + 10 + (i * 12)
                                );
                            });
                        } else if (cell.type === 'image') {
                            // Draw a placeholder image icon
                            tempCtx.save();
                            tempCtx.fillStyle = '#eee';
                            tempCtx.fillRect(
                                item.x + c * cellWidth + 1,
                                item.y + r * cellHeight + 1,
                                cellWidth - 2,
                                cellHeight - 2
                            );
                            tempCtx.strokeStyle = '#999';
                            tempCtx.strokeRect(
                                item.x + c * cellWidth + 5,
                                item.y + r * cellHeight + 5,
                                cellWidth - 10,
                                cellHeight - 10
                            );
                            tempCtx.beginPath();
                            tempCtx.moveTo(item.x + c * cellWidth + 5, item.y + r * cellHeight + cellHeight - 5);
                            tempCtx.lineTo(item.x + c * cellWidth + cellWidth / 2, item.y + r * cellHeight + 5);
                            tempCtx.lineTo(item.x + c * cellWidth + cellWidth - 5, item.y + r * cellHeight + cellHeight - 5);
                            tempCtx.stroke();
                            tempCtx.restore();
                        }
                    }
                }
            }
        }
    });
    // Add current stroke if still drawing
    if (currentStroke) {
        tempCtx.beginPath();
        tempCtx.strokeStyle = sketchColor;
        tempCtx.lineWidth = sketchWidth;
        tempCtx.lineCap = 'round';
        tempCtx.lineJoin = 'round';
        currentStroke.points.forEach((point: { x: number; y: number }, i: number) => {
            if (i === 0) {
                tempCtx.moveTo(point.x, point.y);
            } else {
                tempCtx.lineTo(point.x, point.y);
            }
        });
        tempCtx.stroke();
    }
    // Wait for all images to load before finalizing the thumbnail
    await new Promise(resolve => {
        const interval = setInterval(() => {
            if (sketch.content.every(item => {
                if (item.type === 'instance' && item.instance.type === 'image') {
                    const img = new window.Image();
                    img.src = item.instance.src;
                    return img.complete;
                }
                return true;
            })) {
                clearInterval(interval);
                resolve(undefined);
            }
        }, 100);
    });
    return tempCanvas.toDataURL('image/png');
};

export function mapToObject(obj: any): any {
    if (obj instanceof Map) {
        return Object.fromEntries(
            Array.from(obj.entries()).map(([k, v]) => [k, mapToObject(v)])
        );
    } else if (Array.isArray(obj)) {
        return obj.map(mapToObject);
    } else {
        return obj;
    }
}

export function updateInstances(
    oldInstances: Instance[], 
    newInstances: InstanceEvent[] | null | undefined, 
    setInstances: (instances: Instance[]) => void,
    onTableModified?: (tableId: string) => void
): void {
    // If there are structured results, update the instances
    console.log("Old instances:", oldInstances);
    let instancesClone = structuredClone(oldInstances);
    const modifiedTableIds = new Set<string>();
    
    if (newInstances && newInstances.length > 0) {
        newInstances.forEach(event => {
            // Track table modifications
            if (event.action === "update" && event.instance?.type === 'table') {
                const targetId = event.targetId || event.instance.id;
                modifiedTableIds.add(targetId);
            } else if (event.action === "add" && event.instance?.type === 'table') {
                modifiedTableIds.add(event.instance.id);
            }
            
            // Fill incomplete fields of event.instance
            if (event.instance) {
                event.instance.id = event.instance.id || generateId();
                if (event.instance.type == "sketch" && !event.instance.thumbnail) {
                    // Generate thumbnail for sketch instances without one
                    const sketchInstance = event.instance as SketchInstance;
                    createSketchThumbnail(
                        sketchInstance,
                        null, // currentStroke
                        '#000000', // default sketch color
                        2, // default sketch width
                        (ctx, text, maxWidth, maxHeight) => { // wrapTextForThumbnail function
                            const words = text.split(' ');
                            const lines: string[] = [];
                            let currentLine = '';
                            
                            for (const word of words) {
                                const testLine = currentLine + (currentLine ? ' ' : '') + word;
                                const metrics = ctx.measureText(testLine);
                                if (metrics.width > maxWidth && currentLine) {
                                    lines.push(currentLine);
                                    currentLine = word;
                                } else {
                                    currentLine = testLine;
                                }
                            }
                            if (currentLine) lines.push(currentLine);
                            return lines.slice(0, Math.floor(maxHeight / 15)); // Approximate line height
                        },
                        400, // default canvas width
                        300  // default canvas height
                    ).then(thumbnail => {
                        (event.instance as SketchInstance).thumbnail = thumbnail;
                    }).catch(err => {
                        console.error('Failed to generate sketch thumbnail:', err);
                    });
                }
            }
            
            if (event.action === "add") {
                if (!event.instance || !event.instance.id) {
                    console.error("Instance is missing id in add action");
                    return;
                }
                instancesClone.push(event.instance);
            } else if (event.action === "remove") {
                if (!event.targetId) {
                    console.error("Target ID is missing in remove action");
                    return;
                }
                let index = instancesClone.findIndex(item => item.id === event.targetId);
                if (index === -1) {
                    console.error(`Failed to delete ${event.targetId}: Not found`);
                } else {
                    instancesClone.splice(index, 1);
                }
            } else if (event.action === "update") {
                if (!event.instance) {
                    console.error("Target instance is missing in update action");
                    return;
                }
                let targetId = event.targetId || event.instance.id;
                let index = instancesClone.findIndex(item => item.id === targetId);
                if (index === -1) {
                    console.error(`Failed to update ${targetId}: Not found`);
                } else {
                    console.log("Old:", instancesClone[index]);
                    console.log("New:", event.instance);
                    let newInstance = { ...instancesClone[index], ...event.instance };
                    console.log("Result", newInstance);
                    instancesClone.splice(index, 1, newInstance);
                }
            } else {
                console.error(`Unknown action: ${event.action}`);
            }
        });
    }
    console.log("Updated instances:", instancesClone);
    setInstances(instancesClone);
    
    // Notify about table modifications
    if (onTableModified && modifiedTableIds.size > 0) {
        modifiedTableIds.forEach(tableId => {
            console.log(`[updateInstances] Notifying table modification: ${tableId}`);
            onTableModified(tableId);
        });
    }
}

/**
 * Compares two instances for content equality, ignoring source differences
 * This is used for suggestion logic to avoid treating instances as different
 * when only their source metadata differs (e.g., different locators)
 */
export function areInstancesContentEqual(instance1: Instance | EmbeddedInstance | null, instance2: Instance | EmbeddedInstance | null): boolean {
  if (!instance1 && !instance2) return true;
  if (!instance1 || !instance2) return false;
  if (instance1.type !== instance2.type) return false;
  
  switch (instance1.type) {
    case 'text':
      return (instance1 as any).content === (instance2 as any).content;
    case 'image':
      return (instance1 as any).src === (instance2 as any).src;
    case 'sketch':
      // For sketches, compare content-related properties, not source
      return (instance1 as any).data === (instance2 as any).data || 
             (instance1 as any).thumbnail === (instance2 as any).thumbnail;
    case 'table':
      // For tables, compare structure and cell content
      const table1 = instance1 as any;
      const table2 = instance2 as any;
      if (table1.rows !== table2.rows || table1.cols !== table2.cols) return false;
      
      // Compare each cell content
      for (let r = 0; r < table1.rows; r++) {
        for (let c = 0; c < table1.cols; c++) {
          const cell1 = table1.cells?.[r]?.[c];
          const cell2 = table2.cells?.[r]?.[c];
          if (!areInstancesContentEqual(cell1, cell2)) return false;
        }
      }
      return true;
    case 'visualization':
      // For visualizations, compare data and config
      return (instance1 as any).data === (instance2 as any).data && 
             (instance1 as any).config === (instance2 as any).config;
    default:
      return true; // Assume equal for unknown types
  }
}

// Formula evaluation utilities for table thumbnails
// Safe mathematical expression evaluator without using Function() or eval()
const evaluateMathExpressionInUtils = (expr: string): number => {
  // Remove all whitespace
  expr = expr.replace(/\s/g, '');
  
  if (expr === '') return 0;
  
  // Handle parentheses first (recursive evaluation)
  while (expr.includes('(')) {
    const lastOpen = expr.lastIndexOf('(');
    const firstClose = expr.indexOf(')', lastOpen);
    if (firstClose === -1) throw new Error('Mismatched parentheses');
    
    const innerExpr = expr.substring(lastOpen + 1, firstClose);
    const innerResult = evaluateMathExpressionInUtils(innerExpr);
    expr = expr.substring(0, lastOpen) + innerResult.toString() + expr.substring(firstClose + 1);
  }
  
  // Handle multiplication and division (left to right)
  let tokens = expr.split(/([+\-*/])/).filter(token => token !== '');
  
  for (let i = 1; i < tokens.length; i += 2) {
    if (tokens[i] === '*' || tokens[i] === '/') {
      const left = parseFloat(tokens[i - 1]);
      const right = parseFloat(tokens[i + 1]);
      if (isNaN(left) || isNaN(right)) throw new Error('Invalid number');
      
      const result = tokens[i] === '*' ? left * right : left / right;
      tokens.splice(i - 1, 3, result.toString());
      i -= 2; // Adjust index after splice
    }
  }
  
  // Handle addition and subtraction (left to right)
  let result = parseFloat(tokens[0]);
  if (isNaN(result)) throw new Error('Invalid number');
  
  for (let i = 1; i < tokens.length; i += 2) {
    const operator = tokens[i];
    const operand = parseFloat(tokens[i + 1]);
    if (isNaN(operand)) throw new Error('Invalid number');
    
    if (operator === '+') {
      result += operand;
    } else if (operator === '-') {
      result -= operand;
    }
  }
  
  return result;
};

/**
 * Extracts numerical value from text content, handling common formatting like currency
 * This is the same logic used in the UI for column type conversion
 */
export const extractNumericalValue = (content: string): number => {
    // Remove all non-numeric characters except decimal points and minus signs
    let cleaned = content.replace(/[^0-9.-]/g, '');
    
    // Handle multiple decimal points - keep only the first one
    const firstDecimalIndex = cleaned.indexOf('.');
    if (firstDecimalIndex !== -1) {
        const beforeDecimal = cleaned.substring(0, firstDecimalIndex + 1);
        const afterDecimal = cleaned.substring(firstDecimalIndex + 1).replace(/\./g, '');
        cleaned = beforeDecimal + afterDecimal;
    }
    
    // Handle multiple minus signs - keep only the first one if it's at the beginning
    if (cleaned.includes('-')) {
        const isNegative = cleaned.startsWith('-');
        cleaned = cleaned.replace(/-/g, '');
        if (isNegative) {
            cleaned = '-' + cleaned;
        }
    }
    
    // Parse the cleaned string as a number
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
};

export const evaluateFormulaInTable = (formula: string, table: any): string => {
  try {
    // Remove leading = sign
    const expr = formula.startsWith('=') ? formula.slice(1) : formula;
    
    // Helper function to parse column references
    const parseColumnReference = (ref: string): { col: number, row?: number } | null => {
      const cellMatch = ref.match(/^([A-Z]+)(\d+)$/);
      if (cellMatch) {
        const colLetters = cellMatch[1];
        const rowNum = parseInt(cellMatch[2]) - 1; // Convert to 0-based
        let col = 0;
        for (let i = 0; i < colLetters.length; i++) {
          col = col * 26 + (colLetters.charCodeAt(i) - 65 + 1);
        }
        col -= 1; // Convert to 0-based
        return { col, row: rowNum };
      }
      
      // Column range like A:A
      const colMatch = ref.match(/^([A-Z]+):([A-Z]+)$/);
      if (colMatch && colMatch[1] === colMatch[2]) {
        const colLetters = colMatch[1];
        let col = 0;
        for (let i = 0; i < colLetters.length; i++) {
          col = col * 26 + (colLetters.charCodeAt(i) - 65 + 1);
        }
        col -= 1; // Convert to 0-based
        return { col };
      }
      
      return null;
    };

    // Parse cell ranges like A1:A2
    const parseCellRange = (range: string): { startCol: number, endCol: number, startRow: number, endRow: number } | null => {
      const rangeMatch = range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
      if (!rangeMatch) return null;
      
      const startColLetters = rangeMatch[1];
      const startRowNum = parseInt(rangeMatch[2]) - 1;
      const endColLetters = rangeMatch[3];
      const endRowNum = parseInt(rangeMatch[4]) - 1;
      
      let startCol = 0;
      for (let i = 0; i < startColLetters.length; i++) {
        startCol = startCol * 26 + (startColLetters.charCodeAt(i) - 65 + 1);
      }
      startCol -= 1;
      
      let endCol = 0;
      for (let i = 0; i < endColLetters.length; i++) {
        endCol = endCol * 26 + (endColLetters.charCodeAt(i) - 65 + 1);
      }
      endCol -= 1;
      
      return { startCol, endCol, startRow: startRowNum, endRow: endRowNum };
    };

    // Get raw cell value (skip formulas to avoid recursion)
    const getRawCellValue = (row: number, col: number): number => {
      const cell = table.cells[row]?.[col];
      if (!cell || cell.type !== 'text') return 0;
      const content = cell.content.trim();
      
      // Skip formulas to avoid infinite recursion
      if (content.startsWith('=')) return 0;
      
      const value = parseFloat(content);
      return isNaN(value) ? 0 : value;
    };
    
    // Handle SUM function
    const sumMatch = expr.match(/SUM\(([^)]+)\)/i);
    if (sumMatch) {
      const range = sumMatch[1];
      
      // Try parsing as cell range first (A1:A2)
      const cellRange = parseCellRange(range);
      if (cellRange) {
        let sum = 0;
        for (let row = cellRange.startRow; row <= cellRange.endRow; row++) {
          for (let col = cellRange.startCol; col <= cellRange.endCol; col++) {
            sum += getRawCellValue(row, col);
          }
        }
        return sum.toString();
      }
      
      // Fall back to column reference
      const ref = parseColumnReference(range);
      if (ref && ref.row === undefined) {
        // Column sum
        let sum = 0;
        for (let r = 0; r < table.rows; r++) {
          sum += getRawCellValue(r, ref.col);
        }
        return sum.toString();
      } else if (ref && ref.row !== undefined) {
        // Single cell
        return getRawCellValue(ref.row, ref.col).toString();
      }
      return '0';
    }

    // Handle AVG function
    const avgMatch = expr.match(/AVG\(([^)]+)\)/i);
    if (avgMatch) {
      const range = avgMatch[1];
      
      // Try parsing as cell range first (A1:A2)
      const cellRange = parseCellRange(range);
      if (cellRange) {
        let sum = 0;
        let count = 0;
        for (let row = cellRange.startRow; row <= cellRange.endRow; row++) {
          for (let col = cellRange.startCol; col <= cellRange.endCol; col++) {
            const cell = table.cells[row]?.[col];
            // Only count cells that actually have content (non-empty text cells)
            if (cell?.type === 'text') {
              const content = cell.content.trim();
              // Skip formulas to avoid circular dependencies and only count non-empty content
              if (!content.startsWith('=') && content !== '') {
                const value = parseFloat(content);
                const numValue = isNaN(value) ? 0 : value;
                sum += numValue;
                count++;
              }
            }
          }
        }
        return count > 0 ? (sum / count).toString() : '0';
      }
      
      // Fall back to column reference (A:A or single cell A1)
      const ref = parseColumnReference(range);
      if (ref && ref.row === undefined) {
        // Column average
        let sum = 0;
        let count = 0;
        for (let r = 0; r < table.rows; r++) {
          const cell = table.cells[r]?.[ref.col];
          // Only count cells that actually have content (non-empty text cells)
          if (cell?.type === 'text') {
            const content = cell.content.trim();
            // Skip formulas to avoid circular dependencies and only count non-empty content
            if (!content.startsWith('=') && content !== '') {
              const value = parseFloat(content);
              const numValue = isNaN(value) ? 0 : value;
              sum += numValue;
              count++;
            }
          }
        }
        return count > 0 ? (sum / count).toString() : '0';
      } else if (ref && ref.row !== undefined) {
        // Single cell
        return getRawCellValue(ref.row, ref.col).toString();
      }
      return '0';
    }

    // Handle basic mathematical expressions with cell references
    let processedExpr = expr;
    
    // Replace cell references with their values
    const cellRefs = expr.match(/[A-Z]+\d+/g) || [];
    for (const ref of cellRefs) {
      const parsed = parseColumnReference(ref);
      if (parsed && parsed.row !== undefined) {
        const value = getRawCellValue(parsed.row, parsed.col);
        // Use a more specific replacement to avoid partial matches
        processedExpr = processedExpr.replace(new RegExp('\\b' + ref + '\\b', 'g'), value.toString());
      }
    }

    // Evaluate the mathematical expression safely without using Function() or eval()
    // Only allow numbers, operators, and parentheses
    if (/^[0-9+\-*/().\s]+$/.test(processedExpr)) {
      try {
        const result = evaluateMathExpressionInUtils(processedExpr.trim());
        return isNaN(result) || !isFinite(result) ? '#ERROR' : result.toString();
      } catch (error) {
        return '#ERROR';
      }
    }
    
    return '#ERROR';
  } catch (error) {
    return '#ERROR';
  }
};

export default { getInstanceGeometry, extractJSONFromResponse, indexToLetters, normalizeTableInstance, cleanHTML, cleanHTMLScript, generateInstanceContext, generateId, parseInstance, mapToObject, updateInstances, areInstancesContentEqual, evaluateFormulaInTable };