import React from 'react';
import { useEffect, useState, useRef } from 'react';
import './visualizationrenderer.css';

const ErrorDisplay = ({ message }: { message: string }) => (
  <div style={{
    padding: '1rem',
    color: '#a94442',
    backgroundColor: '#f2dede',
    border: '1px solid #ebccd1',
    borderRadius: '4px',
    fontSize: '0.9em',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  }}>
    <strong>Rendering Error:</strong>
    <p style={{ margin: '0.5em 0 0', fontFamily: 'monospace' }}>{message}</p>
  </div>
);

interface InteractionConfig {
  hover?: {
    enabled: boolean;
    tooltipFields?: string[];
  };
  zoom?: {
    enabled: boolean;
  };
}

interface VisualizationRendererProps {
  spec: object;
  onImageUrlReady?: (url: string) => void;
  zoomEnabled?: boolean;
  chartType?: string;
}

interface BackendResponse {
  svg: string;
  meta?: any;
  dataValues?: any[]; // array of data rows corresponding to marks order
  spec?: object; // echoed spec
}

// Function to process SVG and make it responsive
const processSvgForResponsiveness = (svgText: string): string => {
  // Parse the SVG string to modify attributes
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  
  if (svg) {
    const width = svg.getAttribute('width') || '400';
    const height = svg.getAttribute('height') || '300';
    if (!svg.getAttribute('viewBox')) svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    (svg as any).style.maxWidth = '100%';
    (svg as any).style.maxHeight = '100%';

    // Sanitize anchors
    const anchors = doc.querySelectorAll('a');
    anchors.forEach(anchor => {
      anchor.removeAttribute('href');
      anchor.setAttribute('onclick', 'event.preventDefault(); return false;');
    });
  }
  const serializer = new XMLSerializer();
  return serializer.serializeToString(doc);
};

const VisualizationRenderer: React.FC<VisualizationRendererProps> = ({
  spec,
  onImageUrlReady,
  zoomEnabled = false,
  chartType = 'unknown',
}) => {
  console.log('VisualizationRenderer: Component mounted/re-rendered');
  
  const [svgContent, setSvgContent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dataValuesRef = useRef<any[] | undefined>(undefined);
  const marksRef = useRef<SVGElement[]>([]);
  const cleanupRef = useRef<(() => void) | null>(null);
  const metaRef = useRef<any>(null);
  const [zoomTransform, setZoomTransform] = useState({ x: 0, y: 0, scale: 1 });

  // Fetch updated backend JSON response
  useEffect(() => {
    let cancelled = false;
    setError(null);
    setSvgContent('');

    (async () => {
      try {
        const res = await fetch(`http://${import.meta.env.VITE_BACKEND_URL}/api/render-interactive-svg/`, {
          method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(spec),
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`Backend error: ${res.status} ${txt}`);
        }
        // Expect JSON unless ?raw=1 is used (not here)
        const json: BackendResponse = await res.json();
        if (cancelled) return;
        dataValuesRef.current = json.dataValues;
        metaRef.current = json.meta;
        const processed = processSvgForResponsiveness(json.svg);
        setSvgContent(processed);
        if (onImageUrlReady) {
          // Use a data URI instead of a Blob URL so the thumbnail persists across sessions
          const b64 = btoa(unescape(encodeURIComponent(processed)));
          onImageUrlReady(`data:image/svg+xml;base64,${b64}`);
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message || String(e));
      }
    })();

    return () => { cancelled = true; };
  }, [spec, onImageUrlReady]);

  // Attach interactivity once SVG content is in DOM
  useEffect(() => {
    console.log('VisualizationRenderer: useEffect triggered with svgContent:', !!svgContent);
    
    // Cleanup previous listeners / artifacts
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    if (!svgContent || !containerRef.current) {
      console.log('VisualizationRenderer: Early return - svgContent:', !!svgContent, 'containerRef:', !!containerRef.current);
      return;
    }

    const container = containerRef.current;
    const svgEl = container.querySelector('svg') as SVGSVGElement | null;
    if (!svgEl) {
      console.log('VisualizationRenderer: No SVG element found in container');
      return; // ensure non-null below
    }
    console.log('VisualizationRenderer: SVG element found, proceeding with interactivity setup');

    // Remove native <title> elements to avoid overlapping default browser tooltips
    svgEl.querySelectorAll('title').forEach(t => t.remove());

    // Query marks
    console.log('=== SVG STRUCTURE DEBUG ===');
    console.log('SVG element:', svgEl);
    console.log('SVG innerHTML preview:', svgEl.innerHTML.slice(0, 500) + '...');
    
    let marks: SVGElement[] = Array.from(svgEl.querySelectorAll('.interactive-mark')) as SVGElement[];
    console.log('Step 1: Found', marks.length, 'elements with .interactive-mark class');
    
    // Fallback: if backend didn't add .interactive-mark, treat visible geometric primitives with aria-label as marks
    if (marks.length === 0) {
      const primitiveSelector = 'circle,path,rect,polygon,polyline,ellipse';
      const primitives = Array.from(svgEl.querySelectorAll(primitiveSelector));
      console.log('Step 2: Found', primitives.length, 'primitive shapes');
      
      marks = primitives.filter(el => el.getAttribute('aria-label')) as SVGElement[];
      console.log('Step 2b: Filtered to', marks.length, 'shapes with aria-label');
      
      marks.forEach((el,i) => { 
        if (!el.getAttribute('data-idx')) el.setAttribute('data-idx', String(i)); 
        el.classList.add('interactive-mark');
        console.log('Step 2c: Set up mark', i, 'element:', el.tagName, 'aria-label:', el.getAttribute('aria-label'));
      });
    }
    
    // Additional fallback: if still no marks, try to find all visible shapes
    if (marks.length === 0) {
      console.warn('No marks found with aria-label, trying to find all shapes');
      // For scatterplots, prioritize finding circles
      const allCircles = Array.from(svgEl.querySelectorAll('circle')) as SVGElement[];
      console.log('Step 3-CIRCLE: Found', allCircles.length, 'circles total');
      
      if (allCircles.length > 0) {
        marks = allCircles;
        console.log('Step 3-CIRCLE: Using', marks.length, 'circles as marks');
      } else {
        // Fallback to all shapes
        const primitiveSelector = 'circle,path,rect,polygon,polyline,ellipse,line';
        const allShapes = Array.from(svgEl.querySelectorAll(primitiveSelector)) as SVGElement[];
        console.log('Step 3: Found', allShapes.length, 'total shapes');
        
        marks = allShapes.filter(el => {
          const hasValidFill = el.getAttribute('fill') !== 'none';
          const hasValidStroke = el.getAttribute('stroke') !== 'none';
          console.log('Shape filter:', el.tagName, 'fill:', el.getAttribute('fill'), 'stroke:', el.getAttribute('stroke'), 'valid:', hasValidFill || hasValidStroke);
          return hasValidFill || hasValidStroke;
        });
      }
      console.log('Step 3b: Filtered to', marks.length, 'visible shapes');
      
      marks.forEach((el,i) => { 
        if (!el.getAttribute('data-idx')) el.setAttribute('data-idx', String(i)); 
        if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', `Mark ${i}`);
        el.classList.add('interactive-mark');
        
        // Extra debugging for circles (scatterplot points)
        if (el.tagName.toLowerCase() === 'circle') {
          console.log('Step 3c: Set up CIRCLE', i, 'as mark:', {
            cx: el.getAttribute('cx'),
            cy: el.getAttribute('cy'), 
            r: el.getAttribute('r'),
            fill: el.getAttribute('fill'),
            stroke: el.getAttribute('stroke'),
            transform: el.getAttribute('transform'),
            parent: el.parentElement?.tagName,
            parentTransform: el.parentElement?.getAttribute('transform')
          });
        } else {
          console.log('Step 3c: Set up shape', i, 'as mark:', el.tagName, 'fill:', el.getAttribute('fill'), 'stroke:', el.getAttribute('stroke'));
        }
      });
    }
    
    console.log('=== FINAL RESULT: Found', marks.length, 'interactive marks ===');
    marksRef.current = marks;

    // Remove any <title> descendants and title attributes on marks to suppress native tooltips
    marks.forEach(m => {
      if (m.hasAttribute('title')) m.removeAttribute('title');
      m.querySelectorAll('title').forEach(t => t.remove());
    });

    // Ensure each mark has data-idx and tabindex for accessibility
    marks.forEach((el, i) => {
      if (!el.getAttribute('data-idx')) el.setAttribute('data-idx', String(i));
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
    });

    // Tooltip
    const tip = document.createElement('div');
    tip.style.cssText = 'position:absolute;padding:8px 10px;font:12px/1.4 sans-serif;background:#222;color:#fff;border-radius:4px;pointer-events:none;opacity:0;transition:opacity .12s;z-index:9999;max-width:320px;white-space:pre-line;word-break:break-word;overflow-wrap:anywhere;box-shadow:0 2px 6px rgba(0,0,0,0.4);';
    document.body.appendChild(tip);

    function checkIfMarkHasSource(element: Element): boolean {
      const dataIdx = element.getAttribute('data-idx');
      if (!dataIdx || !dataValuesRef.current) return false;
      
      const dataIndex = parseInt(dataIdx);
      const dataRow = dataValuesRef.current[dataIndex];
      
      if (!dataRow) return false;
      
      // Check for source information in various possible formats
      if (dataRow.__webseek_pageId && dataRow.__webseek_locator) return true;
      if (dataRow.pageId && dataRow.locator) return true;
      if (dataRow._pageId && dataRow._locator) return true; // Added underscore-prefixed format
      if (dataRow.source && dataRow.source.pageId && dataRow.source.locator) return true;
      
      return false;
    }

    function showTip(e: MouseEvent | FocusEvent, text: string) {
      // Format tooltip text to separate fields on different lines
      // Vega-Lite may use different separators, so we'll handle common patterns
      let formattedText = text;
      
      // Check if text contains field-value pairs separated by semicolons
      if (text.includes(';') && text.includes(':')) {
        formattedText = text
          .split(';')
          .map(part => part.trim())
          .filter(part => part.length > 0)
          .join('\n');
      }
      // Check if text contains field-value pairs separated by commas
      else if (text.includes(',') && text.includes(':')) {
        formattedText = text
          .split(',')
          .map(part => part.trim())
          .filter(part => part.length > 0)
          .join('\n');
      }
      // If no clear separators found, try to split on common patterns
      else if (text.includes(':')) {
        // Look for patterns like "field1: value1 field2: value2"
        formattedText = text
          .replace(/([a-zA-Z_]\w*:\s*[^:]*?)(?=\s+[a-zA-Z_]\w*:|\s*$)/g, '$1\n')
          .trim();
      }
      
      // Add interaction hint to tooltip based on source availability
      const hasSource = checkIfMarkHasSource(e.target as Element);
      if (hasSource) {
        formattedText += '\n\n💡 Right-click to view source';
      } else {
        formattedText += '\n\n📊 Data visualization (no source navigation available)';
      }
      
      tip.textContent = formattedText;
      // First place off-screen to measure
      tip.style.left = '-9999px';
      tip.style.top = '-9999px';
      tip.style.opacity = '1';
      const svgRect = svgEl!.getBoundingClientRect();
      let clientX: number; let clientY: number;
      if (e instanceof MouseEvent) {
        clientX = e.clientX; clientY = e.clientY;
      } else if (e.target instanceof Element) {
        const br = (e.target as Element).getBoundingClientRect();
        clientX = br.left + br.width / 2; clientY = br.top;
      } else {
        clientX = svgRect.left; clientY = svgRect.top;
      }
      const padding = 12;
      let left = clientX + padding;
      let top = clientY + padding;
      // Constrain within viewport
      const vw = window.innerWidth; const vh = window.innerHeight;
      // Force layout to get size
      const w = tip.offsetWidth; const h = tip.offsetHeight;
      if (left + w + 4 > vw) left = Math.max(4, vw - w - 4);
      if (top + h + 4 > vh) top = Math.max(4, vh - h - 4);
      // Also constrain within svg bounds if svg is narrower
      if (left < svgRect.left) left = svgRect.left + 4;
      if (left + w > svgRect.right) left = svgRect.right - w - 4;
      if (top < svgRect.top) top = svgRect.top + 4;
      if (top + h > svgRect.bottom) top = svgRect.bottom - h - 4;
      tip.style.left = left + 'px';
      tip.style.top = top + 'px';
    }
    function hideTip() { tip.style.opacity = '0'; }

    marks.forEach(m => {
      const enter = (e: any) => showTip(e, m.getAttribute('aria-label') || '');
      m.addEventListener('mousemove', enter);
      m.addEventListener('mouseleave', hideTip);
      m.addEventListener('focus', enter);
      m.addEventListener('blur', hideTip);
      
      const handleMarkMouseDown = (e: MouseEvent) => {
        e.stopPropagation();
      };
      m.addEventListener('mousedown', handleMarkMouseDown);

      // Add right-click functionality to navigate to source
      m.addEventListener('contextmenu', async (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        const dataIdx = m.getAttribute('data-idx');
        if (!dataIdx || !dataValuesRef.current) return;
        
        const dataIndex = parseInt(dataIdx);
        const dataRow = dataValuesRef.current[dataIndex];
        
        if (!dataRow) {
          console.warn('No data found for mark index:', dataIndex);
          return;
        }
        
        // Look for source information in the data row
        // The source info might be in different fields depending on the data structure
        let pageId = null;
        let locator = null;
        
        // Check various possible field names for source information
        if (dataRow.__webseek_pageId && dataRow.__webseek_locator) {
          pageId = dataRow.__webseek_pageId;
          locator = dataRow.__webseek_locator;
        } else if (dataRow.pageId && dataRow.locator) {
          pageId = dataRow.pageId;
          locator = dataRow.locator;
        } else if (dataRow._pageId && dataRow._locator) {
          pageId = dataRow._pageId;
          locator = dataRow._locator;
        } else if (dataRow.source) {
          const source = dataRow.source;
          if (source.pageId && source.locator) {
            pageId = source.pageId;
            locator = source.locator;
          }
        }
        
        if (pageId && locator) {
          try {
            console.log('Opening source for data:', { pageId, locator, dataRow });
            const locatorString = encodeURIComponent(locator);
            const baseUrl = chrome.runtime.getURL('viewer.html');
            const viewerUrl = `${baseUrl}?snapshotId=${pageId}&locator=${locatorString}`;
            await chrome.tabs.create({ url: viewerUrl });
          } catch (error) {
            console.error('Error opening snapshot viewer:', error);
            // Could add fallback logic here if needed
          }
        } else {
          console.log('No source information found in data row:', dataRow);
          console.log('Available fields in data row:', Object.keys(dataRow));
          
          // Show user-friendly message
          const message = 'This data does not have source information for navigation. Right-click navigation only works with data captured from web pages.';
          
          // Create a temporary notification
          const notification = document.createElement('div');
          notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 6px;
            padding: 12px 16px;
            font-size: 14px;
            color: #495057;
            max-width: 300px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            z-index: 10000;
            line-height: 1.4;
          `;
          notification.textContent = message;
          document.body.appendChild(notification);
          
          // Remove the notification after 4 seconds
          setTimeout(() => {
            if (notification.parentNode) {
              notification.parentNode.removeChild(notification);
            }
          }, 4000);
        }
      });
    });

    // Selection functionality removed

    // Selection functionality removed

    svgEl.dispatchEvent(new CustomEvent('webseek:dataMapping', { detail: { dataValues: dataValuesRef.current } }));

    if (!document.getElementById('__webseek_interaction_styles')) {
      const style = document.createElement('style');
      style.id = '__webseek_interaction_styles';
      style.textContent = `
        .interactive-mark { 
          cursor: pointer; 
          pointer-events: all; 
          transition: filter .15s, opacity .15s, transform .1s; 
        }
        .interactive-mark:hover {
          filter: brightness(1.1) drop-shadow(0 0 3px rgba(0,0,0,0.3));
        }
        .interactive-mark:active {
          transform: scale(0.98);
        }
        /* Specific styles for circles */
        svg circle.selected,
        .interactive-mark.selected circle {
          fill: rgba(255,107,53,0.7) !important;
          stroke: #FF6B35 !important;
          stroke-width: 3px !important;
          filter: drop-shadow(0 0 8px rgba(255,107,53,0.9)) drop-shadow(0 0 16px rgba(255,107,53,0.5)) !important;
        }
        /* Visual hint for double-clickable marks */
        .interactive-mark:after {
          content: '';
          position: absolute;
          top: -2px;
          right: -2px;
          width: 8px;
          height: 8px;
          background: rgba(0,123,255,0.6);
          border-radius: 50%;
          opacity: 0;
          transition: opacity 0.2s;
          pointer-events: none;
        }
        .interactive-mark:hover:after {
          opacity: 1;
        }
      `;
      document.head.appendChild(style);
    }

    // Add zoom functionality for point charts (scatterplots)
    let zoomCleanup: (() => void) | null = null;
    if (zoomEnabled) { // Broadened from just 'point' charts
      // Find the main group to transform. A group with a clip-path is a good heuristic for the main plot area.
      const plotArea = svgEl.querySelector('g[clip-path]') || svgEl.querySelector('g:first-of-type');
      if (plotArea) {
        let isPanning = false;
        let transform = { x: 0, y: 0, scale: 1 };
        let panStart = { x: 0, y: 0 };

        const updateTransform = () => {
          (plotArea as SVGElement).style.transform = `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`;
          (plotArea as SVGElement).style.transformOrigin = '0 0';
        };

        const onWheel = (e: WheelEvent) => {
          e.preventDefault();
          const rect = svgEl.getBoundingClientRect();
          const mouse = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
          };
          
          const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
          const newScale = Math.max(0.25, Math.min(10, transform.scale * scaleFactor));
          const scaleRatio = newScale / transform.scale;

          // Zoom towards the mouse position
          transform.x = mouse.x - scaleRatio * (mouse.x - transform.x);
          transform.y = mouse.y - scaleRatio * (mouse.y - transform.y);
          transform.scale = newScale;
          
          updateTransform();
        };

        const onMouseDown = (e: MouseEvent) => {
          // IMPORTANT: Only start panning if the click is on the SVG background, NOT an interactive mark.
          if ((e.target as Element).closest('.interactive-mark') || e.button !== 0) {
            return;
          }
          isPanning = true;
          panStart.x = e.clientX - transform.x;
          panStart.y = e.clientY - transform.y;
          svgEl.style.cursor = 'grabbing';
        };

        const onMouseMove = (e: MouseEvent) => {
          if (!isPanning) return;
          // This is the correct way to calculate pan movement.
          // It's based on the difference from where the drag started.
          transform.x = e.clientX - panStart.x;
          transform.y = e.clientY - panStart.y;
          updateTransform();
        };

        const onMouseUp = () => {
          isPanning = false;
          svgEl.style.cursor = 'grab';
        };

        const onDoubleClick = (e: MouseEvent) => {
           // IMPORTANT: Do not reset zoom if double-clicking a mark.
           if ((e.target as Element).closest('.interactive-mark')) {
            return;
          }
          transform = { x: 0, y: 0, scale: 1 };
          updateTransform();
        };

        svgEl.style.cursor = 'grab';
        svgEl.addEventListener('wheel', onWheel);
        svgEl.addEventListener('mousedown', onMouseDown);
        // Listen on `window` for move/up to catch drags that leave the SVG area
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        svgEl.addEventListener('dblclick', onDoubleClick);

        zoomCleanup = () => {
          svgEl.style.cursor = '';
          svgEl.removeEventListener('wheel', onWheel);
          svgEl.removeEventListener('mousedown', onMouseDown);
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
          svgEl.removeEventListener('dblclick', onDoubleClick);
          if (plotArea) {
            (plotArea as SVGElement).style.transform = '';
            (plotArea as SVGElement).style.transformOrigin = '';
          }
        };
      }
    }

    cleanupRef.current = () => {
      tip.remove();
      marks.forEach(m => { m.replaceWith(m.cloneNode(true)); });
      
      // Cleanup zoom functionality
      if (zoomCleanup) {
        zoomCleanup();
      }
    };

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, [svgContent]);

  if (error) return <ErrorDisplay message={error} />;
  if (!svgContent) return <div>Loading...</div>;

  return (
    <div
      ref={containerRef}
      className="visualization-container"
      style={{ 
        width: '100%', 
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden'
      }}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
};

export default VisualizationRenderer;
export type { InteractionConfig };