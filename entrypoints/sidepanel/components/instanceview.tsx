import React, { useState, useRef } from 'react';
import './instanceview.css';

type Instance =
  | { id: string; type: 'text'; content: string; x: number; y: number; width: number; height: number }
  | { id: string; type: 'image'; src: string; x: number; y: number; width: number; height: number };

interface InstanceViewProps {
  onOperation: (message: string) => void;
}

const InstanceView = ({ onOperation }: InstanceViewProps) => {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<{ x: number; y: number; initialPan: { x: number; y: number; }; } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggingInstanceId, setDraggingInstanceId] = useState<string | null>(null);
  const dragStartPos = useRef<{ mouseX: number; mouseY: number; instanceX: number; instanceY: number; offsetX: number; offsetY: number } | null>(null);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
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

  const generateId = () => '_' + Math.random().toString(36).substr(2, 9);

  const screenToCanvas = (screenX: number, screenY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const x = (screenX - rect.left - pan.x) / zoom;
    const y = (screenY - rect.top - pan.y) / zoom;
    return { x, y };
  };

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
          onOperation("Image added");
          const reader = new FileReader();
          reader.onload = (e) => {
            const result = e.target?.result;
            if (result) {
              setInstances(prev => [...prev, { id: generateId(), type: 'image', src: result as string, x, y, width: 100, height: 100 }]);
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
        onOperation(`Text added: "${text}"`);
        setInstances(prev => [...prev, { id: generateId(), type: 'text', content: text, x, y, width: 100, height: 20 }]);
      }
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const pasteX = rect ? (rect.width / 2 - pan.x) / zoom : 0;
    const pasteY = rect ? (rect.height / 2 - pan.y) / zoom : 0;

    const items = event.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          onOperation("Image added");
          const reader = new FileReader();
          reader.onload = (e) => {
            const result = e.target?.result;
            if (result) {
              setInstances(prev => [...prev, { id: generateId(), type: 'image', src: result as string, x: pasteX, y: pasteY, width: 100, height: 100 }]);
            }
          };
          reader.readAsDataURL(file);
        }
      } else if (item.type === 'text/plain') {
        item.getAsString((text) => {
          onOperation(`Text added: "${text}"`);
          setInstances(prev => [...prev, { id: generateId(), type: 'text', content: text, x: pasteX, y: pasteY, width: 100, height: 20 }]);
        });
      }
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();

    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    const mouseX = event.clientX - containerRect.left;
    const mouseY = event.clientY - containerRect.top;

    const canvasX = (mouseX - pan.x) / zoom;
    const canvasY = (mouseY - pan.y) / zoom;

    const zoomFactor = 1.1;
    const newZoom = event.deltaY < 0
      ? Math.min(5, zoom * zoomFactor)
      : Math.max(0.2, zoom / zoomFactor);

    const newPanX = mouseX - canvasX * newZoom;
    const newPanY = mouseY - canvasY * newZoom;

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

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

  const handleInstanceMouseDown = (
    event: React.MouseEvent<HTMLDivElement>,
    id: string,
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

  return (
    <div
      className="view-container"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onPaste={handlePaste}
      tabIndex={0}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      ref={containerRef}
      style={{ overflow: 'hidden', userSelect: isPanning || draggingInstanceId ? 'none' : 'auto' }}
    >
      <h3 className="view-title">Instances</h3>
      <div
        className="view-content"
        style={{
          position: 'relative',
          width: 800,
          height: 400,
          border: '1px solid #ccc',
          overflow: 'hidden',
          cursor: isPanning ? 'grabbing' : 'grab',
          backgroundColor: '#fafafa',
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
            >
              {instance.type === 'text' ? (
                <p style={{ margin: 0, userSelect: 'none' }}>
                  {instance.content}
                </p>
              ) : (
                <img
                  src={instance.src}
                  alt="instance"
                  className="instance-image"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    display: 'block',
                    pointerEvents: 'none',
                  }}
                />
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
    </div>
  );
};

export default InstanceView;