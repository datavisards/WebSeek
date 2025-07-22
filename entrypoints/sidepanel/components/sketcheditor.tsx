// SketchEditor.tsx
import React, { useState, useRef, useEffect, forwardRef } from 'react';
import { Instance, SketchInstance, SketchItem, TableInstance } from '../types';
import TableGrid from './tablegrid';
import './sketcheditor.css';

interface SketchEditorProps {
  editingSketchId: string;
  instances: Instance[];
  setInstances: React.Dispatch<React.SetStateAction<Instance[]>>;
  sketchColor: string;
  setSketchColor: React.Dispatch<React.SetStateAction<string>>;
  currentMode: 'draw' | 'move';
  setCurrentMode: React.Dispatch<React.SetStateAction<'draw' | 'move'>>;
  currentStroke: {
    id: string;
    points: Array<{ x: number; y: number }>;
  } | null;
  setCurrentStroke: React.Dispatch<React.SetStateAction<{
    id: string;
    points: Array<{ x: number; y: number }>;
  } | null>>;
  onSaveSketch: () => void;
  onCancelSketch: () => void;
  onAddToSketch: (instance: Instance) => void;
  availableInstances: Instance[];
  handleEmbeddedMouseDown: (e: React.MouseEvent, itemId: string) => void;
  handleEmbeddedResizerMouseDown: (
    e: React.MouseEvent,
    direction: string,
    itemId: string
  ) => void;
  handleEmbeddedMouseMove: (event: React.MouseEvent<HTMLDivElement>) => void;
  handleEmbeddedMouseUp: (event: React.MouseEvent<HTMLDivElement>) => void;
  draggingEmbeddedId: string | null;
}

const SketchEditor = forwardRef<HTMLCanvasElement, SketchEditorProps>(({
  editingSketchId,
  instances,
  setInstances,
  sketchColor,
  setSketchColor,
  currentMode,
  setCurrentMode,
  currentStroke,
  setCurrentStroke,
  onSaveSketch,
  onCancelSketch,
  onAddToSketch,
  availableInstances,
  handleEmbeddedMouseDown,
  handleEmbeddedResizerMouseDown,
  handleEmbeddedMouseMove,
  handleEmbeddedMouseUp,
  draggingEmbeddedId
}, ref) => {
  // Start drawing
  const startDrawing = (e: React.MouseEvent) => {
    const canvas = ref && 'current' in ref ? ref.current : null;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setCurrentStroke({
      id: '_' + Math.random().toString(36).substr(2, 9),
      points: [{ x, y }]
    });
  };

  // Continue drawing
  const draw = (e: React.MouseEvent) => {
    const canvas = ref && 'current' in ref ? ref.current : null;
    if (!currentStroke || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setCurrentStroke(prev => ({
      ...prev!,
      points: [...prev!.points, { x, y }]
    }));
  };

  // End drawing
  const endDrawing = () => {
    if (!currentStroke) return;

    setInstances(prev => prev.map(inst => {
      if (inst.id === editingSketchId && inst.type === 'sketch') {
        return {
          ...inst,
          content: [
            ...inst.content,
            {
              type: 'stroke',
              id: currentStroke.id,
              points: currentStroke.points,
              color: sketchColor,
              width: 3
            }
          ]
        };
      }
      return inst;
    }));

    setCurrentStroke(null);
  };

  // Render sketch to canvas
  useEffect(() => {
    const canvas = ref && 'current' in ref ? ref.current : null;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Get current sketch
    const sketch = instances.find(inst =>
      inst.id === editingSketchId && inst.type === 'sketch'
    );

    if (!sketch || sketch.type !== 'sketch') return;

    // Draw strokes
    sketch.content.forEach(item => {
      if (item.type === 'stroke') {
        ctx.beginPath();
        ctx.strokeStyle = item.color;
        ctx.lineWidth = item.width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        item.points.forEach((point, i) => {
          if (i === 0) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
        });
        ctx.stroke();
      }
    });

    // Draw current stroke
    if (currentStroke) {
      ctx.beginPath();
      ctx.strokeStyle = sketchColor;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      currentStroke.points.forEach((point: any, i: number) => {
        if (i === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
    }
  }, [editingSketchId, instances, currentStroke, sketchColor]);

  return (
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
        <button onClick={onSaveSketch}>Save Sketch</button>
        <button onClick={onCancelSketch}>Cancel</button>
      </div>

      <div className="sketch-container"
        style={{ position: 'relative', backgroundColor: 'white' }}
        onMouseMove={currentMode === 'move' ? handleEmbeddedMouseMove : undefined}
        onMouseUp={currentMode === 'move' ? handleEmbeddedMouseUp : undefined}
        onMouseLeave={currentMode === 'move' ? handleEmbeddedMouseUp : undefined}
      >
        <canvas
          ref={ref}
          width={800}
          height={500}
          onMouseDown={currentMode === 'draw' ? startDrawing : undefined}
          onMouseMove={currentMode === 'draw' ? draw : undefined}
          onMouseUp={currentMode === 'draw' ? endDrawing : undefined}
          onMouseLeave={currentMode === 'draw' ? endDrawing : undefined}
          style={{
            position: 'relative',
            cursor: currentMode === 'draw' ? 'crosshair' : 'move',
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
                userSelect: 'none',
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
              ) : item.instance.type === 'table' ? (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    position: 'relative',
                    overflow: 'hidden',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                  }}
                >
                  <TableGrid
                    table={item.instance}
                    instances={availableInstances}
                    onAddToTable={(instance, row, col) => {
                      // No-op for read-only view
                    }}
                    onRemoveCellContent={() => {
                      // No-op for read-only view
                    }}
                    setDraggingInstanceId={() => {
                      // No-op for read-only view
                    }}
                    onEditCellContent={() => {
                      // No-op for read-only view
                    }}
                    isReadOnly={true}
                  />
                </div>
              ) : null}

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
              onClick={() => onAddToSketch(instance)}
            >
              {instance.type === 'text' ? (
                <p className="thumb-text">
                  {instance.content.slice(0, 20)}
                  {instance.content.length > 20 ? '...' : ''}
                </p>
              ) : instance.type === 'image' ? (
                <img
                  src={instance.src}
                  alt="thumb"
                  className="thumb-image"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : instance.type === 'table' ? (
                <div
                  style={{
                    width: '60px',
                    height: '60px',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                    backgroundColor: '#f0f0f0',
                    border: '1px solid #ccc',
                    borderRadius: '4px'
                  }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(${Math.min(instance.cols, 3)}, 1fr)`,
                      gridTemplateRows: `repeat(${Math.min(instance.rows, 3)}, 1fr)`,
                      gap: '1px',
                      width: '95%',
                      height: '95%',
                      boxSizing: 'border-box'
                    }}
                  >
                    {Array.from({ length: Math.min(instance.rows * instance.cols, 9) }).map((_, index) => {
                      const row = Math.floor(index / Math.min(instance.cols, 3));
                      const col = index % Math.min(instance.cols, 3);
                      const cell = instance.cells[row]?.[col];

                      return (
                        <div
                          key={`${row}-${col}`}
                          style={{
                            border: '1px solid #ddd',
                            padding: '1px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: '#fff',
                            fontSize: '8px',
                            color: '#333'
                          }}
                        >
                          {cell ? (
                            <div style={{ textAlign: 'center' }}>
                              {cell.type === 'text' ? (
                                <span title={cell.content}>
                                  {cell.content.length > 4
                                    ? `${cell.content.slice(0, 4)}...`
                                    : cell.content}
                                </span>
                              ) : cell.type === 'image' ? (
                                <img
                                  src={cell.src}
                                  alt="cell"
                                  style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'contain'
                                  }}
                                />
                              ) : null}
                            </div>
                          ) : (
                            <div>Empty</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

export default SketchEditor;