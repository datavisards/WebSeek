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
  selection?: {
    enabled: boolean;
    type: 'single' | 'multi' | 'box';
    fields?: string[];
  };
}

interface VisualizationRendererProps {
  spec: object;
  onImageUrlReady?: (url: string) => void;
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
}) => {
  console.log('VisualizationRenderer: Component mounted/re-rendered');
  
  const [svgContent, setSvgContent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dataValuesRef = useRef<any[] | undefined>(undefined);
  const marksRef = useRef<SVGElement[]>([]);
  const cleanupRef = useRef<(() => void) | null>(null);
  const metaRef = useRef<any>(null);

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
          const blob = new Blob([processed], { type: 'image/svg+xml' });
          onImageUrlReady(URL.createObjectURL(blob));
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
        marks = allCircles.filter(el => !el.classList.contains('brush-box'));
        console.log('Step 3-CIRCLE: Using', marks.length, 'circles as marks');
      } else {
        // Fallback to all shapes
        const primitiveSelector = 'circle,path,rect,polygon,polyline,ellipse,line';
        const allShapes = Array.from(svgEl.querySelectorAll(primitiveSelector)) as SVGElement[];
        console.log('Step 3: Found', allShapes.length, 'total shapes');
        
        marks = allShapes.filter(el => {
          const hasValidFill = el.getAttribute('fill') !== 'none';
          const hasValidStroke = el.getAttribute('stroke') !== 'none';
          const notBrushBox = !el.classList.contains('brush-box');
          console.log('Shape filter:', el.tagName, 'fill:', el.getAttribute('fill'), 'stroke:', el.getAttribute('stroke'), 'valid:', hasValidFill || hasValidStroke, 'not brush:', notBrushBox);
          return notBrushBox && (hasValidFill || hasValidStroke);
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
    tip.style.cssText = 'position:absolute;padding:4px 6px;font:12px/1.3 sans-serif;background:#222;color:#fff;border-radius:4px;pointer-events:none;opacity:0;transition:opacity .12s;z-index:9999;max-width:320px;white-space:normal;word-break:break-word;overflow-wrap:anywhere;box-shadow:0 2px 6px rgba(0,0,0,0.4);';
    document.body.appendChild(tip);

    function showTip(e: MouseEvent | FocusEvent, text: string) {
      tip.textContent = text;
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
    });

    // Selection state
    const state = { selected: new Set<string>(), brush: null as any };
    function renderSelection() {
      const shapeSelector = 'path,circle,rect,line,polygon,polyline,ellipse';
      if (state.selected.size > 0) {
        console.log('renderSelection called, selected:', state.selected.size, 'items');
      }
      
      marks.forEach(m => {
        const id = m.getAttribute('data-idx') || '';
        const sel = state.selected.has(id);
        
        // Apply selection styling
        if (sel) {
          console.log('Selecting mark with id:', id, 'element:', m.tagName);
          m.classList.add('selected');
          m.setAttribute('aria-selected', 'true');
          
          // Find all shapes within this mark, with special attention to circles
          let shapes: SVGElement[] = m.matches(shapeSelector) ? [m as any] : Array.from(m.querySelectorAll(shapeSelector));
          
          // If no shapes found but this is a group, look for circles specifically
          if (shapes.length === 0 && m.tagName.toLowerCase() === 'g') {
            shapes = Array.from(m.querySelectorAll('circle')) as SVGElement[];
          }
          
          console.log('Mark', id, 'shapes found:', shapes.length, 'types:', shapes.map(s => s.tagName));
          
          shapes.forEach((sh: any) => {
            // Store original attributes if not already stored
            if (!sh.dataset.origFill) sh.dataset.origFill = sh.getAttribute('fill') || 'none';
            if (!sh.dataset.origStroke) sh.dataset.origStroke = sh.getAttribute('stroke') || 'none';
            if (!sh.dataset.origStrokeWidth) sh.dataset.origStrokeWidth = sh.getAttribute('stroke-width') || '1';
            if (sh.tagName.toLowerCase() === 'circle' && !sh.dataset.origR) sh.dataset.origR = sh.getAttribute('r') || '';
            
            const origFill = sh.dataset.origFill;
            const needsFill = !origFill || origFill === 'none' || origFill === 'transparent';
            const newFill = needsFill ? 'rgba(255,107,53,0.6)' : highlightFill(origFill);
            
            // Apply highlighting styles
            sh.setAttribute('fill', newFill);
            sh.style.setProperty('fill', newFill, 'important');
            sh.setAttribute('stroke', '#FF6B35');
            sh.style.setProperty('stroke', '#FF6B35', 'important');
            sh.setAttribute('stroke-width', '3');
            sh.style.setProperty('stroke-width', '3px', 'important');
            sh.style.setProperty('stroke-opacity', '1', 'important');
            
            // Add visual emphasis with filter
            sh.style.setProperty('filter', 'drop-shadow(0 0 4px rgba(255,107,53,0.8))', 'important');
            
            // Enlarge circles for emphasis and ensure visibility
            if (sh.tagName.toLowerCase() === 'circle') {
              const r = parseFloat(sh.getAttribute('r') || sh.dataset.origR || '0');
              if (!isNaN(r) && r > 0) {
                const newR = Math.max(r * 1.4, 4); // Ensure minimum 4px radius for visibility
                sh.setAttribute('r', newR.toString());
                sh.style.setProperty('r', newR.toString(), 'important');
                console.log('Circle highlighting: enlarged radius from', r, 'to', newR);
              }
            }
            
            // Add selected class to shapes as well for CSS targeting
            sh.classList.add('selected');
          });
        } else {
          m.classList.remove('selected');
          m.removeAttribute('aria-selected');
          
          const shapes: SVGElement[] = m.matches(shapeSelector) ? [m as any] : Array.from(m.querySelectorAll(shapeSelector));
          shapes.forEach((sh: any) => {
            // Restore original attributes
            if (sh.dataset.origFill !== undefined) {
              sh.setAttribute('fill', sh.dataset.origFill);
              sh.style.setProperty('fill', sh.dataset.origFill, 'important');
            }
            if (sh.dataset.origStroke !== undefined) {
              sh.setAttribute('stroke', sh.dataset.origStroke);
              sh.style.setProperty('stroke', sh.dataset.origStroke, 'important');
            }
            if (sh.dataset.origStrokeWidth !== undefined) {
              sh.setAttribute('stroke-width', sh.dataset.origStrokeWidth);
              sh.style.setProperty('stroke-width', sh.dataset.origStrokeWidth, 'important');
            }
            if (sh.dataset.origR !== undefined) {
              sh.setAttribute('r', sh.dataset.origR);
              sh.style.setProperty('r', sh.dataset.origR, 'important');
            }
            
            // Remove highlight styling
            sh.style.removeProperty('filter');
            sh.style.removeProperty('stroke-opacity');
            
            // Remove selected class from shapes
            sh.classList.remove('selected');
          });
        }
      });
      
      svgEl!.dispatchEvent(new CustomEvent('webseek:selectionChanged', { detail: { indices: [...state.selected], data: [...state.selected].map(i => dataValuesRef.current?.[Number(i)]) } }));
    }

    function highlightFill(orig: string) {
      // Attempt to generate a brighter variant; if hex color, lighten
      const hexMatch = /^#([0-9a-f]{3,8})$/i.exec(orig.trim());
      if (hexMatch) {
        let hex = hexMatch[1];
        if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
        if (hex.length >= 6) {
          const r = parseInt(hex.substring(0,2),16);
          const g = parseInt(hex.substring(2,4),16);
          const b = parseInt(hex.substring(4,6),16);
          const nr = Math.min(255, Math.round(r * 1.15 + 20));
          const ng = Math.min(255, Math.round(g * 1.05 + 10));
          const nb = Math.min(255, Math.round(b * 0.9 + 5));
          return `rgba(${nr},${ng},${nb},0.85)`;
        }
      }
      // Fallback: add opacity overlay tint
      return 'rgba(255,107,53,0.45)';
    }

    marks.forEach(m => {
      m.addEventListener('click', (e: MouseEvent) => {
        const id = m.getAttribute('data-idx') || '';
        if (!id) return;
        if ((e.metaKey || e.shiftKey)) {
          if (state.selected.has(id)) state.selected.delete(id); else state.selected.add(id);
        } else {
          // Toggle single if already sole selected
            if (state.selected.size === 1 && state.selected.has(id)) {
              state.selected.clear();
            } else {
              state.selected.clear();
              state.selected.add(id);
            }
        }
        renderSelection();
      }, true); // capture to ensure we catch events even if child stops propagation
    });

    svgEl.addEventListener('keydown', (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement;
      if (tgt && tgt.classList.contains('interactive-mark') && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        tgt.click();
      }
    });

    // Basic brush selection (enhanced)
    let brushing = false; let start: { x: number; y: number } | null = null; let box: SVGRectElement | null = null; let prevSelection: Set<string> | null = null; let initiated = false; let brushPersisted = false;

    // Determine if visualization is effectively 1D (e.g., all marks share same y within epsilon)
    const isOneDimensional = (() => {
      if (marks.length < 2) return false;
      try {
        const transformedYs = marks.map(m => {
          let b = (m as any).getBBox();
          const transformAttr = m.getAttribute('transform');
          if (transformAttr) {
            const translateMatch = transformAttr.match(/translate\(([^,]+),\s*([^)]+)\)/);
            if (translateMatch) {
              const translateY = parseFloat(translateMatch[2]);
              return b.y + translateY;
            }
          }
          return b.y;
        });
        const minY = Math.min(...transformedYs); const maxY = Math.max(...transformedYs);
        const is1D = Math.abs(maxY - minY) < 5; // increased epsilon to 5px
        console.log('1D detection:', {
          transformedYs, 
          minY, 
          maxY, 
          diff: Math.abs(maxY - minY), 
          is1D
        });
        return is1D;
      } catch (error) { 
        console.log('1D detection error:', error);
        return false; 
      }
    })();

    function clientToSvg(e: MouseEvent) {
      const ctm = svgEl!.getScreenCTM();
      if (!ctm) return { x: 0, y: 0 };
      return { x: (e.clientX - ctm.e) / ctm.a, y: (e.clientY - ctm.f) / ctm.d };
    }

    function createBrushRect() {
      if (box) { box.remove(); box = null; }
      box = document.createElementNS(svgEl!.namespaceURI, 'rect') as SVGRectElement;
      box.setAttribute('class', 'brush-box');
      box.setAttribute('fill', 'rgba(100,150,240,0.15)');
      box.setAttribute('stroke', '#6496f0');
      box.setAttribute('stroke-width', '1');
      svgEl!.appendChild(box);
      brushPersisted = false;
    }

    function beginPotentialBrush(e: MouseEvent) {
      console.log('beginPotentialBrush called', e.target);
      if (e.button !== 0) {
        console.log('Not left button, ignoring');
        return; // left only
      }
      const target = e.target as Element;
      if (target.closest('.interactive-mark')) {
        console.log('Started on interactive mark, ignoring brush');
        return; // don't brush starting on a mark
      }
      // If an existing persisted brush exists, remove it to start new
      if (box && brushPersisted) { 
        console.log('Removing existing persisted brush');
        box.remove(); box = null; brushPersisted = false; 
      }
      brushing = false; // not active until movement threshold exceeded
      initiated = true;
      start = clientToSvg(e);
      prevSelection = new Set(state.selected); // preserve for cancel
      console.log('Brush initiated, start point:', start);
    }

    function ensureBrushActivated() {
      if (!brushing) {
        createBrushRect();
        brushing = true;
      }
    }

    function updateBrush(e: MouseEvent) {
      if (!initiated || !start) return;
      const pt = clientToSvg(e);
      const dx = Math.abs(pt.x - start.x); const dy = Math.abs(pt.y - start.y);
      if (!brushing) {
        // activation threshold (3 px in either axis)
        if (dx < 3 && dy < 3) return; // not yet a brush
        console.log('Brush activation threshold reached, dx:', dx, 'dy:', dy);
        ensureBrushActivated();
      }
      if (!box) {
        console.log('No brush box found, aborting updateBrush');
        return;
      }

      let x = Math.min(start.x, pt.x);
      let y = Math.min(start.y, pt.y);
      let w = Math.abs(start.x - pt.x);
      let h = Math.abs(start.y - pt.y);

      if (isOneDimensional) {
        // For 1D x-only brush, make rectangle span full vertical extent of marks / svg
        const vb = svgEl!.viewBox && svgEl!.viewBox.baseVal ? svgEl!.viewBox.baseVal : null;
        if (vb) { y = vb.y; h = vb.height; }
        else {
          // fallback: compute from mark extents
          const extents = marks.map(m => (m as any).getBBox());
            const minY = Math.min(...extents.map(b => b.y));
            const maxY = Math.max(...extents.map(b => b.y + b.height));
            y = minY; h = maxY - minY;
        }
      }

      box.setAttribute('x', String(x));
      box.setAttribute('y', String(y));
      box.setAttribute('width', String(w));
      box.setAttribute('height', String(h));

      // Recompute selection without mutating prev until activation
      state.selected.clear();
      console.log('🔍 Checking', marks.length, 'marks for intersection with brush area:', `x=${x}, y=${y}, w=${w}, h=${h}`);
      
      let foundIntersections = 0;
      marks.forEach((m, index) => {
        try {
          let b = (m as any).getBBox();
          const id = m.getAttribute('data-idx') || '';
          const isCircle = m.tagName.toLowerCase() === 'circle';
          
          // Apply transform to get actual coordinates in SVG space
          const transformAttr = m.getAttribute('transform');
          if (transformAttr) {
            const translateMatch = transformAttr.match(/translate\(([^,]+),\s*([^)]+)\)/);
            if (translateMatch) {
              const translateX = parseFloat(translateMatch[1]);
              const translateY = parseFloat(translateMatch[2]);
              b = {
                x: b.x + translateX,
                y: b.y + translateY,
                width: b.width,
                height: b.height
              };
            }
          }
          
          console.log(`🔍 Mark ${index} (${m.tagName}):`, 
            `id=${id}`,
            `isCircle=${isCircle}`,
            `transformedBbox={x:${b.x}, y:${b.y}, w:${b.width}, h:${b.height}}`,
            `transform=${m.getAttribute('transform')}`
          );
          
          if (isOneDimensional) {
            console.log('Taking 1D intersection path for mark', id);
            const cx = b.x + b.width / 2;
            if (cx >= x && cx <= x + w) {
              state.selected.add(id);
              foundIntersections++;
              console.log('✅ 1D intersection found for mark', id, 'cx:', cx);
            } else {
              console.log('❌ 1D intersection failed for mark', id, `cx:${cx}, brush x:${x} to ${x+w}`);
            }
          } else {
            console.log('Taking 2D intersection path for mark', id);
            let intersects = false;
            
            if (isCircle) {
              // Special handling for circles - use center point and radius
              let cx = parseFloat(m.getAttribute('cx') || '0');
              let cy = parseFloat(m.getAttribute('cy') || '0');
              const r = parseFloat(m.getAttribute('r') || '0');
              
              // Handle coordinate transformations
              try {
                const bbox = (m as any).getBBox();
                // Use bbox center if it differs significantly from cx/cy (indicates transform)
                const bboxCx = bbox.x + bbox.width / 2;
                const bboxCy = bbox.y + bbox.height / 2;
                
                if (Math.abs(bboxCx - cx) > 1 || Math.abs(bboxCy - cy) > 1) {
                  console.log('🔄 Using bbox center due to transform:', {original: {cx, cy}, bbox: {bboxCx, bboxCy}});
                  cx = bboxCx;
                  cy = bboxCy;
                }
              } catch (error) {
                console.warn('⚠️ Could not get bbox for circle, using attributes');
              }
              
              // Check if circle center is within brush area (with some tolerance)
              const tolerance = Math.max(r, 3); // Use radius or 3px, whichever is larger
              intersects = (cx + tolerance >= x && cx - tolerance <= x + w && 
                           cy + tolerance >= y && cy - tolerance <= y + h);
              
              console.log('🎯 Circle intersection check:', {
                element: m.tagName, 
                originalCx: parseFloat(m.getAttribute('cx') || '0'),
                originalCy: parseFloat(m.getAttribute('cy') || '0'),
                finalCx: cx, finalCy: cy, r, 
                tolerance,
                brush: {x, y, w, h},
                intersects,
                transform: m.getAttribute('transform'),
                parentTransform: m.parentElement?.getAttribute('transform')
              });
            } else {
              // Standard bbox intersection for other shapes
              intersects = !(b.x + b.width < x || b.x > x + w || b.y + b.height < y || b.y > y + h);
              console.log('📐 Standard intersection check:', 
                `element=${m.tagName}`,
                `bbox={x:${b.x.toFixed(2)}, y:${b.y.toFixed(2)}, w:${b.width.toFixed(2)}, h:${b.height.toFixed(2)}}`,
                `brush={x:${x.toFixed(2)}, y:${y.toFixed(2)}, w:${w.toFixed(2)}, h:${h.toFixed(2)}}`,
                `tests: left=${(b.x + b.width < x)} right=${(b.x > x + w)} top=${(b.y + b.height < y)} bottom=${(b.y > y + h)}`,
                `intersects=${intersects}`
              );
            }
            
            if (intersects) {
              state.selected.add(id);
              foundIntersections++;
              console.log('✅ 2D intersection found for', isCircle ? 'circle' : 'shape', id);
            }
          }
        } catch (error) {
          console.warn('❌ Error getting bbox for mark:', m, error);
        }
      });
      
      console.log('📊 Found', foundIntersections, 'intersecting marks');
      renderSelection();
    }

    function endBrush() {
      if (!initiated) return;
      if (brushing && box) {
        // finalize selection but keep box visible (persist)
        brushPersisted = true;
      } else {
        // No brush activation (click background) -> restore previous selection
        if (prevSelection) {
          state.selected = new Set(prevSelection);
          renderSelection();
        }
        // Do not remove existing persisted box here; only if starting new or clicking outside
        if (!brushPersisted && box) { box.remove(); box = null; }
      }
      brushing = false; initiated = false; start = null; prevSelection = null;
    }

    function cancelBrush() {
      if (!initiated) return;
      if (!brushPersisted && box) { box.remove(); box = null; }
      if (prevSelection) {
        state.selected = new Set(prevSelection);
        renderSelection();
      }
      brushing = false; initiated = false; start = null; prevSelection = null; brushPersisted = false;
    }

    const mousedownHandler = (e: MouseEvent) => { 
      console.log('SVG mousedown event:', e.target, 'button:', e.button);
      beginPotentialBrush(e); 
    };
    svgEl.addEventListener('mousedown', mousedownHandler, true); // capture to precede mark handlers
    
    const mousemoveHandler = (e: MouseEvent) => {
      if (initiated || brushing) {
        // console.log('mousemove during brush operation');  // too verbose
      }
      updateBrush(e);
    };
    window.addEventListener('mousemove', mousemoveHandler);
    
    const mouseupHandler = () => {
      if (initiated || brushing) {
        console.log('mouseup ending brush operation');
      }
      endBrush();
    };
    window.addEventListener('mouseup', mouseupHandler);
    
    const keydownHandler = (e: KeyboardEvent) => { 
      if (e.key === 'Escape') {
        console.log('Escape key pressed, canceling brush');
        cancelBrush(); 
      }
    };
    window.addEventListener('keydown', keydownHandler);

    // Clicking outside the persisted brush box removes it (and clears selection)
    function backgroundClickHandler(e: MouseEvent) {
      if (!box || !brushPersisted) return;
      const target = e.target as Element;
      if (target.closest('.interactive-mark')) return; // ignore mark clicks
      const pt = clientToSvg(e);
      const bx = parseFloat(box.getAttribute('x') || '0');
      const by = parseFloat(box.getAttribute('y') || '0');
      const bw = parseFloat(box.getAttribute('width') || '0');
      const bh = parseFloat(box.getAttribute('height') || '0');
      const inside = pt.x >= bx && pt.x <= bx + bw && pt.y >= by && pt.y <= by + bh;
      if (!inside) {
        box.remove(); box = null; brushPersisted = false;
        state.selected.clear();
        renderSelection();
      }
    }
    svgEl.addEventListener('click', backgroundClickHandler, true);

    svgEl.dispatchEvent(new CustomEvent('webseek:dataMapping', { detail: { dataValues: dataValuesRef.current } }));

    if (!document.getElementById('__webseek_interaction_styles')) {
      const style = document.createElement('style');
      style.id = '__webseek_interaction_styles';
      style.textContent = `
        .interactive-mark { 
          cursor: pointer; 
          pointer-events: all; 
          transition: filter .15s, opacity .15s; 
        }
        .brush-box { 
          pointer-events: none; 
          fill: rgba(100,150,240,0.15);
          stroke: #6496f0;
          stroke-width: 1;
        }
        /* Enhanced selection styles for brush highlighting */
        .interactive-mark.selected {
          filter: drop-shadow(0 0 6px rgba(255,107,53,0.9)) drop-shadow(0 0 12px rgba(255,107,53,0.5)) !important;
        }
        .interactive-mark.selected *,
        .interactive-mark.selected path,
        .interactive-mark.selected rect,
        .interactive-mark.selected circle,
        .interactive-mark.selected polygon,
        .interactive-mark.selected polyline,
        .interactive-mark.selected ellipse {
          filter: drop-shadow(0 0 6px rgba(255,107,53,0.9)) drop-shadow(0 0 12px rgba(255,107,53,0.5)) !important;
          stroke: #FF6B35 !important;
          stroke-width: 3px !important;
          stroke-opacity: 1 !important;
        }
        /* Additional fallback styles */
        svg .selected {
          filter: drop-shadow(0 0 6px rgba(255,107,53,0.9)) !important;
          stroke: #FF6B35 !important;
          stroke-width: 3px !important;
        }
        /* Specific styles for circles */
        svg circle.selected,
        .interactive-mark.selected circle {
          fill: rgba(255,107,53,0.7) !important;
          stroke: #FF6B35 !important;
          stroke-width: 3px !important;
          filter: drop-shadow(0 0 8px rgba(255,107,53,0.9)) drop-shadow(0 0 16px rgba(255,107,53,0.5)) !important;
        }
      `;
      document.head.appendChild(style);
    }

    cleanupRef.current = () => {
      tip.remove();
      svgEl.removeEventListener('mousedown', mousedownHandler, true);
      window.removeEventListener('mousemove', mousemoveHandler);
      window.removeEventListener('mouseup', mouseupHandler);
      window.removeEventListener('keydown', keydownHandler);
      svgEl.removeEventListener('click', backgroundClickHandler, true);
      marks.forEach(m => { m.replaceWith(m.cloneNode(true)); });
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