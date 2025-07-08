// import htmlclean from 'htmlclean';
import { Instance, EmbeddedInstance, TextInstance, EmbeddedImageInstance, EmbeddedSketchInstance, EmbeddedTableInstance, EmbeddedTextInstance, ImageInstance, SketchInstance, TableInstance, SketchItem } from './types';

export const generateId = () => '_' + Math.random().toString(36).substring(2, 9);

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
    const doc = parser.parseFromString(htmlString, 'text/html');

    // Remove head element
    if (doc.head) doc.head.remove();

    // Remove unwanted tags
    const tagsToRemove = ['script', 'svg', 'noscript', 'style', 'header', 'nav', 'input'];
    tagsToRemove.forEach(tag => {
        const elements = doc.querySelectorAll(tag);
        elements.forEach(el => el.remove());
    });

    // Remove all attributes except src
    const allElements = doc.querySelectorAll('*');
    allElements.forEach(el => {
        const attributes = Array.from(el.attributes);
        attributes.forEach(attr => {
            if (attr.name !== 'src') {
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

export const generateInstanceContext = (instances: Instance[]): any => {
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

    const instanceToJSON = (instance: Instance): string => {
        if (instance.type === 'text') {
            return JSON.stringify({
                "type": "text",
                "text": instance.content
            });
        } else if (instance.type === 'image') {
            const imageIndex = getImageIndex(instance.id, instance.src);
            return JSON.stringify({
                "type": "image",
                "src": "(See the " + (imageIndex == 1 ? 'first' : imageIndex == 2 ? 'second' : imageIndex == 3 ? 'third' : String(imageIndex) + 'th') + " image.)"
            });
        } else if (instance.type === 'sketch') {
            if (!instance.thumbnail) {
                throw new Error("Sketch thumbnail is required");
            }
            const imageIndex = getImageIndex(instance.id, instance.thumbnail);
            return JSON.stringify({
                "type": "sketch",
                "thumbnail": "(See the " + (imageIndex == 1 ? 'first' : imageIndex == 2 ? 'second' : imageIndex == 3 ? 'third' : String(imageIndex) + 'th') + " sketch for the sketch thumbnail.)",
                "content": instance.content.filter(item => item.type == "instance").map(item => {
                    if (item.instance.type === 'image') {
                        return {
                            "type": "image",
                            "src": `(See ${item.instance.originalId} image.)`,
                            "originalId": item.instance.originalId
                        };
                    } else if (item.instance.type === 'text') {
                        return {
                            "type": "text",
                            "text": item.instance.content
                        };
                    } else if (item.instance.type === 'table') {
                        return {
                            "type": "table",
                            "tables": "(The object is omitted for brevity.)",
                            "originalId": item.instance.originalId
                        };
                    }
                })
            });
        } else if (instance.type === 'table') {
            return JSON.stringify({
                "type": "table",
                "table": {
                    "rows": instance.rows,
                    "cols": instance.cols,
                    "cells": instance.cells.flatMap((rowArr, r) => rowArr.map((cell, c) => cell ? (cell.type === 'image' ? {
                        type: 'image',
                        src: `(See ${cell.originalId} image.)`,
                        originalId: cell.originalId
                    } : cell.type === 'text' ? {
                        type: 'text',
                        text: cell.content
                    } : null
                    ) : null)).filter(cell => cell !== null)
                }
            });
        }
        return '';
    }


    instances.forEach(instance => {
        textContext += `Instance ID: ${instance.id}\nType: ${instance.type}\nContent: ${instanceToJSON(instance)}\n\n`;
    })

    return { imageContext, textContext };
}

export function parseInstance(input: any): Instance | EmbeddedInstance {
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
            return parseSketchInstance(input);
        case 'table':
            return parseTableInstance(input);
        default:
            throw new Error(`Unknown type: ${type}`);
    }
}

// Helper functions for each type
function parseTextInstance(input: any): TextInstance | EmbeddedTextInstance {
    const id = input.id || generateId();
    const content = input.content || input.text || '';

    if (hasGeometricProperties(input)) {
        return {
            type: 'text',
            id,
            content,
            x: input.x,
            y: input.y,
            width: input.width,
            height: input.height,
            sourcePageId: input.sourcePageId,
        };
    }

    return {
        type: 'text',
        id,
        content,
        originalId: input.originalId,
    };
}

function parseImageInstance(input: any): ImageInstance | EmbeddedImageInstance {
    const id = input.id || generateId();

    if (hasGeometricProperties(input)) {
        return {
            type: 'image',
            id,
            src: input.src,
            x: input.x,
            y: input.y,
            width: input.width,
            height: input.height,
            sourcePageId: input.sourcePageId,
        };
    }

    return {
        type: 'image',
        id,
        src: input.src,
        originalId: input.originalId,
    };
}

function parseSketchInstance(input: any): SketchInstance | EmbeddedSketchInstance {
    const id = input.id || generateId();

    if (hasGeometricProperties(input)) {
        return {
            type: 'sketch',
            id,
            x: input.x,
            y: input.y,
            width: input.width,
            height: input.height,
            content: parseSketchContent(input.content || []),
            thumbnail: input.thumbnail || '',
            sourcePageId: input.sourcePageId,
        };
    }

    return {
        type: 'sketch',
        id,
        originalId: input.originalId,
    };
}

function parseTableInstance(input: any): TableInstance | EmbeddedTableInstance {
    const id = input.id || generateId();
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
        cells = tableData.cells.map((row: any[]) => row.map(cell => cell ? parseInstance(cell) : null));
    } else if (Array.isArray(tableData.cells)) {
        // Flat array with row/col
        const maxRow = Math.max(0, ...tableData.cells.map((cell: any) => cell.row || 0));
        const maxCol = Math.max(0, ...tableData.cells.map((cell: any) => cell.col || 0));
        cells = Array.from({ length: maxRow + 1 }, () => Array(maxCol + 1).fill(null));
        tableData.cells.forEach((cell: any) => {
            if (typeof cell.row === 'number' && typeof cell.col === 'number') {
                cells[cell.row][cell.col] = cell.content ? parseInstance(cell.content) : null;
            }
        });
    }

    const table: any = {
        type: 'table',
        id,
        rows: tableData.rows || (cells.length),
        cols: tableData.cols || (cells[0]?.length || 0),
        cells,
        x: input.x || 0,
        y: input.y || 0,
        width: input.width || 400,
        height: input.height || 300,
        sourcePageId: input.sourcePageId,
    };

    if (input.originalId) {
        table.originalId = input.originalId;
    }

    return table;
}

// Helper for sketch content
function parseSketchContent(items: any[]): SketchItem[] {
    return items.map(item => {
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
                    instance: parseInstance(item.instance),
                    x: item.x || 0,
                    y: item.y || 0,
                    width: item.width || 0,
                    height: item.height || 0,
                };
            default:
                throw new Error(`Unknown sketch item type: ${item.type}`);
        }
    });
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
    const typeCounters: Record<string, number> = {};
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

export default { getInstanceGeometry, extractJSONFromResponse, indexToLetters, cleanHTML, generateInstanceContext, generateId, parseInstance };