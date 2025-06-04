import React, { useState, useRef, useEffect } from 'react';
import './instanceview.css';

type EmbeddedInstance =
  | { type: 'text'; content: string; }
  | { type: 'image'; src: string; };

type SketchItem =
  | { type: 'stroke'; id: string; points: Array<{ x: number, y: number }>; color: string; width: number; }
  | { type: 'instance'; id: string; instance: EmbeddedInstance; x: number; y: number; width: number; height: number; };

type Instance =
  | { id: string; type: 'text'; content: string; x: number; y: number; width: number; height: number }
  | { id: string; type: 'image'; src: string; x: number; y: number; width: number; height: number }
  | { id: string; type: 'sketch'; x: number; y: number; width: number; height: number; content: SketchItem[]; thumbnail: string };

interface InstanceViewProps {
  onOperation: (message: string) => void;
}

const InstanceView = ({ onOperation }: InstanceViewProps) => {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<{ x: number; y: number; initialPan: { x: number; y: number } } | null>(null);
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

  // Sketch editor state
  const [editingSketchId, setEditingSketchId] = useState<string | null>(null);
  const [sketchColor, setSketchColor] = useState('#000000');
  const [sketchWidth, setSketchWidth] = useState(3);
  const [currentStroke, setCurrentStroke] = useState<{ id: string, points: Array<{ x: number, y: number }> } | null>(null);
  const sketchCanvasRef = useRef<HTMLCanvasElement>(null);
  const [availableInstances, setAvailableInstances] = useState<Instance[]>([]);

  const generateId = () => '_' + Math.random().toString(36).substr(2, 9);

  const screenToCanvas = (screenX: number, screenY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const x = (screenX - rect.left - pan.x) / zoom;
    const y = (screenY - rect.top - pan.y) / zoom;
    return { x, y };
  };

  // Handle wheel events with proper passive listeners
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
    event.dataTransfer.dropEffect = 'copy';
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

  const handleTouchEnd = () => {
    setIsPanning(false);
    panStart.current = null;
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

  // Sketch creation and editing functions
  const handleCreateSketch = () => {
    const newSketch: Instance = {
      id: generateId(),
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
      onOperation(`Added ${instance.type} to sketch`);
    }
  };

  const handleSaveSketch = () => {
    if (!editingSketchId || !sketchCanvasRef.current) return;

    const canvas = sketchCanvasRef.current;
    const thumbnail = canvas.toDataURL('image/png');

    setInstances(prev => prev.map(inst => {
      if (inst.id === editingSketchId && inst.type === 'sketch') {
        return { ...inst, thumbnail };
      }
      return inst;
    }));

    setEditingSketchId(null);
    onOperation("Sketch created");
  };

  const handleCancelSketch = () => {
    setInstances(prev => prev.filter(inst => inst.id !== editingSketchId)); // Remove empty sketch
    setEditingSketchId(null);
  };

  // Sketch drawing functions
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
            <label>
              Color:
              <input
                type="color"
                value={sketchColor}
                onChange={e => setSketchColor(e.target.value)}
              />
            </label>
            <label>
              Brush Size:
              <input
                type="range"
                min="1"
                max="20"
                value={sketchWidth}
                onChange={e => setSketchWidth(parseInt(e.target.value))}
              />
              {sketchWidth}px
            </label>
            <button onClick={handleSaveSketch} className="sketch-button">Save Sketch</button>
            <button onClick={handleCancelSketch} className="sketch-button cancel">Cancel</button>
          </div>

          <div className="sketch-container">
            <canvas
              ref={sketchCanvasRef}
              width={800}
              height={500}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={endDrawing}
              onMouseLeave={endDrawing}
              style={{ border: '1px solid #000', cursor: 'crosshair', backgroundColor: 'white' }}
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
                    pointerEvents: 'none',
                  }}
                >
                  {item.instance.type === 'text' ? (
                    <p style={{ margin: 0, fontSize: '12px' }}>{item.instance.content}</p>
                  ) : (
                    <img
                      src={item.instance.src}
                      alt="embedded"
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
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
                ))
              }
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="view-title-container">
            <h3 style={{ 'margin': 0 }}>Instances</h3>
            <button onClick={handleCreateSketch}>
              Create New Sketch
            </button>
          </div>
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