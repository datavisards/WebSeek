import { browser, type Browser } from 'wxt/browser';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Instance, EmbeddedInstance, SketchItem, TextInstance, ImageInstance, SketchInstance, TableInstance } from '../types';
import TextEditor from './texteditor';
import SketchEditor from './sketcheditor';
import TrashView from './trashview';
import TableEditor from './tableeditor';
import './instanceview.css';

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
  const [sketchResizingItemId, setSketchResizingItemId] = useState<string | null>(null);
  const [sketchResizeDirection, setSketchResizeDirection] = useState<string | null>(null);
  const sketchResizerStart = useRef<{
    clientX: number;
    clientY: number;
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
  };

  const handleEmbeddedMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
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
      const rect = sketchCanvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const dx = event.clientX - sketchResizerStart.current.clientX;
      const dy = event.clientY - sketchResizerStart.current.clientY;

      let newX = sketchResizerStart.current.instanceX;
      let newY = sketchResizerStart.current.instanceY;
      let newWidth = sketchResizerStart.current.instanceWidth;
      let newHeight = sketchResizerStart.current.instanceHeight;

      switch (sketchResizeDirection) {
        case 'top-left':
          newX += dx;
          newY += dy;
          newWidth = Math.max(10, newWidth - dx);
          newHeight = Math.max(10, newHeight - dy);
          break;
        case 'top-right':
          newY += dy;
          newWidth = Math.max(10, newWidth + dx);
          newHeight = Math.max(10, newHeight - dy);
          break;
        case 'bottom-right':
          newWidth = Math.max(10, newWidth + dx);
          newHeight = Math.max(10, newHeight + dy);
          break;
        case 'bottom-left':
          newX += dx;
          newWidth = Math.max(10, newWidth - dx);
          newHeight = Math.max(10, newHeight + dy);
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
  }

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
  };

  const handleEmbeddedMouseUp = (event: React.MouseEvent<HTMLDivElement>) => {
    console.log("handleEmbeddedMouseUp called", event);
    setDraggingEmbeddedId(null);
    dragEmbeddedStart.current = null;
    setSketchResizingItemId(null);
    setSketchResizeDirection(null);
    sketchResizerStart.current = null;
  }

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
    setAvailableInstances(prev => instances.filter(inst => inst.type !== 'sketch'));
    setEditingSketchId(newSketch.id);
  };

  // Add an instance to the sketch
  const handleAddToSketch = (instance: Instance) => {
    if (!editingSketchId) return;

    let embedded: EmbeddedInstance | null = null;

    if (instance.type === 'text') {
      embedded = { type: 'text', id: generateId(), originalId: instance.id, content: instance.content };
    } else if (instance.type === 'image') {
      embedded = { type: 'image', id: generateId(), originalId: instance.id, src: instance.src };
    } else if (instance.type === 'table') {
      // Create a full TableInstance with rows, cols, and cells
      const tableInstance = instance as TableInstance;
      embedded = {
        type: 'table',
        id: generateId(),
        originalId: instance.id,
        rows: tableInstance.rows,
        cols: tableInstance.cols,
        cells: tableInstance.cells.map(cell => ({
          ...cell,
          content: cell.content ? { ...cell.content, id: generateId() } : null
        })),
        x: 50,
        y: 50,
        width: instance.width,
        height: instance.height
      };
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
      else if (item.type === 'instance' && item.instance.type === 'table') {
        const table = item.instance;
        const cellWidth = item.width / table.cols;
        const cellHeight = item.height / table.rows;

        for (let r = 0; r < table.rows; r++) {
          for (let c = 0; c < table.cols; c++) {
            const cell = table.cells.find(cell => cell.row === r && cell.col === c);
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
            if (cell.content) {
              const content = cell.content;
              if (content.type === 'text') {
                tempCtx.fillStyle = '#000';
                tempCtx.font = '10px sans-serif';
                const lines = wrapTextForThumbnail(
                  tempCtx,
                  content.content,
                  cellWidth - 4,
                  cellHeight - 4
                );
                lines.forEach((line, i) => {
                  tempCtx.fillText(
                    line,
                    item.x + c * cellWidth + 2,
                    item.y + r * cellHeight + 10 + (i * 12)
                  );
                });
              } else if (content.type === 'image') {
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

    // Log the operation
    let withstr = sketch.content
      .filter(item => item.type === 'instance')
      .map(item => {
        if (item.instance.type === 'text') {
          let text = item.instance.content;
          let display = text.length > 10 ? text.slice(0, 10) + '...' : text;
          return `[${display}](#instance-${item.instance.originalId || item.id})`;
        } else {
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
    setInstances(prev => prev.filter(inst => inst.id !== editingSketchId));
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
      let newId = `Sketch${sketchCount + 1}`;
      setSketchCount(prev => prev + 1);
      let newSketch: Instance = {
        id: newId,
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
      setAvailableInstances(prev => prev.filter(inst => inst.id !== instance.id && inst.type !== 'sketch'));
    } else if (instance.type === 'table') {
      let newTable = structuredClone(instance) as TableInstance;
      newTable.id = generateId();
      newTable.cells = newTable.cells.map(cell => ({
        ...cell,
        content: cell.content ? {
          ...cell.content,
          id: generateId(),
          originalId: cell.content.originalId
        } : null
      }));
      setInstances(prev => [...prev, newTable]);
      setAvailableInstances(instances.filter(inst => inst.type !== 'table' && inst.type !== 'sketch'));
      setEditingTableId(newTable.id);
    }
  }

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

    const rect = sketchCanvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    sketchResizerStart.current = {
      clientX: e.clientX,
      clientY: e.clientY,
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
        cells.push({ row: r, col: c, content: null });
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
    setAvailableInstances(instances.filter(inst => inst.type !== 'table' && inst.type !== 'sketch'));
  };

  // Handle adding to table cell (for both click and drag-and-drop)
  const handleAddToTable = useCallback((instance: Instance, row: number, col: number) => {
    if (!editingTableId) return;
    console.log("Adding to table cell", instance, row, col);

    let embedded: EmbeddedInstance | null = null;

    if (instance.type === 'text') {
      embedded = { type: 'text', id: generateId(), originalId: instance.id, content: instance.content };
    } else if (instance.type === 'image') {
      embedded = { type: 'image', id: generateId(), originalId: instance.id, src: instance.src };
    } else if (instance.type === 'sketch') {
      // embedded = { type: 'sketch', id: generateId(), originalId: instance.id };
      console.error("Cannot embed a sketch inside a table");
      return;
    } else if (instance.type === 'table') {
      // embedded = { type: 'table', id: generateId(), originalId: instance.id };
      console.error("Cannot embed a table inside another table");
      return;
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
              content: { // Note: the current cell content is replaced
                ...embedded!,
                id: generateId()
              }

            };
          }
          return { ...inst, cells: newCells };
        }
        return inst;
      }));
    }
  }, [editingTableId, setInstances, instances]);

  // Remove content from table cell
  const removeCellContent = (row: number, col: number) => {

  };

  const saveTable = () => {
    let newId = `Table${tableCount + 1}`;
    setTableCount(prev => prev + 1);
    const table = instances.find(inst => inst.id === editingTableId && inst.type === 'table') as TableInstance | undefined;
    if (!table) return;
    table.id = newId;
    setInstances(prev => prev.map(inst => inst.id === editingTableId ? table : inst));
    // Log the operation
    let withstr = "";
    if (table.cells.some(cell => cell.content != null)) {
      withstr = table.cells.map(cell => {
        let embedded = cell.content;
        if (!embedded || embedded.id.startsWith('_')) return '';
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
        <SketchEditor
          ref={sketchCanvasRef}
          editingSketchId={editingSketchId}
          instances={instances}
          setInstances={setInstances}
          sketchColor={sketchColor}
          setSketchColor={setSketchColor}
          currentMode={currentMode}
          setCurrentMode={setCurrentMode}
          currentStroke={currentStroke}
          setCurrentStroke={setCurrentStroke}
          onSaveSketch={handleSaveSketch}
          onCancelSketch={handleCancelSketch}
          onAddToSketch={handleAddToSketch}
          availableInstances={availableInstances}
          handleEmbeddedMouseDown={handleEmbeddedMouseDown}
          handleEmbeddedResizerMouseDown={handleEmbeddedResizerMouseDown}
          handleEmbeddedMouseMove={handleEmbeddedMouseMove}
          handleEmbeddedMouseUp={handleEmbeddedMouseUp}
          draggingEmbeddedId={draggingEmbeddedId}
        />
      ) : showTrash ? (
        // Trash View
        <TrashView
          deletedInstances={deletedInstances}
          onRestore={restoreInstance}
          onClose={() => setShowTrash(false)}
        />
      ) : editingTextId !== null ? (
        // Text Editor View
        <TextEditor
          editingTextContent={editingTextContent}
          onSave={handleSaveText}
          onCancel={() => setEditingTextId(null)}
        />
      ) : editingTableId ? (
        // Table Editor View
        <TableEditor
          tableId={editingTableId}
          instances={instances}
          onSaveTable={saveTable}
          onCancel={cancelTableEdit}
          onAddToTable={handleAddToTable}
          onRemoveCellContent={removeCellContent}
          onEditCellContent={(row: number, col: number, value: string) => { value.length > 0 ? handleAddToTable({ type: 'text', id: generateId(), content: value } as TextInstance, row, col) : removeCellContent(row, col) }}
          draggingInstanceId={draggingInstanceId}
          setDraggingInstanceId={setDraggingInstanceId}
          availableInstances={availableInstances}
        />
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
                          {!cell.content ? (
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
                            </div>) :
                            cell.content.type === 'text' ? (
                              <p
                                key={cell.content.id}
                                style={{
                                  margin: 0,
                                  fontSize: '10px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {cell.content.content.length > 10
                                  ? `${cell.content.content.slice(0, 10)}...`
                                  : cell.content.content}
                              </p>
                            )
                              : cell.content.type === 'image' ?
                                (
                                  <img
                                    key={cell.content.id}
                                    src={cell.content.src}
                                    alt="thumbnail"
                                    style={{
                                      maxWidth: '100%',
                                      maxHeight: '100%',
                                      objectFit: 'contain',
                                      pointerEvents: 'none',
                                    }}
                                  />
                                ) : null}
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