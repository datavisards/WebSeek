import { browser, type Browser } from 'wxt/browser';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Instance, EmbeddedInstance, SketchItem, TextInstance, SketchInstance, TableInstance, Message } from '../types';
import { getInstanceGeometry, generateInstanceContext, generateId, createSketchThumbnail, updateInstances } from '../utils';
import TextEditor from './texteditor';
import SketchEditor from './sketcheditor';
import TrashView from './trashview';
import TableEditor from './tableeditor';
import RenameModal from './renamemodal';
import VisualizationEditor from './visualizationeditor';
import InstanceViewHeader from './InstanceViewHeader';
import InstanceContextMenu from './InstanceContextMenu';
import GhostInstance from './GhostInstance';
import { createEmbeddedTextInstance, createEmbeddedImageInstance, createManualSource } from './instanceview-utils';
import { useHTMLContent } from './useHTMLContent';
import { useInputHandlers } from './useInputHandlers';
import './instanceview.css';
import { message } from 'vega-lite/types_unstable/log/index.js';
import { chatWithAgent } from '../api-selector';
import { ProactiveSuggestion } from '../types';
import { proactiveService } from '../proactive-service';

// Props interface for the component
interface InstanceViewProps {
  instances: Instance[];
  setInstances: React.Dispatch<React.SetStateAction<Instance[]>>;
  logs: string[];
  htmlContext: Record<string, {pageURL: string, htmlContent: string}>;
  messages: Message[];
  onOperation: (message: string, trigger?: boolean) => void;
  updateHTMLContext: React.Dispatch<React.SetStateAction<Record<string, {pageURL: string, htmlContent: string}>>>;
  addMessage: (message: Message) => void;
  setAgentLoading: (loading: boolean) => void;
  currentSuggestion?: ProactiveSuggestion; // For ghost preview rendering
}

const InstanceView = ({ instances, setInstances, logs, htmlContext, messages, onOperation, updateHTMLContext, addMessage, setAgentLoading, currentSuggestion }: InstanceViewProps) => {
  // Custom hooks
  const { fetchHTMLContent } = useHTMLContent(updateHTMLContext);
  const instancesRef = useRef<Instance[]>([]);
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
  // Instance context menu state
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    instanceIds: string[];
    position: { x: number; y: number };
    multi: boolean;
  }>({
    visible: false,
    instanceIds: [],
    position: { x: 0, y: 0 },
    multi: false
  });
  const [renamingInstance, setRenamingInstance] = useState<Instance | null>(null);
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
  const [captureTarget, setCaptureTarget] = useState<{ tableId: string, row: number, col: number } | null>(null);
  const captureTargetRef = useRef<{ tableId: string, row: number, col: number } | null>(null);
  // Selection mode state
  const [mode, setMode] = useState<'hand' | 'select'>('hand');
  const [selectedInstanceIds, setSelectedInstanceIds] = useState<string[]>([]);
  const [selectionBox, setSelectionBox] = useState<null | { startX: number; startY: number; endX: number; endY: number }>(null);
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null);
  // Add state for dropdowns at the top of the component
  const [webToolsOpen, setWebToolsOpen] = useState(false);
  const [instanceToolsOpen, setInstanceToolsOpen] = useState(false);
  // Add state for visualization editor
  const [editingVisualizationSpec, setEditingVisualizationSpec] = useState<object | string | null>(null);

  // Input handlers hook
  const { handleDrop, handlePaste, handleDragOver } = useInputHandlers({
    instances,
    setInstances,
    onOperation,
    setImageCount,
    imageCountRef,
    setTextCount,
    textCountRef,
  });

  // Update the latest state values
  useEffect(() => {
    textCountRef.current = textCount;
    imageCountRef.current = imageCount;
    sketchCountRef.current = sketchCount;
    tableCountRef.current = tableCount;
    instancesRef.current = instances;
    selectedInstanceIdRef.current = selectedInstanceId;
    deletedInstancesRef.current = deletedInstances;
    captureTargetRef.current = captureTarget;
  }, [textCount, imageCount, sketchCount, tableCount, instances, selectedInstanceId, deletedInstances, captureTarget]);

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
    console.log("handleCanvasClick called", event, isOnInstance);

    if (!isOnInstance) {
      setIsResizing(false);
      setSelectedInstanceId(null);
      closeContextMenu();
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
      instanceX: getInstanceGeometry(instance).x,
      instanceY: getInstanceGeometry(instance).y,
      offsetX: canvasX - getInstanceGeometry(instance).x,
      offsetY: canvasY - getInstanceGeometry(instance).y,
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
      instanceWidth: getInstanceGeometry(instance).width,
      instanceHeight: getInstanceGeometry(instance).height,
      instanceX: getInstanceGeometry(instance).x,
      instanceY: getInstanceGeometry(instance).y,
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
      source: createManualSource(),
      x: 0,
      y: 0,
      width: 400,
      height: 300,
      content: [],
      thumbnail: ''
    };
    setInstances(prev => [...prev, newSketch]);
    setAvailableInstances(instances.filter(inst => inst.type !== 'sketch'));
    setEditingSketchId(newSketch.id);
    onOperation(`Open sketch editor to create a new sketch "${newId}"`, false);
  };

  // Add an instance to the sketch
  const handleAddToSketch = (instance: Instance) => {
    if (!editingSketchId) return;

    let embedded: EmbeddedInstance | null = null;

    if (instance.type === 'text') {
      embedded = createEmbeddedTextInstance(instance.content, instance.id);
    } else if (instance.type === 'image') {
      embedded = createEmbeddedImageInstance(instance.src, instance.id);
    } else if (instance.type === 'table') {
      // Create a full TableInstance with rows, cols, and cells
      const tableInstance = instance as TableInstance;
      embedded = {
        type: 'table',
        id: generateId(),
        source: createManualSource(),
        originalId: instance.id,
        rows: tableInstance.rows,
        cols: tableInstance.cols,
        cells: tableInstance.cells.map(rowArr => rowArr.map(cell => cell ? { ...cell, id: generateId() } : null)),
        x: 50,
        y: 50,
        width: getInstanceGeometry(instance).width,
        height: getInstanceGeometry(instance).height
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
            width: getInstanceGeometry(instance).width,
            height: getInstanceGeometry(instance).height
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
    const sketch = instances.find(inst =>
      inst.id === editingSketchId && inst.type === 'sketch'
    ) as SketchInstance | undefined;
    if (!sketch) return;
    const thumbnail = await createSketchThumbnail(
      sketch,
      currentStroke,
      sketchColor,
      sketchWidth,
      wrapTextForThumbnail,
      canvas.width,
      canvas.height
    );
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
          return `[${text}](#instance-${item.instance.originalId || item.id})`;
        } else {
          return `[${item.instance.originalId || item.id}](#instance-${item.instance.originalId || item.id})`;
        }
      })
      .join(', ');
    onOperation(`Created [${sketch.id}](#instance-${sketch.id})` + (originalInstanceId ? ` from [${originalInstanceId}](#instance-${originalInstanceId})` : '') + (withstr ? ` with ${withstr}` : ''), false);
    setCurrentStroke(null);
    setEditingSketchId(null);
  };

  // Cancel sketch creation
  const handleCancelSketch = () => {
    if (!editingSketchId) return;
    onOperation(`Cancel sketch creation for "${editingSketchId}"`, false);
    setInstances(prev => prev.filter(inst => inst.id !== editingSketchId));
    setEditingSketchId(null);
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
      // Handle HTML content via pageId - fetch asynchronously
      if (msg.pageURL && msg.pageId) {
        fetchHTMLContent(msg.pageId, msg.pageURL);
      }

      // Handle messages (msg.action, etc.)
      if (msg.action === 'element_selected') {
        handleElementSelected(msg);
      } else if (msg.action === 'snapshot_ready') {
        // Handle snapshot completion - this is when real pageId becomes available
        if (msg.pageId && msg.url) {
          console.log('Snapshot ready, real pageId available:', msg.pageId);
          
          // Fetch HTML content for the pageId
          fetchHTMLContent(msg.pageId, msg.url);
        }
      } else if (msg.action === 'screenshot_finished') {
        handleScreenshotFinished(msg);
      } else if (msg.action === 'selection_canceled') {
        console.log("Element selection canceled");
        setCaptureTarget(null);
        setIsCaptureEnabled(true);
      } else if (msg.action === 'exit_selection') {
        setSelectedInstanceId(null);
        setDraggingInstanceId(null);
        setDraggingEmbeddedId(null);
        setCaptureTarget(null);
      }
    });

    return () => port.disconnect();
  }, []);

  const handleElementSelected = (message: any) => {
    console.log("Element selected:", message, captureTargetRef.current);
    // Check if this is a table cell capture
    if (captureTargetRef.current) {
      handleTableCellCapture(message);
      return;
    }

    const rect = containerRef.current?.getBoundingClientRect();
    const x = rect ? rect.width / 2 : 0;
    const y = rect ? rect.height / 2 : 0;

    if (message.type === 'text') {
      const text = message.data;
      const newId = `Text${textCountRef.current + 1}`;
      setTextCount(prev => prev + 1);
      onOperation(`Created [${text}](#instance-${newId}) from [${message.pageId}](${message.pageURL})`);
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
          source: message.source || {
            type: 'web',
            pageId: message.pageId,
            locator: message.locator || 'unknown'
          },
        }
      ]);
    } else if (message.type === 'image') {
      const newId = `Image${imageCountRef.current + 1}`;
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
          source: message.source || {
            type: 'web',
            pageId: message.pageId,
            locator: message.locator || 'unknown'
          },
        }
      ]);
    }
    setIsCaptureEnabled(true);
  };

  // Handle captured content for table cells
  const handleTableCellCapture = (message: any) => {
    if (!captureTargetRef.current) return;

    const { tableId, row, col } = captureTargetRef.current;
    console.log("Table ID:", tableId, "Row:", row, "Col:", col, "Instances:", instancesRef.current);
    const table = instancesRef.current.find(inst => inst.id === tableId && inst.type === 'table') as TableInstance | undefined;

    if (!table) {
      console.error('Table not found for capture target');
      setCaptureTarget(null);
      setIsCaptureEnabled(true);
      return;
    }

    const currentContent = table.cells[row][col];

    // Handle different content types
    if (message.type === 'text') {
      const newText = message.data;

      // If cell is empty or contains text, append the new text
      if (!currentContent || currentContent.type === 'text') {
        const combinedText = currentContent
          ? `${currentContent.content} ${newText}`
          : newText;

        // Create embedded text instance with web source
        const embeddedText: EmbeddedInstance = {
          type: 'text',
          id: generateId(),
          source: message.source || {
            type: 'web',
            pageId: message.pageId,
            locator: message.locator || 'unknown'
          },
          content: combinedText
        };

        // Update the table
        setInstances(prev => prev.map(inst => {
          if (inst.id === tableId && inst.type === 'table') {
            const newCells = [...inst.cells];
            newCells[row][col] = embeddedText;
            return { ...inst, cells: newCells };
          }
          return inst;
        }));

        onOperation(`Appended text to cell (${row + 1}, ${String.fromCharCode(65 + col)}) from [${message.pageId}](${message.pageURL})`);
      } else {
        alert('Cannot append text to a cell containing non-text content. Please remove the existing content first.');
      }
    } else if (message.type === 'image') {
      // Only allow images in empty cells
      if (!currentContent) {
        const embeddedImage: EmbeddedInstance = {
          type: 'image',
          id: generateId(),
          source: message.source || {
            type: 'web',
            pageId: message.pageId,
            locator: message.locator || 'unknown'
          },
          src: message.data
        };

        // Update the table
        setInstances(prev => prev.map(inst => {
          if (inst.id === tableId && inst.type === 'table') {
            const newCells = [...inst.cells];
            newCells[row][col] = embeddedImage;
            return { ...inst, cells: newCells };
          }
          return inst;
        }));

        onOperation(`Added image to cell (${row + 1}, ${String.fromCharCode(65 + col)}) from [${message.pageId}](${message.pageURL})`);
      } else {
        alert('Cannot add image to a cell that already contains content. Please remove the existing content first.');
      }
    }

    // Clear capture target and re-enable capture
    setCaptureTarget(null);
    setIsCaptureEnabled(true);
  };

  const handleScreenshotFinished = (message: any) => {
    const newId = `Image${imageCountRef.current + 1}`;
    setImageCount(prev => prev + 1);
    onOperation(`Created [${newId}](#instance-${newId}) from [${message.pageId}](${message.pageURL})`);
    setInstances(prev => [
      ...prev,
      {
        id: newId,
        type: 'image',
        src: message.data,
        x: 0,
        y: 0,
        width: message.dimensions.width,
        height: message.dimensions.height,
        source: message.source || {
          type: 'web',
          pageId: message.pageId,
          locator: message.locator || 'unknown'
        },
      }
    ]);
    setIsCaptureEnabled(true);
  }

  // Delete selected instance
  const deleteSelectedInstance = useCallback(() => {
    const instanceId = selectedInstanceIdRef.current;
    if (!instanceId) return;

    const instanceToDelete = instancesRef.current.find(inst => inst.id === instanceId);
    if (!instanceToDelete) return;

    onOperation(`Delete ${instanceToDelete.type} "${instanceId}"`);
    // Set all state updates together
    setInstances(prev => prev.filter(inst => inst.id !== instanceId));
    setDeletedInstances(prev => [...prev, instanceToDelete]);
    setSelectedInstanceId(null);
  }, []);

  const handleDelete = useCallback((instance: Instance) => {
    setInstances(prev => prev.filter(inst => inst.id !== instance.id));
    setDeletedInstances(prev => [...prev, instance]);
    if (selectedInstanceId === instance.id) {
      setSelectedInstanceId(null);
    }
  }, [selectedInstanceId]);

  // Restore an instance from trash
  const restoreInstance = useCallback((instanceId: string) => {
    const instanceToRestore = deletedInstancesRef.current.find(inst => inst.id === instanceId);
    if (!instanceToRestore) return;

    onOperation(`Restore ${instanceToRestore.type} "${instanceId}" from trash`);
    // Update states
    setDeletedInstances(prev => prev.filter(inst => inst.id !== instanceId));
    setInstances(prev => [...prev, instanceToRestore]);
  }, []);

  const handleCaptureStart = () => {
    // send message via the background port
    if (bgPort.current) {
      console.log("Sending message to start element selection", bgPort.current);
      bgPort.current.postMessage({ action: 'start_element_selection' });
      setIsCaptureEnabled(false);
    }
  };

  const handleScreenshotStart = () => {
    if (bgPort.current) {
      console.log("Sending message to start screenshot capture", bgPort.current);
      bgPort.current.postMessage({ action: 'start_screenshot_capture' });
      setIsCaptureEnabled(false);
    }
  }

  // Add keyboard escape handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      console.log("Key pressed:", e.key);
      if (e.key === 'Escape') {
        if (!isCaptureEnabled || selectedInstanceIdRef.current || editingSketchId) {
          e.preventDefault();
          if (!isCaptureEnabled && bgPort.current) {
            bgPort.current.postMessage({ action: 'exit_selection' });
          }
          setSelectedInstanceId(null);
          setDraggingInstanceId(null);
          setDraggingEmbeddedId(null);
          setCaptureTarget(null);
          setIsCaptureEnabled(true);
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        // Check if we're focused on an input field
        const focused = document.activeElement;
        console.log(focused)
        const isInputFocused = focused && (
          focused.tagName === 'INPUT' ||
          focused.tagName === 'TEXTAREA' ||
          (focused as HTMLElement).isContentEditable
        );

        // Only handle if not focused on input and we have a selection
        if (!isInputFocused && selectedInstanceIdRef.current) {
          e.preventDefault();
          deleteSelectedInstance();
        }
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
      onOperation(`Edit text "${instance.id}" by editing the embedded text content`, false);
    } else if (instance.type === 'image' || instance.type === 'sketch') {
      let newId = `Sketch${sketchCount + 1}`;
      setSketchCount(prev => prev + 1);
      let newSketch: Instance = {
        id: newId,
        type: 'sketch',
        source: createManualSource(),
        x: getInstanceGeometry(instance).x,
        y: getInstanceGeometry(instance).y,
        width: getInstanceGeometry(instance).width,
        height: getInstanceGeometry(instance).height,
        content: [],
        thumbnail: ''
      };
      if (instance.type === 'image') {
        newSketch.content.push({
          type: 'instance',
          id: generateId(),
          instance: createEmbeddedImageInstance(instance.src, instance.id),
          x: 0,
          y: 0,
          width: getInstanceGeometry(instance).width,
          height: getInstanceGeometry(instance).height
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
      onOperation(`Edit ${instance.type} "${instance.id}" by editing the embedded ${instance.type} in sketch "${newSketch.id}"`, false);
    } else if (instance.type === 'table') {
      let newTable = structuredClone(instance) as TableInstance;
      newTable.id = generateId();
      newTable.cells = newTable.cells.map(rowArr => rowArr.map(cell => cell ? { ...cell, id: generateId() } : null));
      setInstances(prev => [...prev, newTable]);
      setAvailableInstances(instances.filter(inst => inst.type !== 'table' && inst.type !== 'sketch'));
      setEditingTableId(newTable.id);
      onOperation(`Edit table "${instance.id}" by editing the embedded table "${newTable.id}"`, false);
    } else if (instance.type === 'visualization') {
      setEditingVisualizationSpec(instance.spec);
      setAvailableInstances(instances.filter(inst => inst.type !== 'visualization'));
      onOperation(`Edit visualization "${instance.id}" by editing the embedded visualization spec`, false);
    }
  }

  const handleSaveText = () => {
    const original = instances.find(inst => inst.id === editingTextId);
    if (!original || original.type !== 'text') return;
    const originalDisplay = original.content;

    const newTextId = `Text${textCountRef.current + 1}`;
    setTextCount(prev => prev + 1);
    setInstances(prev => [
      ...prev,
      {
        id: newTextId,
        type: 'text',
        source: createManualSource(),
        content: editingTextContent,
        x: original.x,
        y: original.y,
        width: original.width,
        height: original.height
      }
    ]);
    const newDisplay = editingTextContent;

    onOperation(`Save text editing of "${original.id}" changing value from "${originalDisplay}" to "${newDisplay}" creating new text "${newTextId}"`, false);

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
    const cells = Array.from({ length: rows }, () => Array.from({ length: cols }, () => null));

    const newId = generateId();
    const newTable: Instance = {
      id: newId,
      type: 'table',
      source: createManualSource(),
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
    onOperation(`Opened table editor to created a new table with ID "${newId}"`, false);
  };

  // Handle adding to table cell (for both click and drag-and-drop)
  const handleAddToTable = useCallback((instance: Instance, row: number, col: number) => {
    if (!editingTableId) return;
    console.log("Adding to table cell", instance, row, col);
    onOperation(`Add ${instance.type} "${instance.id}" to table cell (${row + 1}, ${String.fromCharCode(65 + col)}) in table "${editingTableId}"`);

    let embedded: EmbeddedInstance | null = null;

    if (instance.type === 'text') {
      embedded = createEmbeddedTextInstance(instance.content, instance.id);
    } else if (instance.type === 'image') {
      embedded = createEmbeddedImageInstance(instance.src, instance.id);
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
          if (newCells[row]) {
            newCells[row][col] = embedded;
          }
          return { ...inst, cells: newCells };
        }
        return inst;
      }));
    }
  }, [editingTableId, setInstances, instances]);

  // Remove content from table cell
  const removeCellContent = (row: number, col: number) => {
    console.log(row, col, "Removing cell content");
    if (!editingTableId) return;
    onOperation(`Remove content from table cell (${row + 1}, ${String.fromCharCode(65 + col)}) in table "${editingTableId}"`);
    setInstances(prev => prev.map(inst => {
      if (inst.id === editingTableId && inst.type === 'table') {
        const newCells = [...inst.cells];
        newCells[row][col] = null;
        return { ...inst, cells: newCells };
      }
      return inst;
    }));
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
    if (table.cells.some(rowArr => rowArr.some(cell => cell != null))) {
      withstr = table.cells.map(rowArr => {
        let embedded = rowArr.filter(cell => cell != null && cell.originalId);
        return embedded.map(cell => {
          if (!cell) return '';
          if (cell.type === 'text') {
            return `[${cell.content}](#instance-${cell.originalId || cell.id})`;
          } else if (cell.type === 'image') {
            return `[${cell.originalId || cell.id}](#instance-${cell.originalId || cell.id})`;
          } else if (cell.type === 'sketch') {
            return `[${cell.originalId || cell.id}](#instance-${cell.originalId || cell.id})`;
          } else if (cell.type === 'table') {
            return `[${cell.originalId || cell.id}](#instance-${cell.originalId || cell.id})`;
          }
        }).join(', ');
      }).filter(item => item != '').join(', ');
    }

    if (originalInstanceId) {
      onOperation(`Saved and closed the table editor. Created [${newId}](#instance-${newId}) from [${originalInstanceId}](#instance-${originalInstanceId})` + (withstr ? ` with ${withstr}` : ''), false);
    } else {
      onOperation(`Saved and closed the table editor. Created [${newId}](#instance-${newId})` + (withstr ? ` with ${withstr}` : ''), false);
    }
    setEditingTableId(null);
  };

  const cancelTableEdit = () => {
    if (!editingTableId) return;
    onOperation(`Cancelled table editing for "${editingTableId}" and closed the table editor`, false);
    setInstances(prev => prev.filter(inst => inst.id !== editingTableId));
    setEditingTableId(null);
  };

  // Handle capture to specific table cell
  const handleCaptureToTableCell = (row: number, col: number) => {
    if (!editingTableId) return;

    // Store the target cell information for when capture completes
    setCaptureTarget({ tableId: editingTableId, row, col });

    // Start capture process
    if (bgPort.current) {
      console.log("Sending message to start element selection for table cell", bgPort.current);
      bgPort.current.postMessage({
        action: 'start_element_selection'
      });
      setIsCaptureEnabled(false);
    }
  };

  // Handle adding a row to the table
  const handleAddRow = (position: 'before' | 'after', rowIndex: number) => {
    if (!editingTableId) return;
    onOperation(`Add row ${position} row ${rowIndex + 1} in table "${editingTableId}"`);

    setInstances(prev => prev.map(inst => {
      if (inst.id === editingTableId && inst.type === 'table') {
        const newRowIndex = position === 'after' ? rowIndex + 1 : rowIndex;
        const newRows = inst.rows + 1;

        // First, update row numbers for existing cells that need to be shifted
        const newCells = [...inst.cells.slice(0, newRowIndex), Array(inst.cols).fill(null), ...inst.cells.slice(newRowIndex)];

        return {
          ...inst,
          rows: newRows,
          cells: newCells
        };
      }
      return inst;
    }));
  };

  // Handle removing a row from the table
  const handleRemoveRow = (rowIndex: number) => {
    if (!editingTableId) return;
    onOperation(`Remove row ${rowIndex + 1} from table "${editingTableId}"`);

    setInstances(prev => prev.map(inst => {
      if (inst.id === editingTableId && inst.type === 'table') {
        const newRows = inst.rows - 1;

        // Remove cells in the specified row and update row numbers
        const newCells = [...inst.cells.slice(0, rowIndex), ...inst.cells.slice(rowIndex + 1)];

        return {
          ...inst,
          rows: newRows,
          cells: newCells
        };
      }
      return inst;
    }));
  };

  // Handle adding a column to the table
  const handleAddColumn = (position: 'before' | 'after', colIndex: number) => {
    if (!editingTableId) return;
    onOperation(`Add column ${position} column ${String.fromCharCode(65 + colIndex)} in table "${editingTableId}"`);

    setInstances(prev => prev.map(inst => {
      if (inst.id === editingTableId && inst.type === 'table') {
        const newColIndex = position === 'after' ? colIndex + 1 : colIndex;
        const newCols = inst.cols + 1;

        const newCells = inst.cells.map(rowArr => {
          if (rowArr.length === 0) return rowArr;
          return [...rowArr.slice(0, newColIndex), null, ...rowArr.slice(newColIndex)];
        });

        // Handle column types
        const currentColumnTypes = inst.columnTypes || [];
        const newColumnTypes = [
          ...currentColumnTypes.slice(0, newColIndex),
          'categorical' as const,
          ...currentColumnTypes.slice(newColIndex)
        ];

        return {
          ...inst,
          cols: newCols,
          cells: newCells,
          columnTypes: newColumnTypes
        };
      }
      return inst;
    }));
  };

  // Handle removing a column from the table
  const handleRemoveColumn = (colIndex: number) => {
    if (!editingTableId) return;
    onOperation(`Remove column ${String.fromCharCode(65 + colIndex)} from table "${editingTableId}"`);

    setInstances(prev => prev.map(inst => {
      if (inst.id === editingTableId && inst.type === 'table') {
        const newCols = inst.cols - 1;

        const newCells = inst.cells.map(rowArr => {
          if (rowArr.length === 0) return rowArr;
          return [...rowArr.slice(0, colIndex), ...rowArr.slice(colIndex + 1)];
        });

        // Handle column types
        const currentColumnTypes = inst.columnTypes || [];
        const newColumnTypes = [
          ...currentColumnTypes.slice(0, colIndex),
          ...currentColumnTypes.slice(colIndex + 1)
        ];

        return {
          ...inst,
          cols: newCols,
          cells: newCells,
          columnTypes: newColumnTypes
        };
      }
      return inst;
    }));
  };

  // Helper function to extract numerical values from text
  const extractNumericalValue = (text: string): string => {
    if (!text || typeof text !== 'string') return '';
    
    // Remove all non-numeric characters except decimal points and minus signs
    const cleaned = text.replace(/[^0-9.-]/g, '');
    
    // Handle multiple decimal points by keeping only the first one
    const parts = cleaned.split('.');
    let result = parts[0];
    if (parts.length > 1) {
      result += '.' + parts.slice(1).join('');
    }
    
    // Handle multiple minus signs by keeping only the first one if it's at the beginning
    if (result.includes('-')) {
      const minusCount = (result.match(/-/g) || []).length;
      if (minusCount > 1 || (result.indexOf('-') > 0)) {
        // Remove all minus signs and add one at the beginning if the original had any
        result = result.replace(/-/g, '');
        if (minusCount > 0) {
          result = '-' + result;
        }
      }
    }
    
    // Validate the result is a valid number
    const num = parseFloat(result);
    if (isNaN(num) || !isFinite(num)) {
      return '';
    }
    
    return result;
  };

  // Handle updating column type
  const handleUpdateColumnType = (colIndex: number, columnType: 'numeral' | 'categorical') => {
    if (!editingTableId) return;
    setInstances(prev => prev.map(inst => {
      if (inst.id === editingTableId && inst.type === 'table') {
        const currentColumnTypes = inst.columnTypes || [];
        const newColumnTypes = [...currentColumnTypes];
        newColumnTypes[colIndex] = columnType;
        
        // If changing to numerical, automatically correct non-numerical values
        let updatedCells = inst.cells;
        if (columnType === 'numeral') {
          updatedCells = inst.cells.map(row => {
            const newRow = [...row];
            const cell = newRow[colIndex];
            
            if (cell && cell.type === 'text') {
              const extractedValue = extractNumericalValue(cell.content);
              newRow[colIndex] = {
                ...cell,
                content: extractedValue
              };
            }
            
            return newRow;
          });
        }
        
        return {
          ...inst,
          columnTypes: newColumnTypes,
          cells: updatedCells
        };
      }
      return inst;
    }));
  };

  const handleInstanceContextMenu = (e: React.MouseEvent, instanceId: string) => {
    e.preventDefault();
    console.log("Context menu triggered for instance ID:", instanceId);
    let instanceIds: string[] = [instanceId]; // Instances to handle in context menu

    // If we are in the select mode, use the selected instance IDs
    if (mode === 'select' && selectedInstanceIds.includes(instanceId)) {
      instanceIds = selectedInstanceIds;
    }

    console.log("Context menu instances:", instanceIds);
    if (!instanceIds || instanceIds.length === 0) {
      console.warn("No instances selected for context menu");
      return;
    }
    // Make sure the instances corresponding to the instanceIds exist
    const selectedInstances = instances.filter(inst => instanceIds.includes(inst.id));
    if (selectedInstances.length === 0) {
      console.warn("No valid instances found for context menu");
      return;
    }

    setContextMenu({
      visible: true,
      instanceIds: instanceIds,
      position: { x: e.clientX, y: e.clientY },
      multi: instanceIds.length > 1
    });
  };

  const closeContextMenu = () => {
    setContextMenu({ ...contextMenu, visible: false });
  };

  // Generate operation logs from instance changes
  const generateOperationLogs = (oldInstances: Instance[], newInstanceEvents: any[]): string[] => {
    const logs: string[] = [];
    
    newInstanceEvents.forEach(event => {
      if (event.action === 'add' && event.instance) {
        logs.push(`Created ${event.instance.type} "${event.instance.id}"`);
      } else if (event.action === 'update' && event.instance && event.originalId) {
        logs.push(`Updated ${event.instance.type} "${event.originalId}"`);
      } else if (event.action === 'remove' && event.originalId) {
        const oldInstance = oldInstances.find(inst => inst.id === event.originalId);
        if (oldInstance) {
          logs.push(`Removed ${oldInstance.type} "${event.originalId}"`);
        }
      }
    });
    
    return logs;
  };

  const handleInfer = async (instanceIds: string[]) => {
    console.log(`Analyzing instances ${instanceIds.join(', ')}`);
    
    // Stop proactive suggestions when user starts inference
    proactiveService.stopSuggestions();
    
    let targetInstances = instances.filter(inst => instanceIds.includes(inst.id));
    if (targetInstances.length === 0) {
      console.warn("No instances found for inference");
      proactiveService.resumeSuggestions(); // Resume if no instances found
      return;
    }

    // Create instances checkpoint before inference
    const checkpoint = JSON.parse(JSON.stringify(instances));
    let userMsg = `Infer my intent based on the instances ${instanceIds.join(', ')} and finish the task.`;
    addMessage({
      "role": "user",
      "message": userMsg,
      "chatType": "infer",
      "id": generateId(),
      "instancesCheckpoint": checkpoint
    });
    setAgentLoading(true);
    try {
      let message: string = "", newInstances: any[] = [];
      if (import.meta.env.WXT_USE_LLM == "true") {
        // If using LLM, we need to generate the context first
        const { imageContext, textContext } = await generateInstanceContext(targetInstances);
        // let result = await parseLogWithAgent(logs, textContext, imageContext, htmlContext, instance.id);
        let result = await chatWithAgent('infer', userMsg, messages, textContext, imageContext, htmlContext, logs);
        message = result.message;
        newInstances = result.instances || [];
      } else {
        // If not using LLM, we can directly parse the log
        // let result = await parseLogWithAgent([], '', [], {}, null, [], userMsg);
        let result = await chatWithAgent('infer', userMsg);
        message = result.message;
        newInstances = result.instances || [];
      }
      
      // Generate operation logs before updating instances
      const operationLogs = generateOperationLogs(instances, newInstances);
      
      addMessage({
        "role": "agent",
        "message": message,
        "chatType": "infer",
        "id": generateId(),
        "isRetrying": false,
        "operations": operationLogs
      });
      // update the instances
      updateInstances(instances, newInstances, setInstances);      
    } finally {
      setAgentLoading(false);
      // Resume proactive suggestions after inference completes
      proactiveService.resumeSuggestions();
    }
    closeContextMenu();
  };

  const handleRename = (instance: Instance) => {
    setRenamingInstance(instance);
    onOperation(`Open rename modal to rename ${instance.type} "${instance.id}"`);
  };

  const updateInstanceReferences = useCallback((oldId: string, newId: string) => {
    // Create a deep clone of the instances array
    const updatedInstances: Instance[] = JSON.parse(JSON.stringify(instances));

    // Utility functions to update references in embedded content
    const updateEmbeddedRef = (embedded: EmbeddedInstance): EmbeddedInstance => {
      // Update the originalId reference if it points to the old ID
      if (embedded.originalId === oldId) {
        return { ...embedded, originalId: newId };
      }

      // If the embedded instance itself has the old ID, update it
      if (embedded.id === oldId) {
        return { ...embedded, id: newId };
      }

      // Recursively update for embedded tables
      if (embedded.type === 'table') {
        return {
          ...embedded,
          cells: embedded.cells.map(rowArr => rowArr.map(cell => cell ? updateEmbeddedRef(cell) : null))
        };
      }

      return embedded;
    };

    // Update all instances and their embedded content
    const result = updatedInstances.map(inst => {
      // Update the main instance ID
      if (inst.id === oldId) {
        return { ...inst, id: newId };
      }

      // Update references in sketches
      if (inst.type === 'sketch') {
        return {
          ...inst,
          content: inst.content.map(item => {
            if (item.type === 'instance') {
              return {
                ...item,
                instance: updateEmbeddedRef(item.instance)
              };
            }
            return item;
          })
        };
      }

      // Update references in tables
      if (inst.type === 'table') {
        return {
          ...inst,
          cells: inst.cells.map(rowArr => rowArr.map(cell => cell ? updateEmbeddedRef(cell) : null))
        };
      }

      return inst;
    });

    return result;
  }, [instances]);

  // Handle the rename confirmation
  const handleRenameConfirm = useCallback((oldId: string, newId: string) => {
    // Update all references in the instance tree
    const updatedInstances = updateInstanceReferences(oldId, newId);

    // Update state with the fully updated instance tree
    setInstances(updatedInstances);
    onOperation(`Rename instance "${oldId}" to "${newId}"`);

    // Update component state variables that reference the instance
    if (selectedInstanceId === oldId) setSelectedInstanceId(newId);
    if (editingSketchId === oldId) setEditingSketchId(newId);
    if (editingTextId === oldId) setEditingTextId(newId);
    if (editingTableId === oldId) setEditingTableId(newId);
    if (originalInstanceId === oldId) setOriginalInstanceId(newId);

    // Update available instances (if applicable)
    setAvailableInstances(prev =>
      prev.map(inst => inst.id === oldId ? { ...inst, id: newId } : inst)
    );

    // Close the modal
    setRenamingInstance(null);
  }, [updateInstanceReferences, setInstances, selectedInstanceId, editingSketchId,
    editingTextId, editingTableId, originalInstanceId, setAvailableInstances]);

  // Helper: get instance bounding box in canvas coordinates
  const getInstanceBox = (instance: Instance) => {
    return {
      x: getInstanceGeometry(instance).x,
      y: getInstanceGeometry(instance).y,
      width: getInstanceGeometry(instance).width,
      height: getInstanceGeometry(instance).height,
    };
  };

  // Helper: check if instance is in selection box
  const isInstanceInBox = (instance: Instance, box: { startX: number; startY: number; endX: number; endY: number }) => {
    const { x, y, width, height } = getInstanceBox(instance);
    const minX = Math.min(box.startX, box.endX);
    const maxX = Math.max(box.startX, box.endX);
    const minY = Math.min(box.startY, box.endY);
    const maxY = Math.max(box.startY, box.endY);
    return x + width > minX && x < maxX && y + height > minY && y < maxY;
  };

  // Handle mode switch
  const handleModeSwitch = (newMode: 'hand' | 'select') => {
    setMode(newMode);
    setSelectionBox(null);
    setSelectedInstanceIds([]);
    onOperation(`Switch to ${newMode} mode`);
  };

  // Handle mouse down for selection mode
  const handleSelectionMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (mode !== 'select' || event.button !== 0) return;
    const { x, y } = screenToCanvas(event.clientX, event.clientY);
    selectionStartRef.current = { x, y };
    setSelectionBox({ startX: x, startY: y, endX: x, endY: y });
  };

  // Handle mouse move for selection mode
  const handleSelectionMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (mode !== 'select' || !selectionBox || !selectionStartRef.current) return;
    const { x, y } = screenToCanvas(event.clientX, event.clientY);
    setSelectionBox(box => box ? { ...box, endX: x, endY: y } : null);
  };

  // Handle mouse up for selection mode
  const handleSelectionMouseUp = () => {
    if (mode !== 'select' || !selectionBox || !selectionStartRef.current) return;
    // Select all instances in box
    const box = selectionBox;
    const selected = instances.filter(inst => isInstanceInBox(inst, box)).map(inst => inst.id);
    setSelectedInstanceIds(selected);
    setSelectionBox(null);
    selectionStartRef.current = null;
  };

  // Handle instance click for shift selection
  const handleInstanceSelectClick = (event: React.MouseEvent, id: string) => {
    if (mode !== 'select') return;
    event.stopPropagation();
    if (event.shiftKey) {
      setSelectedInstanceIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    } else {
      setSelectedInstanceIds([id]);
    }
  };

  // Batch delete selected
  const handleBatchDelete = () => {
    if (selectedInstanceIds.length === 0) return;
    onOperation(`Delete batch selection: ${selectedInstanceIds.map(id => `"${id}"`).join(', ')}`);
    setInstances(prev => prev.filter(inst => !selectedInstanceIds.includes(inst.id)));
    setDeletedInstances(prev => [
      ...prev,
      ...instances.filter(inst => selectedInstanceIds.includes(inst.id))
    ]);
    setSelectedInstanceIds([]);
  };

  // Batch create sketch from selected
  const handleBatchCreateSketch = () => {
    if (selectedInstanceIds.length === 0) return;
    const newId = `Sketch${sketchCount + 1}`;
    setSketchCount(prev => prev + 1);
    const selected = instances.filter(inst => selectedInstanceIds.includes(inst.id));
    const newSketch: Instance = {
      id: newId,
      type: 'sketch',
      source: createManualSource(),
      x: 0,
      y: 0,
      width: 400,
      height: 50 + 60 * selected.length,
      content: selected.map((inst, idx) => ({
        type: 'instance',
        id: generateId(),
        instance: inst.type === 'text' ? createEmbeddedTextInstance(inst.content, inst.id) :
          inst.type === 'image' ? createEmbeddedImageInstance(inst.src, inst.id) :
            inst.type === 'table' ? { ...inst, id: generateId(), source: createManualSource(), originalId: inst.id } : inst,
        x: 10,
        y: 10 + idx * 60,
        width: getInstanceGeometry(inst).width,
        height: getInstanceGeometry(inst).height
      })),
      thumbnail: ''
    };
    setInstances(prev => [...prev, newSketch]);
    onOperation(`Created [${newId}](#instance-${newId}) from batch selection: ${selected.map(inst => `[${inst.id}](#instance-${inst.id})`).join(', ')}`);
    setSelectedInstanceIds([]);
  };

  // Batch create table from selected
  const handleBatchCreateTable = () => {
    if (selectedInstanceIds.length === 0) return;
    const newId = generateId();
    const selected = instances.filter(inst => selectedInstanceIds.includes(inst.id));
    const rows = selected.length;
    const cols = 1;
    const cells = selected.map((inst) => {
      let embedded: EmbeddedInstance | null = null;
      if (inst.type === 'text') {
        embedded = createEmbeddedTextInstance(inst.content, inst.id);
      } else if (inst.type === 'image') {
        embedded = createEmbeddedImageInstance(inst.src, inst.id);
      } else if (inst.type === 'table') {
        // For table, embed as EmbeddedTableInstance
        embedded = { ...inst, id: generateId(), source: createManualSource(), originalId: inst.id, type: 'table' } as EmbeddedInstance;
      } else if (inst.type === 'sketch') {
        embedded = { ...inst, id: generateId(), source: createManualSource(), originalId: inst.id, type: 'sketch' } as EmbeddedInstance;
      }
      return [embedded];
    });
    const newTable: Instance = {
      id: newId,
      type: 'table',
      source: createManualSource(),
      rows,
      cols,
      cells,
      x: 0,
      y: 0,
      width: 400,
      height: 50 + 60 * rows
    };
    setInstances(prev => [...prev, newTable]);
    onOperation(`Created [${newId}](#instance-${newId}) as table from batch selection: ${selected.map(inst => `[${inst.id}](#instance-${inst.id})`).join(', ')}`);
    setSelectedInstanceIds([]);
  };

  // Update keyboard handler for batch delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ... existing code ...
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Check if we're focused on an input field
        const focused = document.activeElement;
        const isInputFocused = focused && (
          focused.tagName === 'INPUT' ||
          focused.tagName === 'TEXTAREA' ||
          (focused as HTMLElement).isContentEditable
        );
        // Only handle if not focused on input and we have a selection
        if (!isInputFocused) {
          if (mode === 'select' && selectedInstanceIds.length > 0) {
            e.preventDefault();
            handleBatchDelete();
          } else if (selectedInstanceIdRef.current) {
            e.preventDefault();
            deleteSelectedInstance();
          }
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCaptureEnabled, mode, selectedInstanceIds]);

  // Add global click handler to close dropdowns when clicking outside
  useEffect(() => {
    const closeDropdowns = () => {
      setWebToolsOpen(false);
      setInstanceToolsOpen(false);
    };
    if (webToolsOpen || instanceToolsOpen) {
      window.addEventListener('click', closeDropdowns);
      return () => window.removeEventListener('click', closeDropdowns);
    }
  }, [webToolsOpen, instanceToolsOpen]);

  // Add handler to create a new visualization instance
  const handleCreateVisualization = () => {
    setOriginalInstanceId(null);
    // Start with a simple Vega-Lite spec as a template
    const defaultSpec = {
      "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
      "description": "A simple bar chart with embedded data.",
      "data": {
        "values": [
          { "a": "A", "b": 28 }, { "a": "B", "b": 55 }, { "a": "C", "b": 43 },
          { "a": "D", "b": 91 }, { "a": "E", "b": 81 }, { "a": "F", "b": 53 },
          { "a": "G", "b": 19 }, { "a": "H", "b": 87 }, { "a": "I", "b": 52 }
        ]
      },
      "mark": "bar",
      "encoding": {
        "x": { "field": "a", "type": "nominal", "axis": { "labelAngle": 0 } },
        "y": { "field": "b", "type": "quantitative" }
      }
    };
    setEditingVisualizationSpec(defaultSpec);
    setAvailableInstances(instances.filter(inst => inst.type === 'table' || inst.type === 'text' || inst.type === 'image'));
    onOperation(`Open visualization editor to create a new visualization with default bar chart template`, false);
  };

  // Add save/cancel handlers for VisualizationEditor
  const handleSaveVisualization = (spec: object, imageUrl: string) => {
    const newId = `Visualization${instances.filter(i => i.type === 'visualization').length + 1}`;
    const newVisualizationInstance: Instance = {
      id: newId,
      type: 'visualization',
      source: createManualSource(),
      spec,
      thumbnail: imageUrl,
      x: 0,
      y: 0,
      width: 400,
      height: 300
    };
    setInstances(prev => [
      ...prev,
      newVisualizationInstance
    ]);
    console.log(newVisualizationInstance);
    setEditingVisualizationSpec(null);
    setAvailableInstances([]);
    onOperation(`Created [${newId}](#instance-${newId}) as visualization`, false);
  };
  const handleCancelVisualization = () => {
    onOperation(`Cancel visualization creation`, false);
    setEditingVisualizationSpec(null);
    setAvailableInstances([]);
  };

  return (
    <>
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
            currentSuggestion={currentSuggestion}
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
            onCancel={() => {
              setEditingTextId(null);
            }}
            currentSuggestion={currentSuggestion}
          />
        ) : editingTableId ? (
          // Table Editor View
          <TableEditor
            tableId={editingTableId}
            instances={instances}
            htmlContext={htmlContext}
            onSaveTable={saveTable}
            onCancel={cancelTableEdit}
            onAddToTable={handleAddToTable}
            onRemoveCellContent={removeCellContent}
            onEditCellContent={(row: number, col: number, value: string) => { value.length > 0 ? handleAddToTable({ type: 'text', id: generateId(), content: value } as TextInstance, row, col) : removeCellContent(row, col) }}
            draggingInstanceId={draggingInstanceId}
            setDraggingInstanceId={setDraggingInstanceId}
            availableInstances={availableInstances}
            onCaptureToCell={handleCaptureToTableCell}
            isCaptureEnabled={isCaptureEnabled}
            onAddRow={handleAddRow}
            onRemoveRow={handleRemoveRow}
            onAddColumn={handleAddColumn}
            onRemoveColumn={handleRemoveColumn}
            onUpdateColumnType={handleUpdateColumnType}
            currentSuggestion={currentSuggestion}
          />
        ) : editingVisualizationSpec ? (
          // Visualization Editor View
          <VisualizationEditor
            initialSpec={editingVisualizationSpec}
            onSave={handleSaveVisualization}
            onCancel={handleCancelVisualization}
            availableInstances={availableInstances}
            currentSuggestion={currentSuggestion}
          />
        ) : (
          // Default Instance View
          <>
            <InstanceViewHeader
              webToolsOpen={webToolsOpen}
              setWebToolsOpen={setWebToolsOpen}
              instanceToolsOpen={instanceToolsOpen}
              setInstanceToolsOpen={setInstanceToolsOpen}
              isCaptureEnabled={isCaptureEnabled}
              mode={mode}
              handleCaptureStart={handleCaptureStart}
              handleScreenshotStart={handleScreenshotStart}
              handleCreateSketch={handleCreateSketch}
              handleCreateTable={handleCreateTable}
              handleCreateVisualization={handleCreateVisualization}
              handleModeSwitch={handleModeSwitch}
            />
            <InstanceContextMenu
              contextMenu={contextMenu}
              instances={instances}
              htmlContext={htmlContext}
              closeContextMenu={closeContextMenu}
              handleRename={handleRename}
              handleInfer={handleInfer}
              handleDelete={handleDelete}
              handleBatchDelete={handleBatchDelete}
              handleBatchCreateSketch={handleBatchCreateSketch}
              handleBatchCreateTable={handleBatchCreateTable}
            />
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
              onMouseDown={mode === 'select' ? handleSelectionMouseDown : handleMouseDown}
              onMouseMove={mode === 'select' ? handleSelectionMouseMove : handleMouseMove}
              onMouseUp={mode === 'select' ? handleSelectionMouseUp : handleMouseUp}
              onMouseLeave={mode === 'select' ? handleSelectionMouseUp : handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              ref={containerRef}
            >
              <div
                style={{
                  width: 800,
                  height: 400,
                  cursor: mode === 'hand' ? (isPanning ? 'grabbing' : 'grab') : 'crosshair',
                  touchAction: 'none',
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: '0 0',
                  position: 'relative',
                  top: 0,
                  left: 0,
                }}
              >
                {/* Render selection box */}
                {mode === 'select' && selectionBox && (
                  <div
                    style={{
                      position: 'absolute',
                      left: Math.min(selectionBox.startX, selectionBox.endX),
                      top: Math.min(selectionBox.startY, selectionBox.endY),
                      width: Math.abs(selectionBox.endX - selectionBox.startX),
                      height: Math.abs(selectionBox.endY - selectionBox.startY),
                      background: 'rgba(0, 120, 255, 0.1)',
                      border: '1.5px dashed #0078ff',
                      zIndex: 2000,
                      pointerEvents: 'none',
                    }}
                  />
                )}
                {instances.map(instance => (
                  <div
                    key={instance.id}
                    id={`instance-${instance.id}`}
                    className="instance-block"
                    style={{
                      position: 'absolute',
                      left: Number.isFinite(instance.x) ? instance.x : 0,
                      top: Number.isFinite(instance.y) ? instance.y : 0,
                      width: getInstanceGeometry(instance).width,
                      height: getInstanceGeometry(instance).height,
                      cursor: mode === 'select' ? 'pointer' : (draggingInstanceId === instance.id ? 'grabbing' : 'grab'),
                      userSelect: 'none',
                      maxWidth: '200px',
                      wordBreak: 'break-word',
                      background: selectedInstanceIds.includes(instance.id) ? '#e6f2ff' : 'white',
                      border: selectedInstanceIds.includes(instance.id) ? '2px solid #0078ff' : '1px solid #ddd',
                      borderRadius: '4px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      zIndex: draggingInstanceId === instance.id ? 1000 : 'auto',
                      padding: '4px'
                    }}
                    onMouseDown={mode === 'select' ? (e => {
                      if (e.button === 0) handleInstanceSelectClick(e, instance.id);
                    }) : (e => handleInstanceMouseDown(e, instance.id))}
                    onDoubleClick={() => handleInstanceDoubleClick(instance)}
                    onContextMenu={e => handleInstanceContextMenu(e, instance.id)}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        top: '-18px', // 显示在实例上方
                        left: '-5px',
                        color: '#bbb',
                        fontSize: '11px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        zIndex: 1001, // 确保显示在最上层
                        pointerEvents: 'none', // 防止阻挡鼠标事件
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {instance.id}
                    </div>
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
                          overflow: 'hidden'
                        }}
                      >
                        {instance.cells.map((row, rowIndex) => {
                          return row.map((cell, colIndex) => {
                            const key = `${rowIndex}-${colIndex}`;

                            return (
                              <div
                                key={key}
                                style={{
                                  border: '1px solid #ddd',
                                  padding: '2px',
                                  boxSizing: 'border-box',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '2px',
                                }}
                              >
                                {!cell ? (
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
                                ) : cell.type === 'text' ? (
                                  <p
                                    key={cell.id}
                                    style={{
                                      margin: 0,
                                      fontSize: '10px',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {cell.content.length > 10
                                      ? `${cell.content.slice(0, 10)}...`
                                      : cell.content}
                                  </p>
                                ) : cell.type === 'image' ? (
                                  <img
                                    key={cell.id}
                                    src={cell.src}
                                    alt="thumbnail"
                                    style={{
                                      maxWidth: '100%',
                                      maxHeight: '100%',
                                      objectFit: 'contain',
                                      pointerEvents: 'none',
                                    }}
                                  />
                                ) : cell.type === 'visualization' ? (
                                  <img
                                    key={cell.id}
                                    src={cell.thumbnail}
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
                            );
                          })
                        })}
                      </div>
                    ) : instance.type === 'visualization' ? (
                      <img
                        key={instance.id}
                        src={instance.thumbnail}
                        alt="thumbnail"
                        style={{
                          maxWidth: '100%',
                          maxHeight: '100%',
                          objectFit: 'contain',
                          pointerEvents: 'none',
                        }}
                      />
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
                
                {/* Render ghost instances for proactive suggestions */}
                {currentSuggestion && currentSuggestion.instances.map((instanceEvent, index) => (
                  <GhostInstance
                    key={`ghost-${index}`}
                    instanceEvent={instanceEvent}
                    existingInstances={instances}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
      {renamingInstance && (
        <RenameModal
          instance={renamingInstance}
          instances={instances}
          onConfirm={handleRenameConfirm}
          onCancel={() => setRenamingInstance(null)}
        />
      )}
    </>
  );
};

export default InstanceView;