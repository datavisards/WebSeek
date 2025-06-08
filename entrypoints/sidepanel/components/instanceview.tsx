import { browser, type Browser } from 'wxt/browser';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import './instanceview.css';

// Define types for embedded instances and sketch items
type EmbeddedInstance =
  | { type: 'text'; content: string; id: string, originalId?: string }
  | { type: 'image'; src: string; id: string, originalId?: string }
  | { type: 'table'; id: string, originalId?: string }
  | { type: 'sketch'; id: string, originalId?: string };

type SketchItem =
  | {
    type: 'stroke';
    id: string;
    points: Array<{ x: number; y: number }>;
    color: string;
    width: number;
  }
  | {
    type: 'instance';
    id: string;
    instance: EmbeddedInstance;
    x: number;
    y: number;
    width: number;
    height: number;
  };

type TextInstance = {
  id: string;
  type: 'text';
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

type ImageInstance = {
  id: string;
  type: 'image';
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

type SketchInstance = {
  id: string;
  type: 'sketch';
  x: number;
  y: number;
  width: number;
  height: number;
  content: SketchItem[];
  thumbnail: string;
}

type TableInstance = {
  id: string;
  type: 'table';
  rows: number;
  cols: number;
  cells: Array<{
    row: number;
    col: number;
    content: EmbeddedInstance[];
  }>;
  x: number;
  y: number;
  width: number;
  height: number;
}

type Instance = TextInstance | ImageInstance | SketchInstance | TableInstance;

// Props interface for the component
interface InstanceViewProps {
  onOperation: (message: string) => void;
}

const InstanceView = ({ onOperation }: InstanceViewProps) => {
  const [instances, setInstances] = useState<Instance[]>([]);
  const instancesRef = useRef<Instance[]>([]); // Update the latest instances (For callback)
  // Counters for different instance types
  const [textCount, setTextCount] = useState(0);
  const textCountRef = useRef(0);
  const [imageCount, setImageCount] = useState(0);
  const imageCountRef = useRef(0);
  const [sketchCount, setSketchCount] = useState(0);
  const sketchCountRef = useRef(0);
  const [isCaptureEnabled, setIsCaptureEnabled] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<{
    x: number;
    y: number;
    initialPan: { x: number; y: number };
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggingInstanceId, setDraggingInstanceId] = useState<string | null>(null);
  const dragStartPos = useRef<{
    mouseX: number;
    mouseY: number;
    instanceX: number;
    instanceY: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(
    null
  );
  const selectedInstanceIdRef = useRef<string | null>(null);
  // Resizing state
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<string | null>(null);
  const resizerStart = useRef<{
    mouseX: number;
    mouseY: number;
    instanceWidth: number;
    instanceHeight: number;
    instanceX: number;
    instanceY: number;
    initialCanvasX: number;
    initialCanvasY: number;
  } | null>(null);
  // General editor state
  const [originalInstanceId, setOriginalInstanceId] = useState<string | null>(null);
  // Sketch editor state
  const [editingSketchId, setEditingSketchId] = useState<string | null>(null);
  const [sketchColor, setSketchColor] = useState('#000000');
  const sketchWidth = 3;
  const [currentStroke, setCurrentStroke] = useState<{
    id: string;
    points: Array<{ x: number; y: number }>;
  } | null>(null);
  const sketchCanvasRef = useRef<HTMLCanvasElement>(null);
  const [availableInstances, setAvailableInstances] = useState<Instance[]>([]);
  const [draggingEmbeddedId, setDraggingEmbeddedId] = useState<string | null>(null);
  const dragEmbeddedStart = useRef<{
    mouseCanvasX: number;
    mouseCanvasY: number;
    initialX: number;
    initialY: number;
  } | null>(null);
  const [currentMode, setCurrentMode] = useState<'draw' | 'move'>('draw'); // Mode for sketching or moving instances during creation of sketches
  const bgPort = useRef<Browser.runtime.Port | null>(null);
  const [deletedInstances, setDeletedInstances] = useState<Instance[]>([]);
  const deletedInstancesRef = useRef<Instance[]>([]);
  const [showTrash, setShowTrash] = useState(false);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingTextContent, setEditingTextContent] = useState<string>('');
  const [editingOriginalImageId, setEditingOriginalImageId] = useState<string | null>(null);
  const [sketchResizingItemId, setSketchResizingItemId] = useState<string | null>(null);
  const [sketchResizeDirection, setSketchResizeDirection] = useState<string | null>(null);
  const sketchResizerStart = useRef<{
    mouseX: number;
    mouseY: number;
    instanceWidth: number;
    instanceHeight: number;
    instanceX: number;
    instanceY: number;
  } | null>(null);
  // Table editor state
  const [editingTableId, setEditingTableId] = useState<string | null>(null);
  const [tableCount, setTableCount] = useState(0);
  const tableCountRef = useRef(0);

  // Update the latest state values
  useEffect(() => {
    textCountRef.current = textCount;
    imageCountRef.current = imageCount;
    sketchCountRef.current = sketchCount;
    tableCountRef.current = tableCount;
    instancesRef.current = instances;
    selectedInstanceIdRef.current = selectedInstanceId;
    deletedInstancesRef.current = deletedInstances;
  }, [textCount, imageCount, sketchCount, tableCount, instances, selectedInstanceId, deletedInstances]);

  // Helper function to generate unique IDs
  const generateId = () => '_' + Math.random().toString(36).substr(2, 9);

  // Convert screen coordinates to canvas coordinates
  const screenToCanvas = (screenX: number, screenY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const x = (screenX - rect.left - pan.x) / zoom;
    const y = (screenY - rect.top - pan.y) / zoom;
    return { x, y };
  };

  // Handle wheel events for zooming
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      const containerRect = container.getBoundingClientRect();
      const mouseX = e.clientX - containerRect.left;
      const mouseY = e.clientY - containerRect.top;

      const canvasX = (mouseX - pan.x) / zoom;
      const canvasY = (mouseY - pan.y) / zoom;

      const zoomFactor = 1.1;
      const newZoom = e.deltaY < 0
        ? Math.min(5, zoom * zoomFactor)
        : Math.max(0.2, zoom / zoomFactor);

      const newPanX = mouseX - canvasX * newZoom;
      const newPanY = mouseY - canvasY * newZoom;

      setZoom(newZoom);
      setPan({ x: newPanX, y: newPanY });
    };

    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [zoom, pan]);

  // Handle drag and drop
  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const { x, y } = screenToCanvas(event.clientX, event.clientY);
    const items = event.dataTransfer.items;
    let handled = false;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          const newId = `Image${imageCount + 1}`;
          setImageCount(prev => prev + 1);
          onOperation(`Created [${newId}](#instance-${newId})`);
          const reader = new FileReader();
          reader.onload = (e) => {
            const result = e.target?.result;
            if (result) {
              setInstances(prev => [...prev, {
                // id: generateId(),
                id: newId,
                type: 'image',
                src: result as string,
                x,
                y,
                width: 100,
                height: 100
              }]);
            }
          };
          reader.readAsDataURL(file);
          handled = true;
        }
      }
    }

    if (!handled) {
      const text = event.dataTransfer.getData('text/plain');
      if (text) {
        const newId = `Text${textCountRef.current + 1}`;
        setTextCount(prev => prev + 1);
        onOperation(`Created [${text.length > 10 ? text.slice(0, 10) + '...' : text}](#instance-${newId})`);
        setInstances(prev => [...prev, {
          id: newId,
          type: 'text',
          content: text,
          x,
          y,
          width: 100,
          height: 20
        }]);
      }
    }
  };

  // Handle paste events
  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    const pasteX = rect ? (rect.width / 2 - pan.x) / zoom : 0;
    const pasteY = rect ? (rect.height / 2 - pan.y) / zoom : 0;

    const items = event.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          const newId = `Image${imageCount + 1}`;
          setImageCount(prev => prev + 1);
          onOperation(`Created [${newId}](#instance-${newId})`);
          const reader = new FileReader();
          reader.onload = (e) => {
            const result = e.target?.result;
            if (result) {
              setInstances(prev => [...prev, {
                // id: generateId(),
                id: newId,
                type: 'image',
                src: result as string,
                x: pasteX,
                y: pasteY,
                width: 100,
                height: 100
              }]);
            }
          };
          reader.readAsDataURL(file);
        }
      } else if (item.type === 'text/plain') {
        item.getAsString((text) => {
          const newId = `Text${textCountRef.current + 1}`;
          setTextCount(prev => prev + 1);
          onOperation(`Created [${text.length > 10 ? text.slice(0, 10) + '...' : text}](#instance-${newId})`);
          setInstances(prev => [...prev, {
            id: newId,
            type: 'text',
            content: text,
            x: pasteX,
            y: pasteY,
            width: 100,
            height: 20
          }]);
        });
      }
    }
  };

  // Handle drag over
  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };

  // Handle mouse down for panning
  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;

    const isOnInstance = instances.some(instance => {
      const element = document.getElementById(`instance-${instance.id}`);
      return element && element.contains(event.target as Node);
    });

    if (!isOnInstance) {
      setIsResizing(false);
      setSelectedInstanceId(null);
      setIsPanning(true);
      panStart.current = {
        x: event.clientX,
        y: event.clientY,
        initialPan: { x: pan.x, y: pan.y },
      };
    }
  };

  // Handle touch start for mobile
  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 1) return;

    const touch = event.touches[0];
    const isOnInstance = instances.some(instance => {
      const element = document.getElementById(`instance-${instance.id}`);
      return element && element.contains(touch.target as Node);
    });

    if (!isOnInstance) {
      setIsResizing(false);
      setSelectedInstanceId(null);
      setIsPanning(true);
      panStart.current = {
        x: touch.clientX,
        y: touch.clientY,
        initialPan: { x: pan.x, y: pan.y },
      };
    }
  };

  // Handle mouse move for panning and resizing
  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isPanning && panStart.current) {
      const { x: startX, y: startY, initialPan } = panStart.current;
      const sensitivity = 0.5;
      const dx = (event.clientX - startX) * sensitivity / zoom;
      const dy = (event.clientY - startY) * sensitivity / zoom;
      setPan({
        x: initialPan.x + dx,
        y: initialPan.y + dy,
      });
    }

    if (isResizing && resizeDirection && selectedInstanceId) {
      const instance = instances.find(inst => inst.id === selectedInstanceId);
      if (!instance || !resizerStart.current) return;

      const { x: currentCanvasX, y: currentCanvasY } = screenToCanvas(event.clientX, event.clientY);
      const { instanceWidth, instanceHeight, instanceX, instanceY, initialCanvasX, initialCanvasY } = resizerStart.current;

      const deltaX = currentCanvasX - initialCanvasX;
      const deltaY = currentCanvasY - initialCanvasY;

      let newWidth = instanceWidth;
      let newHeight = instanceHeight;
      let newX = instanceX;
      let newY = instanceY;

      switch (resizeDirection) {
        case 'top-left':
          newX = instanceX + deltaX;
          newY = instanceY + deltaY;
          newWidth = instanceWidth - deltaX;
          newHeight = instanceHeight - deltaY;
          break;
        case 'top-right':
          newY = instanceY + deltaY;
          newWidth = instanceWidth + deltaX;
          newHeight = instanceHeight - deltaY;
          break;
        case 'bottom-right':
          newWidth = instanceWidth + deltaX;
          newHeight = instanceHeight + deltaY;
          break;
        case 'bottom-left':
          newX = instanceX + deltaX;
          newWidth = instanceWidth - deltaX;
          newHeight = instanceHeight + deltaY;
          break;
      }

      newWidth = Math.max(10, newWidth);
      newHeight = Math.max(10, newHeight);

      setInstances(prev =>
        prev.map(inst => {
          if (inst.id === selectedInstanceId) {
            return {
              ...inst,
              x: newX,
              y: newY,
              width: newWidth,
              height: newHeight,
            };
          }
          return inst;
        }),
      );
    }

    if (!isResizing && draggingInstanceId && dragStartPos.current) {
      const { x: currentCanvasX, y: currentCanvasY } = screenToCanvas(
        event.clientX,
        event.clientY
      );
      const { offsetX, offsetY } = dragStartPos.current;

      setInstances(prev =>
        prev.map(inst => {
          if (inst.id === draggingInstanceId) {
            return {
              ...inst,
              x: currentCanvasX - offsetX,
              y: currentCanvasY - offsetY,
            };
          }
          return inst;
        }),
      );
    }

    if (draggingEmbeddedId && dragEmbeddedStart.current) {
      const rect = sketchCanvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      // Get current mouse position in canvas coordinates
      const currentCanvasX = event.clientX - rect.left;
      const currentCanvasY = event.clientY - rect.top;

      setInstances(prev =>
        prev.map(sketchInst => {
          if (sketchInst.type === 'sketch' && sketchInst.id === editingSketchId) {
            const updatedContent = sketchInst.content.map(item => {
              if (item.type === 'instance' && item.id === draggingEmbeddedId) {
                const dragData = dragEmbeddedStart.current;
                if (!dragData) return item;

                return {
                  ...item,
                  x: dragData.initialX + (currentCanvasX - dragData.mouseCanvasX),
                  y: dragData.initialY + (currentCanvasY - dragData.mouseCanvasY),
                };
              }
              return item;
            });
            return { ...sketchInst, content: updatedContent };
          }
          return sketchInst;
        })
      );
    }

    // Handle resizing embedded instances in sketch
    if (sketchResizingItemId && sketchResizeDirection && sketchResizerStart.current) {
      const { mouseX, mouseY, instanceWidth, instanceHeight, instanceX, instanceY } = sketchResizerStart.current;

      const dx = event.clientX - mouseX;
      const dy = event.clientY - mouseY;

      let newX = instanceX;
      let newY = instanceY;
      let newWidth = instanceWidth;
      let newHeight = instanceHeight;

      switch (sketchResizeDirection) {
        case 'top-left':
          newX = instanceX + dx;
          newY = instanceY + dy;
          newWidth = Math.max(10, instanceWidth - dx);
          newHeight = Math.max(10, instanceHeight - dy);
          break;
        case 'top-right':
          newY = instanceY + dy;
          newWidth = Math.max(10, instanceWidth + dx);
          newHeight = Math.max(10, instanceHeight - dy);
          break;
        case 'bottom-right':
          newWidth = Math.max(10, instanceWidth + dx);
          newHeight = Math.max(10, instanceHeight + dy);
          break;
        case 'bottom-left':
          newX = instanceX + dx;
          newWidth = Math.max(10, instanceWidth - dx);
          newHeight = Math.max(10, instanceHeight + dy);
          break;
      }

      setInstances(prev =>
        prev.map(sketchInst => {
          if (sketchInst.type === 'sketch' && sketchInst.id === editingSketchId) {
            const updatedContent = sketchInst.content.map(item => {
              if (item.type === 'instance' && item.id === sketchResizingItemId) {
                return {
                  ...item,
                  x: newX,
                  y: newY,
                  width: newWidth,
                  height: newHeight
                };
              }
              return item;
            });
            return { ...sketchInst, content: updatedContent };
          }
          return sketchInst;
        })
      );
    }
  };

  // Handle touch move
  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];

    if (isPanning && panStart.current) {
      const { x: startX, y: startY, initialPan } = panStart.current;
      const sensitivity = 0.5;
      const dx = (touch.clientX - startX) * sensitivity / zoom;
      const dy = (touch.clientY - startY) * sensitivity / zoom;
      setPan({
        x: initialPan.x + dx,
        y: initialPan.y + dy,
      });
    }
    event.preventDefault();
  };

  // Handle mouse up to end panning/resizing
  const handleMouseUp = () => {
    setIsPanning(false);
    panStart.current = null;
    if (isResizing) {
      setIsResizing(false);
      setResizeDirection(null);
      resizerStart.current = null;
    }
    setDraggingInstanceId(null);
    dragStartPos.current = null;
    setDraggingEmbeddedId(null);
    dragEmbeddedStart.current = null;
    setSketchResizingItemId(null);
    setSketchResizeDirection(null);
    sketchResizerStart.current = null;
  };

  // Handle touch end
  const handleTouchEnd = () => {
    setIsPanning(false);
    panStart.current = null;
    setDraggingInstanceId(null);
    dragStartPos.current = null;
  };

  // Handle canvas click to deselect
  const handleCanvasClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const isOnInstance = instances.some(instance => {
      const element = document.getElementById(`instance-${instance.id}`);
      return element && element.contains(event.target as Node);
    });

    if (!isOnInstance) {
      setIsResizing(false);
      setSelectedInstanceId(null);
    }
  };

  // Handle instance mouse down for dragging
  const handleInstanceMouseDown = (
    event: React.MouseEvent<HTMLDivElement>,
    id: string
  ) => {
    event.stopPropagation();
    if (event.button !== 0) return;

    if (isResizing) return;

    setSelectedInstanceId(id);
    const instance = instances.find(inst => inst.id === id);
    if (!instance) return;

    const { x: canvasX, y: canvasY } = screenToCanvas(event.clientX, event.clientY);
    setDraggingInstanceId(id);
    dragStartPos.current = {
      mouseX: event.clientX,
      mouseY: event.clientY,
      instanceX: instance.x,
      instanceY: instance.y,
      offsetX: canvasX - instance.x,
      offsetY: canvasY - instance.y,
    };
  };

  // Handle resizer mouse down for resizing
  const handleResizerMouseDown = (direction: string, instanceId: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    const instance = instances.find(inst => inst.id === instanceId);
    if (!instance) return;

    const { x: initialCanvasX, y: initialCanvasY } = screenToCanvas(e.clientX, e.clientY);
    resizerStart.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      instanceWidth: instance.width,
      instanceHeight: instance.height,
      instanceX: instance.x,
      instanceY: instance.y,
      initialCanvasX,
      initialCanvasY,
    };

    setSelectedInstanceId(instanceId);
    setIsResizing(true);
    setResizeDirection(direction);
  };

  // Create a new sketch
  const handleCreateSketch = () => {
    setOriginalInstanceId(null);
    const newId = `Sketch${sketchCount + 1}`;
    setSketchCount(prev => prev + 1);
    const newSketch: Instance = {
      id: newId,
      type: 'sketch',
      x: 0,
      y: 0,
      width: 400,
      height: 300,
      content: [],
      thumbnail: ''
    };
    setInstances(prev => [...prev, newSketch]);
    setAvailableInstances(prev => [...prev]);
    setEditingSketchId(newSketch.id);
  };

  // Add an instance to the sketch
  const handleAddToSketch = (instance: Instance) => {
    if (!editingSketchId) return;

    let embedded: EmbeddedInstance | null = null;

    if (instance.type === 'text') {
      embedded = { type: 'text', id: generateId(), content: instance.content };
    } else if (instance.type === 'image') {
      embedded = { type: 'image', id: generateId(), src: instance.src };
    } else if (instance.type === 'table') {
      embedded = { type: 'table', id: generateId(), originalId: instance.id };
    }

    if (embedded) {
      setInstances(prev => prev.map(inst => {
        if (inst.id === editingSketchId && inst.type === 'sketch') {
          const newItem: SketchItem = {
            type: 'instance',
            id: generateId(),
            instance: embedded!,
            x: 50,
            y: 50,
            width: instance.width,
            height: instance.height
          };
          return { ...inst, content: [...inst.content, newItem] };
        }
        return inst;
      }));
    }
  };

  // Save the sketch
  const handleSaveSketch = async () => {
    if (!editingSketchId || !sketchCanvasRef.current) return;

    const canvas = sketchCanvasRef.current;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');

    if (!tempCtx) return;

    // Fill background as white
    tempCtx.fillStyle = 'white';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    const sketch = instances.find(inst =>
      inst.id === editingSketchId && inst.type === 'sketch'
    ) as SketchInstance | undefined;

    if (!sketch) return;

    // Draw all strokes
    sketch.content.forEach(item => {
      if (item.type === 'stroke') {
        tempCtx.beginPath();
        tempCtx.strokeStyle = item.color;
        tempCtx.lineWidth = item.width;
        tempCtx.lineCap = 'round';
        tempCtx.lineJoin = 'round';

        item.points.forEach((point, i) => {
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

        lines.forEach((line, i) => {
          tempCtx.fillText(
            line,
            item.x,
            item.y + 12 + (i * 15) // 12px baseline, 15px line height
          );
        });
        tempCtx.restore();
      }
      // Queue image drawing (async)
      else if (item.type === 'instance' && item.instance.type === 'image') {
        const img = new Image();
        img.src = item.instance.src;
        img.onload = () => {
          tempCtx.drawImage(img, item.x, item.y, item.width, item.height);
        };
      }
    });

    // Add current stroke if still drawing
    if (currentStroke) {
      tempCtx.beginPath();
      tempCtx.strokeStyle = sketchColor;
      tempCtx.lineWidth = sketchWidth;
      tempCtx.lineCap = 'round';
      tempCtx.lineJoin = 'round';

      currentStroke.points.forEach((point, i) => {
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
            const img = new Image();
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

    const thumbnail = tempCanvas.toDataURL('image/png');

    // Update instance with thumbnail
    setInstances(prev =>
      prev.map(inst => {
        if (inst.id === editingSketchId && inst.type === 'sketch') {
          return {
            ...inst,
            content: [
              ...inst.content,
              ...(currentStroke
                ? [{
                  type: 'stroke',
                  id: currentStroke.id,
                  points: currentStroke.points,
                  color: sketchColor,
                  width: sketchWidth
                } as SketchItem]
                : [])
            ],
            thumbnail
          };
        }
        return inst;
      })
    );

    // Create new ID
    const newSketchId = `Sketch${sketchCount + 1}`;
    setSketchCount(prev => prev + 1);
    sketch.id = newSketchId;

    // Log the operation
    let withstr = sketch.content
      .filter(item => item.type === 'instance')
      .map(item => {
        if (item.instance.type === 'text') {
          let text = item.instance.content;
          let display = text.length > 10 ? text.slice(0, 10) + '...' : text;
          return `[${display}](#instance-${item.instance.originalId || item.id})`;
        } else if (item.instance.type === 'image') {
          return `[${item.instance.originalId || item.id}](#instance-${item.instance.originalId || item.id})`;
        }
      })
      .join(', ');

    onOperation(`Created [${sketch.id}](#instance-${sketch.id})` + (originalInstanceId ? ` from [${originalInstanceId}](#instance-${originalInstanceId})` : '') + (withstr ? ` with ${withstr}` : ''));

    setCurrentStroke(null);
    setEditingSketchId(null);
  };

  // Cancel sketch creation
  const handleCancelSketch = () => {
    if (!editingSketchId) return;
    const sketch = instances.find(inst =>
      inst.id === editingSketchId && inst.type === 'sketch'
    ) as SketchInstance | undefined;
    if (editingOriginalImageId) {
      setInstances(prev => prev.filter(inst => inst.id !== editingSketchId));
      setEditingOriginalImageId(null); // Clear the flag
    } else if (sketch && sketch.content.length === 0) {
      // Only remove empty sketches for regular sketch creation
      setInstances(prev => prev.filter(inst => inst.id !== editingSketchId));
    }
    setEditingSketchId(null);
  };

  // Start drawing on the sketch canvas
  const startDrawing = (e: React.MouseEvent) => {
    if (!editingSketchId) return;

    const rect = sketchCanvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newStroke = {
      id: generateId(),
      points: [{ x, y }]
    };

    setCurrentStroke(newStroke);
  };

  // Continue drawing
  const draw = (e: React.MouseEvent) => {
    if (!currentStroke || !editingSketchId || !sketchCanvasRef.current) return;

    const rect = sketchCanvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setCurrentStroke(prev => ({
      ...prev!,
      points: [...prev!.points, { x, y }]
    }));
  };

  // End drawing and save stroke
  const endDrawing = () => {
    if (!currentStroke || !editingSketchId) return;

    setInstances(prev => prev.map(inst => {
      if (inst.id === editingSketchId && inst.type === 'sketch') {
        const newItem: SketchItem = {
          type: 'stroke',
          id: currentStroke.id,
          points: currentStroke.points,
          color: sketchColor,
          width: sketchWidth
        };
        return { ...inst, content: [...inst.content, newItem] };
      }
      return inst;
    }));

    setCurrentStroke(null);
  };

  // Render sketch to canvas
  useEffect(() => {
    if (!editingSketchId || !sketchCanvasRef.current) return;

    const sketch = instances.find(inst =>
      inst.id === editingSketchId && inst.type === 'sketch'
    ) as typeof instances[0] & { type: 'sketch' } | undefined;

    if (!sketch) return;

    const canvas = sketchCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all sketch items
    sketch.content.forEach(item => {
      if (item.type === 'stroke') {
        ctx.beginPath();
        ctx.strokeStyle = item.color;
        ctx.lineWidth = item.width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        item.points.forEach((point, i) => {
          if (i === 0) {
            ctx.moveTo(point.x, point.y);
          } else {
            ctx.lineTo(point.x, point.y);
          }
        });

        ctx.stroke();
      }
      // Instances are drawn in the editor UI separately
    });

    // Draw current stroke in progress
    if (currentStroke) {
      ctx.beginPath();
      ctx.strokeStyle = sketchColor;
      ctx.lineWidth = sketchWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      currentStroke.points.forEach((point, i) => {
        if (i === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      });

      ctx.stroke();
    }
  }, [editingSketchId, instances, currentStroke, sketchColor, sketchWidth]);

  const handleEmbeddedMouseDown = (e: React.MouseEvent, itemId: string) => {
    e.stopPropagation();
    setDraggingEmbeddedId(itemId);

    const rect = sketchCanvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Calculate canvas-relative coordinates for initial position
    const initialCanvasX = e.clientX - rect.left;
    const initialCanvasY = e.clientY - rect.top;

    // Find the sketch and the embedded item
    const sketch = instances.find(inst =>
      inst.id === editingSketchId && inst.type === 'sketch'
    ) as SketchInstance | undefined;

    if (!sketch) return;

    const embeddedItem = sketch.content.find(item =>
      item.type === 'instance' && item.id === itemId
    );

    if (!embeddedItem || embeddedItem.type !== 'instance') return;

    dragEmbeddedStart.current = {
      // Store canvas-relative coordinates
      mouseCanvasX: initialCanvasX,
      mouseCanvasY: initialCanvasY,
      initialX: embeddedItem.x,
      initialY: embeddedItem.y,
    };
  };

  useEffect(() => {
    let port = browser.runtime.connect({ name: 'side-panel' });
    bgPort.current = port;
    port.onMessage.addListener((msg) => {
      console.log("UI received FROM BACKGROUND:", msg);
      // Handle messages (msg.action, etc.)
      if (msg.action === 'element_selected') {
        handleElementSelected(msg);
      } else if (msg.action === 'selection_canceled') {
        console.log("Element selection canceled");
        setIsCaptureEnabled(true);
      } else if (msg.action === 'exit_selection') {
        setSelectedInstanceId(null);
        setDraggingInstanceId(null);
        setDraggingEmbeddedId(null);
      }
    });

    return () => port.disconnect();
  }, []);

  const handleElementSelected = (message: any) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const x = rect ? rect.width / 2 : 0;
    const y = rect ? rect.height / 2 : 0;

    if (message.type === 'text') {
      const text = message.data;
      const newId = `Text${textCountRef.current + 1}`;
      setTextCount(prev => prev + 1);
      onOperation(`Created [${text.length > 10 ? text.slice(0, 10) + '...' : text}](#instance-${newId}) from [${message.pageId}](${message.pageURL})`);
      setInstances(prev => [
        ...prev,
        {
          id: newId,
          type: 'text',
          content: text,
          x,
          y,
          width: 100,
          height: 20,
          sourcePageId: message.pageId,
        }
      ]);
    } else if (message.type === 'image') {
      const newId = `Image${imageCount + 1}`;
      setImageCount(prev => prev + 1);
      onOperation(`Created [${newId}](#instance-${newId}) from [${message.pageId}](${message.pageURL})`);
      setInstances(prev => [
        ...prev,
        {
          id: newId,
          type: 'image',
          src: message.data,
          x,
          y,
          width: 100,
          height: 100,
          sourcePageId: message.pageId,
        }
      ]);
    }
    setIsCaptureEnabled(true);
  };

  // Delete selected instance
  const deleteSelectedInstance = useCallback(() => {
    const instanceId = selectedInstanceIdRef.current;
    if (!instanceId) return;

    const instanceToDelete = instancesRef.current.find(inst => inst.id === instanceId);
    if (!instanceToDelete) return;

    // Set all state updates together
    setInstances(prev => prev.filter(inst => inst.id !== instanceId));
    setDeletedInstances(prev => [...prev, instanceToDelete]);
    setSelectedInstanceId(null);
  }, []);

  // Restore an instance from trash
  const restoreInstance = useCallback((instanceId: string) => {
    const instanceToRestore = deletedInstancesRef.current.find(inst => inst.id === instanceId);
    if (!instanceToRestore) return;

    // Update states
    setDeletedInstances(prev => prev.filter(inst => inst.id !== instanceId));
    setInstances(prev => [...prev, instanceToRestore]);
  }, []);

  const handleCaptureElement = () => {
    // send message via the background port
    if (bgPort.current) {
      console.log("Sending message to start element selection", bgPort.current);
      bgPort.current.postMessage({ action: 'start_element_selection' });
      setIsCaptureEnabled(false);
    }
  };

  // Add keyboard escape handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      console.log("Key pressed:", e.key);
      if (e.key === 'Escape') {
        e.preventDefault();
        if (!isCaptureEnabled && bgPort.current) {
          bgPort.current.postMessage({ action: 'exit_selection' });
        }
        setSelectedInstanceId(null);
        setDraggingInstanceId(null);
        setDraggingEmbeddedId(null);
        setIsCaptureEnabled(true);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelectedInstance();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCaptureEnabled]);

  const handleInstanceDoubleClick = (instance: Instance) => {
    setOriginalInstanceId(instance.id);
    if (instance.type === 'text') {
      setEditingTextId(instance.id);
      setEditingTextContent(instance.content);
    } else if (instance.type === 'image' || instance.type === 'sketch') {
      let newSketch: Instance = {
        id: generateId(),
        type: 'sketch',
        x: instance.x,
        y: instance.y,
        width: instance.width,
        height: instance.height,
        content: [],
        thumbnail: ''
      };
      if (instance.type === 'image') {
        newSketch.content.push({
          type: 'instance',
          id: generateId(),
          instance: {
            type: 'image',
            src: instance.src,
            id: generateId(),
            originalId: instance.id,
          },
          x: 0,
          y: 0,
          width: instance.width,
          height: instance.height
        })
        setEditingOriginalImageId(instance.id); // Store original image ID
      } else if (instance.type === 'sketch') {
        newSketch.content = instance.content.map(item => {
          if (item.type === 'instance') {
            return {
              ...item,
              id: generateId(),
              originalId: item.id,
            };
          }
          return item;
        });
      }
      setInstances(prev => [...prev, newSketch]);
      setEditingSketchId(newSketch.id);
      setAvailableInstances(prev => prev.filter(inst => inst.id !== instance.id));
    } else if (instance.type === 'table') {
      let newTable = structuredClone(instance) as TableInstance;
      newTable.id = generateId();
      newTable.cells = newTable.cells.map(row => ({
        ...row,
        content: row.content.map(cell => ({
          ...cell,
          id: generateId(),
          originalId: cell.originalId
        }))
      }));
      setInstances(prev => [...prev, newTable]);
      setAvailableInstances(instances.filter(inst => inst.type !== 'table'));
      setEditingTableId(newTable.id);
    }
  }

  useEffect(() => {
    console.log(availableInstances);
  })

  const handleSaveText = () => {
    const original = instances.find(inst => inst.id === editingTextId);
    if (!original || original.type !== 'text') return;
    const originalDisplay = original.content.length > 10 ? original.content.slice(0, 10) + '...' : original.content;

    const newTextId = `Text${textCountRef.current + 1}`;
    setTextCount(prev => prev + 1);
    setInstances(prev => [
      ...prev,
      {
        id: newTextId,
        type: 'text',
        content: editingTextContent,
        x: original.x,
        y: original.y,
        width: original.width,
        height: original.height
      }
    ]);
    const newDisplay = editingTextContent.length > 10 ? editingTextContent.slice(0, 10) + '...' : editingTextContent;

    onOperation(`Edited [${originalDisplay}](#instance-${original.id}) into [${newDisplay}](#instance-${newTextId})`);

    setEditingTextId(null);
  };

  // Handle mouse down for resizing embedded instances
  const handleEmbeddedResizerMouseDown = (e: React.MouseEvent, direction: string, itemId: string) => {
    e.stopPropagation();
    setSketchResizeDirection(direction);
    setSketchResizingItemId(itemId);

    const sketch = instances.find(inst =>
      inst.id === editingSketchId && inst.type === 'sketch'
    ) as SketchInstance | undefined;
    if (!sketch) return;

    const embeddedItem = sketch.content.find(item =>
      item.type === 'instance' && item.id === itemId
    ) as Extract<SketchItem, { type: 'instance' }> | undefined;
    if (!embeddedItem) return;

    sketchResizerStart.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      instanceWidth: embeddedItem.width,
      instanceHeight: embeddedItem.height,
      instanceX: embeddedItem.x,
      instanceY: embeddedItem.y
    };
  };


  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (!hash.startsWith('#instance-')) return;

      const instanceId = hash.replace('#instance-', '');
      const instanceElement = document.getElementById(`instance-${instanceId}`);

      if (instanceElement && containerRef.current) {
        const rect = instanceElement.getBoundingClientRect();
        const containerRect = containerRef.current.getBoundingClientRect();

        // Calculate position relative to container
        const offsetX = rect.left - containerRect.left;
        const offsetY = rect.top - containerRect.top;

        // Adjust pan to center the instance
        setPan({
          x: pan.x - offsetX / zoom + containerRect.width / 2 - rect.width / 2,
          y: pan.y - offsetY / zoom + containerRect.height / 2 - rect.height / 2,
        });

        // Highlight the instance
        instanceElement.classList.add('highlight');
        setTimeout(() => {
          instanceElement.classList.remove('highlight');
        }, 2000);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [pan, zoom]);

  // Text wrapping function for thumbnails
  const wrapTextForThumbnail = (
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    maxHeight: number
  ): string[] => {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    const lineHeight = 15; // Approximate line height

    ctx.font = '12px sans-serif';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);

      if (metrics.width <= maxWidth || currentLine === '') {
        currentLine = testLine;
      } else {
        // Check if adding this line would exceed max height
        if ((lines.length + 1) * lineHeight > maxHeight) {
          // Truncate current line if too long
          const widthWithEllipsis = ctx.measureText(currentLine + '...').width;
          if (widthWithEllipsis > maxWidth) {
            while (ctx.measureText(currentLine + '...').width > maxWidth) {
              currentLine = currentLine.slice(0, -1);
            }
          }
          currentLine += '...';
          lines.push(currentLine);
          return lines;
        }

        lines.push(currentLine);
        currentLine = word;
      }
    }

    // Add last line if within height limit
    if (currentLine) {
      if ((lines.length + 1) * lineHeight <= maxHeight) {
        lines.push(currentLine);
      } else {
        lines.push('...');
      }
    }

    return lines;
  };

  // Update table creation to include a placeholder for drag-and-drop
  const handleCreateTable = () => {
    setOriginalInstanceId(null);
    const rows = 3;
    const cols = 3;

    // Initialize cells for all positions
    const cells = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        cells.push({ row: r, col: c, content: [] });
      }
    }

    const newId = generateId();
    const newTable: Instance = {
      id: newId,
      type: 'table',
      rows,
      cols,
      cells,
      x: 0,
      y: 0,
      width: 400,
      height: 300
    };

    setEditingTableId(newId);
    setInstances(prev => [...prev, newTable]);
    setAvailableInstances(instances.filter(inst => inst.type !== 'table'));
  };

  // Handle adding to table cell (for both click and drag-and-drop)
  const handleAddToTable = useCallback((instance: Instance, row: number, col: number) => {
    if (!editingTableId) return;

    let embedded: EmbeddedInstance | null = null;

    if (instance.type === 'text') {
      embedded = { type: 'text', id: generateId(), originalId: instance.id, content: instance.content };
    } else if (instance.type === 'image') {
      embedded = { type: 'image', id: generateId(), originalId: instance.id, src: instance.src };
    } else if (instance.type === 'sketch') {
      embedded = { type: 'sketch', id: generateId(), originalId: instance.id };
    } else if (instance.type === 'table') {
      embedded = { type: 'table', id: generateId(), originalId: instance.id };
    }

    if (embedded) {
      setInstances(prev => prev.map(inst => {
        if (inst.id === editingTableId && inst.type === 'table') {
          const newCells = [...inst.cells];
          const cellIndex = newCells.findIndex(
            c => c.row === row && c.col === col
          );
          if (cellIndex >= 0) {
            newCells[cellIndex] = {
              ...newCells[cellIndex],
              content: [
                ...newCells[cellIndex].content,
                {
                  ...embedded!,
                  id: generateId()
                }
              ]
            };
          }
          return { ...inst, cells: newCells };
        }
        return inst;
      }));
    }
  }, [editingTableId, setInstances, instances]);

  // Remove content from table cell
  const removeCellContent = (row: number, col: number, contentIdx: number) => {
    setInstances(prev => prev.map(inst => {
      if (inst.id === editingTableId && inst.type === 'table') {
        const newCells = inst.cells.map(cell => {
          if (cell.row === row && cell.col === col) {
            // Remove by index
            const newContent = [...cell.content];
            newContent.splice(contentIdx, 1);
            return {
              ...cell,
              content: newContent
            };
          }
          return cell;
        });
        return { ...inst, cells: newCells };
      }
      return inst;
    }));
  };

  const TableGrid = useCallback(({ editingTableId }: {
    editingTableId: string | null;
  }) => {
    const table = instances.find(inst =>
      inst.id === editingTableId && inst.type === 'table'
    ) as TableInstance | undefined;

    if (!table) return null;

    const cellWidth = Math.max(50, Math.min(200, table.width / table.cols));
    const cellHeight = Math.max(50, Math.min(200, table.height / table.rows));

    return (
      <div className="table-grid-container">
        <div
          className="table-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${table.cols}, ${cellWidth}px)`,
            gridTemplateRows: `repeat(${table.rows}, ${cellHeight}px)`,
            border: '1px solid #ccc',
            width: 'fit-content'
          }}
        >
          {table.cells.map(cell => {
            const isDropTarget = draggingInstanceId !== null;

            return (
              <div
                key={`${cell.row}-${cell.col}`}
                className={`table-cell ${isDropTarget ? 'drop-zone' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.dataTransfer.dropEffect = 'copy';
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();

                  const instanceId = e.dataTransfer.getData('text/plain');
                  const draggedInstance = instances.find(inst => inst.id === instanceId);

                  if (draggedInstance) {
                    handleAddToTable(draggedInstance, cell.row, cell.col);
                  }
                  setDraggingInstanceId(null);
                }}
                style={{
                  border: '1px solid #ddd',
                  backgroundColor: 'white',
                  position: 'relative',
                  overflow: 'hidden',
                  padding: '4px',
                  cursor: 'pointer',
                }}
              >
                {cell.content.map((embedded, idx) => (
                  <div
                    key={embedded.id || idx}
                    className="embedded-instance"
                    style={{ width: '100%', height: '100%' }}
                  >
                    {embedded.type === 'text' && (
                      <p className="cell-text" style={{ margin: 0, fontSize: '12px' }}>
                        {embedded.content}
                      </p>
                    )}
                    {embedded.type === 'image' && (
                      <img
                        src={embedded.src}
                        alt="thumbnail"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain',
                          pointerEvents: 'none',
                        }}
                      />
                    )}
                    {embedded.type === 'sketch' && (
                      <div className="sketch-thumb-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16">
                          <path d="M4 4h16v16h-16v-16zm1 2v12h14v-12h-14zm12 9h-4v-2h4v-6h-6v-2h10v8h-2z" />
                        </svg>
                      </div>
                    )}
                    {embedded.type === 'table' && (
                      <div className="table-thumb-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16">
                          <path d="M4 8h16v12h-16v-12zm1 2v2h4v-2h-4zm5 0v2h4v-2h-4zm5 0v2h4v-2h-4zm-10 4v2h4v-2h-4zm5 0v2h4v-2h-4zm5 0v2h4v-2h-4zm-11-12v4h14v-4h-14z" />
                        </svg>
                      </div>
                    )}
                    <button
                      className="remove-cell-content"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeCellContent(cell.row, cell.col, idx);
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    );
  }, [instances, handleAddToTable]);

  const saveTable = () => {
    let newId = `Table${tableCount + 1}`;
    setTableCount(prev => prev + 1);
    const table = instances.find(inst => inst.id === editingTableId && inst.type === 'table') as TableInstance | undefined;
    if (!table) return;
    table.id = newId;
    setInstances(prev => prev.map(inst => inst.id === editingTableId ? table : inst));
    // Log the operation
    let withstr = "";
    if (table.cells.some(cell => cell.content.length > 0)) {
      withstr = table.cells.map(cell => {
        return cell.content.map(embedded => {
          if (embedded.type === 'text') {
            let text = embedded.content;
            let display = text.length > 10 ? text.slice(0, 10) + '...' : text;
            return `[${display}](#instance-${embedded.originalId || embedded.id})`;
          } else if (embedded.type === 'image') {
            return `[${embedded.originalId || embedded.id}](#instance-${embedded.originalId || embedded.id})`;
          } else if (embedded.type === 'sketch') {
            return `[${embedded.originalId || embedded.id}](#instance-${embedded.originalId || embedded.id})`;
          } else if (embedded.type === 'table') {
            return `[${embedded.originalId || embedded.id}](#instance-${embedded.originalId || embedded.id})`;
          }
          return '';
        }).filter(item => item != '').join(', ');
      }).filter(item => item != '').join(', ');
    }

    if (originalInstanceId) {
      onOperation(`Created [${newId}](#instance-${newId}) from [${originalInstanceId}](#instance-${originalInstanceId})` + (withstr ? ` with ${withstr}` : ''));
    } else {
      onOperation(`Created [${newId}](#instance-${newId})` + (withstr ? ` with ${withstr}` : ''));
    }
    setEditingTableId(null);
  };

  const cancelTableEdit = () => {
    if (!editingTableId) return;
    setInstances(prev => prev.filter(inst => inst.id !== editingTableId));
    setEditingTableId(null);
  };

  return (
    <div
      className="view-container instance-view"
    >
      {/* Trash Button */}
      {!editingSketchId && !showTrash && (
        <div className="trash-icon" onClick={() => setShowTrash(true)}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
            <path d="M3 6v18h18v-18h-18zm5 14c0 .552-.448 1-1 1s-1-.448-1-1v-10c0-.552.448-1 1-1s1 .448 1 1v10zm5 0c0 .552-.448 1-1 1s-1-.448-1-1v-10c0-.552.448-1 1-1s1 .448 1 1v10zm5 0c0 .552-.448 1-1 1s-1-.448-1-1v-10c0-.552.448-1 1-1s1 .448 1 1v10zm4-18h-8v-2h-2v2h-8v2h18v-2z" />
          </svg>
          {deletedInstances.length > 0 && (
            <span className="trash-count">{deletedInstances.length}</span>
          )}
        </div>
      )}

      {editingSketchId ? (
        // Sketch Editor
        <div className="sketch-editor">
          <div className="sketch-tools">
            <button
              className={`sketch-button ${currentMode === 'draw' ? 'active' : ''}`}
              onClick={() => setCurrentMode('draw')}
              disabled={currentMode === 'draw'}
            >
              Draw
            </button>
            <button
              className={`sketch-button ${currentMode === 'move' ? 'active' : ''}`}
              onClick={() => setCurrentMode('move')}
              disabled={currentMode === 'move'}
            >
              Move
            </button>

            <label>
              Color:
              <input
                type="color"
                value={sketchColor}
                onChange={e => setSketchColor(e.target.value)}
                style={{ marginLeft: '6px' }}
              />
            </label>
            <button onClick={handleSaveSketch}>Save Sketch</button>
            <button onClick={handleCancelSketch}>Cancel</button>
          </div>

          <div className="sketch-container" style={{ position: 'relative', backgroundColor: 'white' }}>
            <canvas
              ref={sketchCanvasRef}
              width={800}
              height={500}
              onMouseDown={currentMode === 'draw' ? startDrawing : undefined}
              onMouseMove={currentMode === 'draw' ? draw : undefined}
              onMouseUp={endDrawing}
              onMouseLeave={endDrawing}
              style={{
                position: 'relative',
                cursor: currentMode === 'draw' ? 'crosshair' : 'default',
                backgroundColor: 'transparent',
                pointerEvents: 'auto',
                zIndex: currentMode === 'draw' ? 20 : 10
              }}
            />

            {(instances.find(inst => inst.id === editingSketchId && inst.type === 'sketch') as SketchInstance | undefined)
              ?.content.filter((item): item is SketchItem & { type: 'instance' } => item.type === 'instance')
              .map(item => (
                <div
                  key={item.id}
                  className="embedded-instance"
                  style={{
                    position: 'absolute',
                    left: item.x,
                    top: item.y,
                    width: item.width,
                    height: item.height,
                    border: '1px dashed #999',
                    cursor: 'move',
                    pointerEvents: currentMode === 'move' ? 'auto' : 'none',
                    zIndex: currentMode === 'draw' ? 10 : 20
                  }}
                  onMouseDown={currentMode === 'move' ? (e) => handleEmbeddedMouseDown(e, item.id) : undefined}
                >
                  {item.instance.type === 'text' ? (
                    <p style={{ margin: 0, fontSize: '12px', userSelect: 'none', pointerEvents: 'none' }}>
                      {item.instance.content}
                    </p>
                  ) : item.instance.type === 'image' ? (
                    <img
                      src={item.instance.src}
                      alt="embedded"
                      style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none', userSelect: 'none' }}
                      draggable={false}
                    />
                  ) : null}

                  {/* Add resizers for embedded instance */}
                  {currentMode === 'move' && (
                    <>
                      <div
                        className="resizer top-left"
                        onMouseDown={e => handleEmbeddedResizerMouseDown(e, 'top-left', item.id)}
                      />
                      <div
                        className="resizer top-right"
                        onMouseDown={e => handleEmbeddedResizerMouseDown(e, 'top-right', item.id)}
                      />
                      <div
                        className="resizer bottom-right"
                        onMouseDown={e => handleEmbeddedResizerMouseDown(e, 'bottom-right', item.id)}
                      />
                      <div
                        className="resizer bottom-left"
                        onMouseDown={e => handleEmbeddedResizerMouseDown(e, 'bottom-left', item.id)}
                      />
                    </>
                  )}
                </div>
              ))
            }
          </div>

          <div className="available-instances">
            <h4 style={{ margin: 0 }}>Add to Sketch:</h4>
            <div className="instance-thumbs">
              {availableInstances.map(instance => (
                  <div
                    key={instance.id}
                    className="instance-thumb"
                    onClick={() => handleAddToSketch(instance)}
                  >
                    {instance.type === 'text' ? (
                      <p className="thumb-text">{instance.content.slice(0, 20)}{instance.content.length > 20 ? '...' : ''}</p>
                    ) : (
                      <img
                        src={(instance.type === 'image' ? instance.src : '')}
                        alt="thumb"
                        className="thumb-image"
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>
      ) : showTrash ? (
        // Trash View
        <>
          <div className="view-title-container">
            <h3 style={{ margin: 0 }}>Trash Bin ({deletedInstances.length})</h3>
            <button onClick={() => setShowTrash(false)}>Return</button>
          </div>

          <div className="view-content">
            {deletedInstances.length === 0 ? (
              <p className="empty-trash">Trash is empty</p>
            ) : (
              <div className="trash-list">
                {deletedInstances.map(instance => (
                  <div key={instance.id} className="trash-item">
                    <div className="trash-preview">
                      {instance.type === 'text' ? (
                        <p>{instance.content}</p>
                      ) : instance.type === 'image' ? (
                        <img
                          src={instance.src}
                          alt="deleted"
                          style={{ maxWidth: '100px', maxHeight: '100px' }}
                        />
                      ) : instance.type === 'sketch' ? (
                        <div className="sketch-preview">
                          {instance.thumbnail ? (
                            <img
                              src={instance.thumbnail}
                              alt="sketch preview"
                              style={{ width: '100px', height: '80px' }}
                            />
                          ) : (
                            <span>Sketch</span>
                          )}
                        </div>
                      ) : null}
                    </div>
                    <div className="trash-actions">
                      <button onClick={() => restoreInstance(instance.id)}>
                        Restore
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : editingTextId !== null ? (
        // Text Editor View
        <>
          <div className="view-title-container">
            <h3 style={{ margin: 0 }}>Edit Text</h3>
            <button onClick={handleSaveText}>Save</button>
            <button onClick={() => setEditingTextId(null)}>Cancel</button>
          </div>
          <div className="view-content">
            <textarea
              value={editingTextContent}
              onChange={(e) => setEditingTextContent(e.target.value)}
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        </>
      ) : editingTableId ? (
        // Table Editor View
        <div className="view-container">
          <div className="view-title-container">
            <h3 style={{ margin: 0 }}>Edit Table</h3>
            <button onClick={saveTable}>Save</button>
            <button onClick={cancelTableEdit}>Cancel</button>
          </div>
          <div className="table-container" style={{ margin: '2px 0', padding: '10px', backgroundColor: '#f5f5f5' }}>
            {/* <div style={{ marginBottom: '10px' }}>
              <strong>Click on a cell to select it, then click an instance below to add it</strong>
              <p>Or drag instances directly into cells</p>
            </div> */}
            {instances.find(inst => inst.id === editingTableId && inst.type === 'table') && (
              <TableGrid editingTableId={editingTableId}/>
            )}
          </div>

          <div className="available-instances">
            <h4 style={{ margin: '10px 0' }}>Add to Table:</h4>
            <div className="instance-thumbs">
              {availableInstances
                .map(instance => (
                  <div
                    key={instance.id}
                    className="instance-thumb"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', instance.id);
                      setDraggingInstanceId(instance.id);
                    }}
                  >
                    {instance.type === 'text' ? (
                      <p className="thumb-text">{instance.content.slice(0, 20)}{instance.content.length > 20 ? '...' : ''}</p>
                    ) : instance.type === 'image' ? (
                      <img
                        src={instance.src}
                        alt="thumb"
                        className="thumb-image"
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                      />
                    ) : instance.type === 'sketch' ? (
                      <div className="sketch-thumbnail">
                        {instance.thumbnail ? (
                          <img
                            src={instance.thumbnail}
                            alt="sketch"
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                          />
                        ) : (
                          <div className="sketch-thumb-placeholder" style={{ background: '#e0e0e0', height: '100%' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
                              <path d="M4 4h16v16h-16v-16zm14 14l-3.5-7-3.5 7h7zm-13 0v-12h12v12h-12zm3-9c-.552 0-1-.448-1-1s.448-1 1-1 1 .448 1 1-.448 1-1 1z" />
                            </svg>
                          </div>
                        )}
                      </div>
                    ) : instance.type === 'table' ? (
                      <div className="table-thumbnail" style={{ backgroundColor: '#eee', height: '100%', padding: '4px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                          {Array(2).fill(0).map((_, i) => (
                            <div key={i} style={{ display: 'flex', flex: 1 }}>
                              {Array(2).fill(0).map((_, j) => (
                                <div key={`${i}-${j}`} style={{ flex: 1, border: '1px solid #ccc' }}></div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
            </div>
          </div>
        </div>
      ) : (
        // Default Instance View
        <>
          <div className="view-title-container">
            <h3 style={{ margin: 0 }}>Instances</h3>
            <button onClick={handleCreateSketch}>
              Sketch
            </button>
            <button onClick={handleCaptureElement} disabled={!isCaptureEnabled}>
              Capture
            </button>
            <button onClick={handleCreateTable}>
              Table
            </button>
          </div>
          <div
            className="view-content"
            style={{
              overflow: 'hidden',
              userSelect: isPanning || draggingInstanceId ? 'none' : 'auto'
            }}
            onClick={handleCanvasClick}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onPaste={handlePaste}
            tabIndex={0}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            ref={containerRef}
          >
            <div
              style={{
                width: 800,
                height: 400,
                cursor: isPanning ? 'grabbing' : 'grab',
                touchAction: 'none',
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: '0 0',
                position: 'relative',
                top: 0,
                left: 0,
              }}
            >
              {instances.map(instance => (
                <div
                  key={instance.id}
                  id={`instance-${instance.id}`}
                  className="instance-block"
                  style={{
                    position: 'absolute',
                    left: Number.isFinite(instance.x) ? instance.x : 0,
                    top: Number.isFinite(instance.y) ? instance.y : 0,
                    width: instance.width,
                    height: instance.height,
                    cursor: draggingInstanceId === instance.id ? 'grabbing' : 'grab',
                    userSelect: 'none',
                    maxWidth: '200px',
                    wordBreak: 'break-word',
                    background: 'white',
                    borderRadius: '4px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    zIndex: draggingInstanceId === instance.id ? 1000 : 'auto',
                    padding: '4px'
                  }}
                  onMouseDown={e => handleInstanceMouseDown(e, instance.id)}
                  onDoubleClick={e => handleInstanceDoubleClick(instance)}
                >
                  {instance.type === 'text' ? (
                    <p style={{ margin: 0, userSelect: 'none', overflow: 'hidden', height: '100%', width: '100%' }}>
                      {instance.content}
                    </p>
                  ) : instance.type === 'image' ? (
                    <img
                      src={(instance.type === 'image' ? instance.src : '')}
                      alt="instance"
                      className="instance-image"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        display: 'block',
                        pointerEvents: 'none',
                      }}
                    />
                  ) : instance.type === 'sketch' ? (
                    <div className="sketch-thumbnail">
                      {instance.thumbnail ? (
                        <img
                          src={instance.thumbnail}
                          alt="sketch"
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain'
                          }}
                          draggable={false}
                        />
                      ) : (
                        <div style={{
                          width: '100%',
                          height: '100%',
                          background: '#eee',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          color: '#666'
                        }}>
                          <span>Empty Sketch</span>
                        </div>
                      )}
                    </div>
                  ) : instance.type === 'table' ? (
                    <div
                      style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        display: 'grid',
                        gridTemplateRows: `repeat(${instance.rows}, 1fr)`,
                        gridTemplateColumns: `repeat(${instance.cols}, 1fr)`,
                        gap: '1px',
                        border: '1px solid #ccc',
                        boxSizing: 'border-box',
                      }}
                    >
                      {instance.cells.map(cell => (
                        <div
                          key={`${cell.row}-${cell.col}`}
                          style={{
                            border: '1px solid #ddd',
                            padding: '2px',
                            boxSizing: 'border-box',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px',
                          }}
                        >
                          {cell.content.length > 0 ? (
                            cell.content.map(embedded => {
                              if (embedded.type === 'text') {
                                return (
                                  <p
                                    key={embedded.id}
                                    style={{
                                      margin: 0,
                                      fontSize: '10px',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {embedded.content.length > 10
                                      ? `${embedded.content.slice(0, 10)}...`
                                      : embedded.content}
                                  </p>
                                );
                              } else if (embedded.type === 'image') {
                                return (
                                  <img
                                    key={embedded.id}
                                    src={embedded.src}
                                    alt="thumbnail"
                                    style={{
                                      maxWidth: '100%',
                                      maxHeight: '100%',
                                      objectFit: 'contain',
                                      pointerEvents: 'none',
                                    }}
                                  />
                                );
                              } else if (embedded.type === 'sketch') {
                                return (
                                  <div
                                    key={embedded.id}
                                    style={{
                                      width: '100%',
                                      height: '100%',
                                      background: '#eee',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                  >
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      viewBox="0 0 24 24"
                                      width="16"
                                      height="16"
                                    >
                                      <path d="M4 4h16v16h-16v-16zm1 2v12h14v-12h-14zm12 9h-4v-2h4v-6h-6v-2h10v8h-2z" />
                                    </svg>
                                  </div>
                                );
                              } else if (embedded.type === 'table') {
                                return (
                                  <div
                                    key={embedded.id}
                                    style={{
                                      width: '100%',
                                      height: '100%',
                                      background: '#eee',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                  >
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      viewBox="0 0 24 24"
                                      width="16"
                                      height="16"
                                    >
                                      <path d="M4 8h16v12h-16v-12zm1 2v2h4v-2h-4zm5 0v2h4v-2h-4zm5 0v2h4v-2h-4zm-10 4v2h4v-2h-4zm5 0v2h4v-2h-4zm5 0v2h4v-2h-4z" />
                                    </svg>
                                  </div>
                                );
                              }
                              return null;
                            })
                          ) : (
                            <div
                              style={{
                                width: '100%',
                                height: '100%',
                                background: '#f0f0f0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#aaa',
                                fontSize: '8px',
                              }}
                            >
                              Empty
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {selectedInstanceId === instance.id && (
                    <>
                      <div
                        className="resizer"
                        data-direction="top-left"
                        onMouseDown={handleResizerMouseDown('top-left', instance.id)}
                      />
                      <div
                        className="resizer"
                        data-direction="top-right"
                        onMouseDown={handleResizerMouseDown('top-right', instance.id)}
                      />
                      <div
                        className="resizer"
                        data-direction="bottom-right"
                        onMouseDown={handleResizerMouseDown('bottom-right', instance.id)}
                      />
                      <div
                        className="resizer"
                        data-direction="bottom-left"
                        onMouseDown={handleResizerMouseDown('bottom-left', instance.id)}
                      />
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default InstanceView;