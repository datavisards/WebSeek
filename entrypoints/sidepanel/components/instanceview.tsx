import { browser, type Browser } from 'wxt/browser';

import React, { useState, useRef, useEffect } from 'react';
import './instanceview.css';

// Define types for embedded instances and sketch items
type EmbeddedInstance =
  | { type: 'text'; content: string }
  | { type: 'image'; src: string };

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

// Define the Instance type for text, image, and sketch
type Instance =
  | {
    id: string;
    type: 'text';
    content: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }
  | {
    id: string;
    type: 'image';
    src: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }
  | {
    id: string;
    type: 'sketch';
    x: number;
    y: number;
    width: number;
    height: number;
    content: SketchItem[];
    thumbnail: string;
  };

// Props interface for the component
interface InstanceViewProps {
  onOperation: (message: string) => void;
}

const InstanceView = ({ onOperation }: InstanceViewProps) => {
  const [instances, setInstances] = useState<Instance[]>([]);
  // Counters for different instance types
  const [textCount, setTextCount] = useState(0);
  const [imageCount, setImageCount] = useState(0);
  const [sketchCount, setSketchCount] = useState(0);
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
        const newId = `Text${textCount + 1}`;
        setTextCount(prev => prev + 1);
        onOperation(`Created [${newId}](#instance-${newId})`);
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
          const newId = `Text${textCount + 1}`;
          setTextCount(prev => prev + 1);
          onOperation(`Created [${newId}](#instance-${newId})`);
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
      embedded = { type: 'text', content: instance.content };
    } else if (instance.type === 'image') {
      embedded = { type: 'image', src: instance.src };
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
    ) as Extract<Instance, { type: 'sketch' }> | undefined;

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
        tempCtx.fillStyle = '#000';
        tempCtx.font = '12px sans-serif';
        tempCtx.fillText(item.instance.content, item.x, item.y + 15);
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

    setCurrentStroke(null);
    setEditingSketchId(null);
    onOperation(`Created [${sketch.id}](#instance-${sketch.id})`);
  };

  // Cancel sketch creation
  const handleCancelSketch = () => {
    setInstances(prev => prev.filter(inst => inst.id !== editingSketchId)); // Remove empty sketch
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
    ) as Extract<Instance, { type: 'sketch' }> | undefined;

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
      const newId = `Text${textCount + 1}`;
      setTextCount(prev => prev + 1);
      onOperation(`Created [${newId}](#instance-${newId}) from [${message.pageId}](${message.pageURL})`);
      setInstances(prev => [
        ...prev,
        {
          id: newId,
          type: 'text',
          content: message.data,
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
      if (e.key === 'Escape') {
        if (!isCaptureEnabled && bgPort.current) {
          bgPort.current.postMessage({ action: 'exit_selection' });
        }
        setSelectedInstanceId(null);
        setDraggingInstanceId(null);
        setDraggingEmbeddedId(null);
        setIsCaptureEnabled(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCaptureEnabled]);

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

  return (
    <div
      className="view-container instance-view"
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
      style={{ overflow: 'hidden', userSelect: isPanning || draggingInstanceId ? 'none' : 'auto' }}
    >
      {editingSketchId ? (
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

            {(instances.find(inst => inst.id === editingSketchId && inst.type === 'sketch') as Extract<Instance, { type: 'sketch' }> | undefined)
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
                    <p style={{ margin: 0, fontSize: '12px', userSelect: 'none' }}>{item.instance.content}</p>
                  ) : (
                    <img
                      src={item.instance.src}
                      alt="embedded"
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      draggable={false}
                    />
                  )}
                </div>
              ))
            }
          </div>

          <div className="available-instances">
            <h4 style={{ margin: 0 }}>Add to Sketch:</h4>
            <div className="instance-thumbs">
              {instances
                .filter(inst => inst.id !== editingSketchId && inst.type !== 'sketch')
                .map(instance => (
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
      ) : (
        <>
          <div className="view-title-container">
            <h3 style={{ margin: 0 }}>Instances</h3>
            <button onClick={handleCreateSketch}>
              Sketch
            </button>
            <button onClick={handleCaptureElement} disabled={!isCaptureEnabled}>
              Capture
            </button>
          </div>
          <div
            className="view-content"
            style={{
              position: 'relative',
              width: 800,
              height: 400,
              overflow: 'hidden',
              cursor: isPanning ? 'grabbing' : 'grab',
              touchAction: 'none',
            }}
            onClick={handleCanvasClick}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: '0 0',
                position: 'absolute',
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
                    padding: '4px',
                    borderRadius: '4px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    zIndex: draggingInstanceId === instance.id ? 1000 : 'auto',
                  }}
                  onMouseDown={e => handleInstanceMouseDown(e, instance.id)}
                  onDoubleClick={() => {
                    if (instance.type === 'sketch') {
                      setEditingSketchId(instance.id);
                      setAvailableInstances(instances.filter(i => i.id !== instance.id));
                    }
                  }}
                >
                  {instance.type === 'text' ? (
                    <p style={{ margin: 0, userSelect: 'none' }}>
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
                  ) : (
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
                  )}
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