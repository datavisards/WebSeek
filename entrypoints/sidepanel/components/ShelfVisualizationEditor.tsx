import React, { useState, useEffect, useMemo, useCallback } from 'react';
import VisualizationRenderer, { InteractionConfig } from './visualizationrenderer';
import { Instance, TableInstance, TextInstance } from '../types';
import './shelfvisualizationeditor.css';

interface Column {
  id: string;
  name: string;
  type: 'numeral' | 'categorical';
  instanceId: string;
  instanceType: 'table' | 'text';
  profile?: {
    uniqueValues?: number;
    nullCount?: number;
    min?: number;
    max?: number;
    mean?: number;
    topValues?: string[];
  };
}

interface ShelfVisualizationEditorProps {
  onSave: (spec: object, imageUrl: string) => void;
  onCancel: () => void;
  availableInstances: Instance[];
  initialSpec?: object | string | null;
}

interface Shelf {
  x?: Column[];
  y?: Column[];
  color?: Column[];
}

// Default interaction configurations for different chart types
const DEFAULT_INTERACTIONS: Record<string, InteractionConfig> = {
  point: {
    hover: { enabled: true },
    selection: { enabled: true, type: 'box' }
  },
  bar: {
    hover: { enabled: true },
    selection: { enabled: true, type: 'single' }
  },
  line: {
    hover: { enabled: true },
    selection: { enabled: false, type: 'single' }
  },
  histogram: {
    hover: { enabled: true },
    selection: { enabled: true, type: 'single' }
  }
};

// Helper function to generate column names (A, B, C, etc.)
const getColumnName = (index: number): string => {
  let result = '';
  let num = index;
  while (true) {
    result = String.fromCharCode(65 + (num % 26)) + result;
    num = Math.floor(num / 26);
    if (num === 0) break;
    num--; // Adjust for 1-based indexing after the first character
  }
  return result;
};

// Helper function to calculate basic column profiling
const profileColumn = (values: (string | number | null)[], columnType: 'numeral' | 'categorical'): Column['profile'] => {
  const nonNullValues = values.filter(v => v !== null && v !== undefined && v !== '');
  const nullCount = values.length - nonNullValues.length;
  const uniqueValues = new Set(nonNullValues).size;

  const profile: Column['profile'] = {
    uniqueValues,
    nullCount,
  };

  // Use the column type to determine how to profile
  if (columnType === 'numeral') {
    // For numeric columns, try to parse values and show range
    const numericValues = nonNullValues
      .map(v => typeof v === 'number' ? v : parseFloat(String(v)))
      .filter(v => !isNaN(v));

    if (numericValues.length > 0) {
      profile.min = Math.min(...numericValues);
      profile.max = Math.max(...numericValues);
      profile.mean = numericValues.reduce((sum, val) => sum + val, 0) / numericValues.length;
    }
  } else {
    // For categorical data, always show top values
    const valueCounts = new Map<string, number>();
    nonNullValues.forEach(val => {
      const strVal = String(val);
      valueCounts.set(strVal, (valueCounts.get(strVal) || 0) + 1);
    });

    profile.topValues = Array.from(valueCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([value]) => value);
  }

  return profile;
};

const ShelfVisualizationEditor: React.FC<ShelfVisualizationEditorProps> = ({
  onSave,
  onCancel,
  availableInstances,
  initialSpec,
}) => {
  const [shelves, setShelves] = useState<Shelf>({
    x: [],
    y: [],
    color: []
  });

  const [chartType, setChartType] = useState<'bar' | 'line' | 'point' | 'histogram'>('point');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [draggedOver, setDraggedOver] = useState<string | null>(null);
  const [isInteractive, setIsInteractive] = useState<boolean>(true);
  const [interactionConfig, setInteractionConfig] = useState<InteractionConfig>(DEFAULT_INTERACTIONS.point);

  // Extract columns from available instances
  const availableColumns = useMemo((): Column[] => {
    const columns: Column[] = [];

    console.log('Available instances:', availableInstances);

    availableInstances.forEach(instance => {
      if (instance.type === 'table') {
        const tableInstance = instance as TableInstance;
        const columnNames = tableInstance.columnNames || [];
        const columnTypes = tableInstance.columnTypes || [];

        console.log(`Table ${instance.id}:`, {
          rows: tableInstance.rows,
          cols: tableInstance.cols,
          columnNames,
          columnTypes
        });

        for (let i = 0; i < tableInstance.cols; i++) {
          const columnName = columnNames[i] || getColumnName(i);
          const columnType = columnTypes[i] || 'categorical';

          // Extract column values for profiling
          const columnValues: (string | number | null)[] = [];
          for (let row = 0; row < tableInstance.rows; row++) {
            const cell = tableInstance.cells[row][i];
            columnValues.push(cell && cell.type === 'text' ? cell.content : null);
          }

          const profile = profileColumn(columnValues, columnType);

          columns.push({
            id: `${instance.id}_col_${i}`,
            name: `${instance.id}: ${columnName}`,
            type: columnType,
            instanceId: instance.id,
            instanceType: 'table',
            profile
          });
        }
      } else if (instance.type === 'text') {
        columns.push({
          id: `${instance.id}_text`,
          name: `${instance.id}: Text`,
          type: 'categorical',
          instanceId: instance.id,
          instanceType: 'text'
        });
      }
    });

    console.log('Available columns:', columns);
    return columns;
  }, [availableInstances]);

  // Parse initial spec to populate shelves
  useEffect(() => {
    if (!initialSpec || !availableColumns.length) return;

    try {
      const spec = typeof initialSpec === 'string' ? JSON.parse(initialSpec) : initialSpec;

      // Extract chart type from mark and encoding
      if (spec.mark) {
        const markType = typeof spec.mark === 'string' ? spec.mark : spec.mark.type;
        
        // Special case: detect histograms by checking for binning in x-axis and count in y-axis
        if (markType === 'bar' && spec.encoding?.x?.bin && spec.encoding?.y?.aggregate === 'count') {
          setChartType('histogram');
        } else if (['bar', 'line', 'point', 'histogram'].includes(markType)) {
          setChartType(markType);
        }
      }

      // Extract encoding to populate shelves by matching field names with available columns
      if (spec.encoding) {
        const newShelves: Shelf = {
          x: [],
          y: [],
          color: []
        };

        // Map x-axis encoding
        if (spec.encoding.x && spec.encoding.x.field) {
          const matchingColumn = availableColumns.find(col =>
            col.id === spec.encoding.x.field ||
            col.name.split(': ')[1] === spec.encoding.x.title ||
            col.name.split(': ')[1] === spec.encoding.x.field
          );
          if (matchingColumn) {
            newShelves.x = [matchingColumn];
          }
        }

        // Map y-axis encoding
        if (spec.encoding.y && spec.encoding.y.field) {
          const matchingColumn = availableColumns.find(col =>
            col.id === spec.encoding.y.field ||
            col.name.split(': ')[1] === spec.encoding.y.title ||
            col.name.split(': ')[1] === spec.encoding.y.field
          );
          if (matchingColumn) {
            newShelves.y = [matchingColumn];
          }
        }

        // Map color encoding
        if (spec.encoding.color && spec.encoding.color.field) {
          const matchingColumn = availableColumns.find(col =>
            col.id === spec.encoding.color.field ||
            col.name.split(': ')[1] === spec.encoding.color.title ||
            col.name.split(': ')[1] === spec.encoding.color.field
          );
          if (matchingColumn) {
            newShelves.color = [matchingColumn];
          }
        }

        // Only update shelves if we found matches
        if ((newShelves.x && newShelves.x.length) ||
          (newShelves.y && newShelves.y.length) ||
          (newShelves.color && newShelves.color.length)) {
          setShelves(newShelves);
          console.log('Populated shelves from initial spec:', newShelves);
        }
      }

      console.log('Loaded initial spec:', spec);

    } catch (error) {
      console.warn('Could not parse initial spec:', error);
    }
  }, [initialSpec, availableColumns]);

  // Filter columns based on selected filter
  const filteredColumns = useMemo(() => {
    if (filter === 'all') return availableColumns;
    if (filter === 'text') return availableColumns.filter(col => col.instanceType === 'text');
    // Filter by specific table instance
    return availableColumns.filter(col => col.instanceId === filter);
  }, [availableColumns, filter]);

  // Get filter options
  const filterOptions = useMemo(() => {
    const options = [{ value: 'all', label: 'All Columns' }];

    // Add text instance filter if there are any text instances
    const hasText = availableColumns.some(col => col.instanceType === 'text');
    if (hasText) options.push({ value: 'text', label: 'All Text Instances' });

    // Add table instance filters
    const tableInstances = new Set<string>();
    availableColumns.forEach(col => {
      if (col.instanceType === 'table') {
        tableInstances.add(col.instanceId);
      }
    });

    tableInstances.forEach(instanceId => {
      options.push({
        value: instanceId,
        label: `Table: ${instanceId}`
      });
    });

    return options;
  }, [availableColumns]);

  // Stable reference for interaction config to prevent unnecessary re-renders
  const stableInteractionConfig = useMemo(() => ({
    hover: { enabled: interactionConfig.hover?.enabled || false },
    selection: { 
      enabled: interactionConfig.selection?.enabled || false,
      type: interactionConfig.selection?.type || 'single'
    }
  }), [interactionConfig.hover?.enabled, interactionConfig.selection?.enabled, interactionConfig.selection?.type]);

  // Generate Vega-Lite spec from shelves
  const generateSpec = useMemo((): object | null => {
    // Need at least one encoding
    if (!shelves.x?.length && !shelves.y?.length) {
      console.log('No data in shelves');
      return null;
    }

    // Collect all data sources
    const dataSources = new Map<string, any[]>();

    [...(shelves.x || []), ...(shelves.y || []), ...(shelves.color || [])]
      .forEach(column => {
        if (dataSources.has(column.instanceId)) return;

        const instance = availableInstances.find(inst => inst.id === column.instanceId);
        if (!instance) {
          console.log('Instance not found:', column.instanceId);
          return;
        }

        if (instance.type === 'table') {
          const tableInstance = instance as TableInstance;
          const data: any[] = [];

          for (let i = 0; i < tableInstance.rows; i++) {
            const row: any = {};
            for (let j = 0; j < tableInstance.cols; j++) {
              const cell = tableInstance.cells[i][j];
              row[`${instance.id}_col_${j}`] = cell && cell.type === 'text' ? cell.content : null;
            }
            data.push(row);
          }
          dataSources.set(column.instanceId, data);
          console.log('Table data for', column.instanceId, ':', data);
        } else if (instance.type === 'text') {
          const textInstance = instance as TextInstance;
          dataSources.set(column.instanceId, [{ [`${instance.id}_text`]: textInstance.content }]);
        }
      });

    // For now, use the first data source (in a full implementation, you'd handle joins)
    const firstDataSource = dataSources.values().next().value;
    if (!firstDataSource) {
      console.log('No data sources available');
      return null;
    }

    const encoding: any = {};

    if (shelves.x?.length) {
      const xColumn = shelves.x[0];
      encoding.x = {
        field: xColumn.id,
        type: xColumn.type === 'numeral' ? 'quantitative' : 'nominal',
        title: xColumn.name.split(': ')[1]
      };
    }

    if (shelves.y?.length) {
      const yColumn = shelves.y[0];
      encoding.y = {
        field: yColumn.id,
        type: yColumn.type === 'numeral' ? 'quantitative' : 'nominal',
        title: yColumn.name.split(': ')[1]
      };
    }

    if (shelves.color?.length) {
      const colorColumn = shelves.color[0];
      encoding.color = {
        field: colorColumn.id,
        type: colorColumn.type === 'numeral' ? 'quantitative' : 'nominal',
        title: colorColumn.name.split(': ')[1]
      };
    }


    // Special handling for histograms
    if (chartType === 'histogram') {
      // For histograms, we need special encoding
      if (shelves.x?.length) {
        const xColumn = shelves.x[0];
        // For histograms, X should be binned and Y should be count
        encoding.x = {
          field: xColumn.id,
          type: 'quantitative',
          bin: true,
          title: xColumn.name.split(': ')[1]
        };
        encoding.y = {
          aggregate: 'count',
          type: 'quantitative',
          title: 'Count'
        };
      }
    }

    const spec: any = {
      $schema: "https://vega.github.io/schema/vega-lite/v5.json",
      data: { values: firstDataSource },
      mark: chartType === 'histogram' ? 'bar' : chartType,
      encoding,
      // Use responsive sizing
      width: 'container',
      height: 'container'
    };

    // Add interactivity if enabled
    if (isInteractive && stableInteractionConfig) {
      // Add tooltip for hover
      if (stableInteractionConfig.hover?.enabled) {
        // Add tooltip to encoding
        const tooltipFields = [];
        if (shelves.x?.length) tooltipFields.push(shelves.x[0].id);
        if (shelves.y?.length) tooltipFields.push(shelves.y[0].id);
        if (shelves.color?.length) tooltipFields.push(shelves.color[0].id);

        encoding.tooltip = tooltipFields.map(field => ({ field }));
      }

      // Add selection for interactivity
      if (stableInteractionConfig.selection?.enabled) {
        const selectionName = 'brush';

        // Use params instead of selection for Vega-Lite v5+
        if (!spec.params) {
          spec.params = [];
        }

        if (stableInteractionConfig.selection.type === 'box') {
          // Box selection for scatter plots
          spec.params.push({
            name: selectionName,
            select: {
              type: 'interval'
            }
          });
        } else if (stableInteractionConfig.selection.type === 'multi') {
          // Multi-select
          spec.params.push({
            name: selectionName,
            select: {
              type: 'point',
              toggle: true
            }
          });
        } else {
          // Single selection (default)
          spec.params.push({
            name: selectionName,
            select: {
              type: 'point'
            }
          });
        }

        // Apply selection styling to marks
        if (typeof spec.mark === 'string') {
          spec.mark = {
            type: spec.mark,
            cursor: 'pointer'
          };
        } else {
          spec.mark.cursor = 'pointer';
        }

        // Add conditional formatting for selected items
        const originalColor = encoding.color;
        if (originalColor) {
          // If there was already a color encoding, preserve it in the condition
          encoding.color = {
            condition: {
              param: selectionName,
              ...originalColor
            },
            value: 'lightgray'
          };
        } else {
          // Default color scheme for selection
          encoding.color = {
            condition: {
              param: selectionName,
              value: '#FF6B35'
            },
            value: '#1f77b4'
          };
        }
      }
    }

    console.log('Generated spec:', spec);
    return spec;
  }, [shelves, chartType, availableInstances, isInteractive, stableInteractionConfig]);

  const handleDragStart = (e: React.DragEvent, column: Column) => {
    e.dataTransfer.setData('application/json', JSON.stringify(column));
  };

  const handleDrop = (e: React.DragEvent, shelfName: keyof Shelf) => {
    e.preventDefault();
    setDraggedOver(null);
    try {
      const column: Column = JSON.parse(e.dataTransfer.getData('application/json'));
      setShelves(prev => ({
        ...prev,
        [shelfName]: [column] // For now, only allow one column per shelf
      }));
    } catch (error) {
      console.error('Error dropping column:', error);
    }
  };

  const handleDragOver = (e: React.DragEvent, shelfName: keyof Shelf) => {
    e.preventDefault();
    setDraggedOver(shelfName);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if we're actually leaving this shelf (not entering a child element)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDraggedOver(null);
    }
  };

  const removeFromShelf = (shelfName: keyof Shelf, columnId: string) => {
    setShelves(prev => ({
      ...prev,
      [shelfName]: prev[shelfName]?.filter(col => col.id !== columnId) || []
    }));
  };

  const handleChartTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newChartType = e.target.value as 'bar' | 'line' | 'point' | 'histogram';
    setChartType(newChartType);
    // Update interaction configuration based on chart type
    setInteractionConfig(DEFAULT_INTERACTIONS[newChartType]);
  };

  const handleSave = useCallback(() => {
    if (!generateSpec || !imageUrl) return;
    onSave(generateSpec, imageUrl);
  }, [generateSpec, imageUrl, onSave]);

  const handleImageUrlReady = useCallback((url: string) => {
    setImageUrl(url);
  }, []);

  return (
    <div className="view-container">
      <div className="view-title-container">
        <h3 style={{ margin: 0 }}>Visual Editor</h3>
        <div className="shelf-editor-actions">
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!generateSpec || !imageUrl}
          >
            Save
          </button>
        </div>
      </div>

      <main className="shelf-editor-main">
        {/* Left Panel: Specifications */}
        <div className="shelf-editor-left">
          {/* Top: Shelves */}
          <div className="shelf-editor-specs">
            <section className="chart-type-section">
              <div className="chart-type-row">
                <label htmlFor="chart-type-select">Chart Type</label>
                <select
                  id="chart-type-select"
                  className="chart-type-dropdown"
                  value={chartType}
                  onChange={handleChartTypeChange}
                >
                  <option value="bar">Bar Chart</option>
                  <option value="line">Line Chart</option>
                  <option value="point">Scatter Plot</option>
                  <option value="histogram">Histogram</option>
                </select>
              </div>
            </section>

            <div className="shelves-container">
              <div className="shelf-section">
                <div className="shelf-row">
                  <div className="shelf-label">X-Axis</div>
                  <div
                    className={`shelf x-shelf ${draggedOver === 'x' ? 'dragged-over' : ''}`}
                    onDrop={(e) => handleDrop(e, 'x')}
                    onDragOver={(e) => handleDragOver(e, 'x')}
                    onDragLeave={handleDragLeave}
                  >
                    {shelves.x?.map(column => (
                      <div key={column.id} className={`shelf-item ${column.type}`}>
                        <span>{column.name.split(': ')[1]}</span>
                        <button
                          className="remove-btn"
                          onClick={() => removeFromShelf('x', column.id)}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {!shelves.x?.length && <span className="shelf-placeholder">Drag columns here</span>}
                  </div>
                </div>
              </div>

              <div className="shelf-section">
                <div className="shelf-row">
                  <div className="shelf-label">Y-Axis</div>
                  <div
                    className={`shelf y-shelf ${draggedOver === 'y' ? 'dragged-over' : ''}`}
                    onDrop={(e) => handleDrop(e, 'y')}
                    onDragOver={(e) => handleDragOver(e, 'y')}
                    onDragLeave={handleDragLeave}
                  >
                    {shelves.y?.map(column => (
                      <div key={column.id} className={`shelf-item ${column.type}`}>
                        <span>{column.name.split(': ')[1]}</span>
                        <button
                          className="remove-btn"
                          onClick={() => removeFromShelf('y', column.id)}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {!shelves.y?.length && <span className="shelf-placeholder">Drag columns here</span>}
                  </div>
                </div>
              </div>

              <div className="shelf-section">
                <div className="shelf-row">
                  <div className="shelf-label">Color</div>
                  <div
                    className={`shelf color-shelf ${draggedOver === 'color' ? 'dragged-over' : ''}`}
                    onDrop={(e) => handleDrop(e, 'color')}
                    onDragOver={(e) => handleDragOver(e, 'color')}
                    onDragLeave={handleDragLeave}
                  >
                    {shelves.color?.map(column => (
                      <div key={column.id} className={`shelf-item ${column.type}`}>
                        <span>{column.name.split(': ')[1]}</span>
                        <button
                          className="remove-btn"
                          onClick={() => removeFromShelf('color', column.id)}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {!shelves.color?.length && <span className="shelf-placeholder">Drag columns here (optional)</span>}
                  </div>
                </div>
              </div>
            </div>

            <section className="interaction-config-section">
              <h4>Interactivity</h4>
              <div className="interaction-controls">
                <div className="interaction-row">
                  <label>
                    <input
                      type="checkbox"
                      checked={isInteractive}
                      onChange={(e) => setIsInteractive(e.target.checked)}
                    />
                    Enable Interactive Mode
                  </label>
                </div>

                {isInteractive && (
                  <>
                    <div className="interaction-row">
                      <label>
                        <input
                          type="checkbox"
                          checked={interactionConfig.hover?.enabled || false}
                          onChange={(e) => setInteractionConfig(prev => ({
                            ...prev,
                            hover: {
                              ...(prev.hover || {}),
                              enabled: e.target.checked
                            }
                          }))}
                        />
                        Show details on hover
                      </label>
                    </div>

                    <div className="interaction-row">
                      <label>
                        <input
                          type="checkbox"
                          checked={interactionConfig.selection?.enabled || false}
                          onChange={(e) => setInteractionConfig(prev => ({
                            ...prev,
                            selection: {
                              ...(prev.selection || { type: 'single' }),
                              enabled: e.target.checked
                            }
                          }))}
                        />
                        Enable data selection
                      </label>
                    </div>

                    {interactionConfig.selection?.enabled && (
                      <div className="interaction-row">
                        <label htmlFor="selection-type">Selection Type:</label>
                        <select
                          id="selection-type"
                          value={interactionConfig.selection.type}
                          onChange={(e) => setInteractionConfig(prev => ({
                            ...prev,
                            selection: {
                              ...prev.selection!,
                              type: e.target.value as 'single' | 'multi' | 'box'
                            }
                          }))}
                        >
                          <option value="single">Single Click</option>
                          <option value="multi">Multi Select</option>
                          {chartType === 'point' && <option value="box">Box Select</option>}
                        </select>
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>
          </div>

          {/* Bottom: Available Data */}
          <div className="shelf-editor-data">
            {availableInstances.length === 0 && (
              <p className="no-data">Create table instances first</p>
            )}
            {availableColumns.length === 0 && availableInstances.length > 0 && (
              <p className="no-data">No compatible data found</p>
            )}

            {/* Filter UI */}
            {filterOptions.length > 1 && (
              <div className="filter-section">
                <label htmlFor="column-filter" className="filter-label">Filter by:</label>
                <select
                  id="column-filter"
                  className="filter-dropdown"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  {filterOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="columns-list">
              {filteredColumns.map(column => {
                const profileText = column.profile ? (() => {
                  if (column.type === 'numeral' && column.profile.min !== undefined) {
                    return `${column.profile.uniqueValues} unique • ${column.profile.min.toFixed(1)}-${column.profile.max!.toFixed(1)}`;
                  } else if (column.profile.topValues) {
                    return `${column.profile.uniqueValues} unique • ${column.profile.topValues.slice(0, 2).join(', ')}${column.profile.topValues.length > 2 ? '...' : ''}`;
                  }
                  return `${column.profile.uniqueValues} unique`;
                })() : '';

                return (
                  <div
                    key={column.id}
                    className={`column-item ${column.type}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, column)}
                    title={`${column.instanceType}: ${column.name} (${column.type})\n${profileText}`}
                  >
                    <div className="column-header">
                      <span className="column-icon">
                        {column.type === 'numeral' ? '#' : 'Abc'}
                      </span>
                      <span className="column-name">{column.name}</span>
                    </div>
                    {column.profile && (
                      <div className="column-profile">
                        {profileText}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Panel: Visualization */}
        <div className="shelf-editor-right">
          <div className="preview-container">
            {generateSpec ? (
              <VisualizationRenderer
                spec={generateSpec}
                onImageUrlReady={handleImageUrlReady}
              />
            ) : (
              <div className="no-preview">
                {availableColumns.length === 0
                  ? "Create table instances with data first"
                  : "Drag columns to X or Y axis to see preview"
                }
              </div>
            )}
          </div>
          {generateSpec && (
            <div style={{
              fontSize: '0.75rem',
              color: '#666',
              padding: '0.75rem',
              borderTop: '1px solid #eee',
              maxHeight: '120px',
              overflow: 'auto'
            }}>
              <details>
                <summary style={{ cursor: 'pointer' }}>Show Generated Spec</summary>
                <pre style={{ fontSize: '0.65rem', margin: '0.5rem 0 0 0', whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(generateSpec, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ShelfVisualizationEditor;