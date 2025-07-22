/**
 * Type definitions for WebSeek sidepanel components and data structures.
 * This file defines the core data types used throughout the application.
 */

/**
 * Represents an embedded text instance that can be placed within other components.
 * Used for text content that is embedded in tables, sketches, or other containers.
 */
export interface EmbeddedTextInstance {
  type: 'text';
  content: string; // The actual text content
  id: string; // Unique identifier for this instance
  originalId?: string; // Optional reference to the original instance if this is a copy
}

/**
 * Represents an embedded image instance that can be placed within other components.
 * Used for images that are embedded in tables, sketches, or other containers.
 */
export interface EmbeddedImageInstance {
  type: 'image';
  src: string; // Source URL or data URI for the image
  id: string; // Unique identifier for this instance
  originalId?: string; // Optional reference to the original instance if this is a copy
}

/**
 * Represents an embedded sketch instance that can be placed within other components.
 * Used for sketches that are embedded in tables or other containers.
 */
export interface EmbeddedSketchInstance {
  type: 'sketch';
  id: string; // Unique identifier for this instance
  originalId?: string; // Optional reference to the original instance if this is a copy
}

/**
 * Represents an embedded table instance that can be placed within other components.
 * Extends the base TableInstance with optional originalId for tracking copies.
 */
export interface EmbeddedTableInstance extends TableInstance {
  originalId?: string; // Optional reference to the original instance if this is a copy
}

/**
 * Represents a visualization instance with declarative specification.
 * Used for charts, graphs, and other data visualizations.
 */
export interface VisualizationInstance {
  id: string; // Unique identifier for this instance
  type: 'visualization';
  /**
   * The visualization specification, ideally in Vega-Lite or similar declarative grammar.
   * This should be a JSON object (parsed) or a string (raw spec), depending on usage.
   */
  spec: object;
  /**
   * Optional thumbnail image (base64 or URL) for quick preview.
   */
  thumbnail?: string;
  /**
   * Optional original instance id (for duplication/traceability).
   */
  originalId?: string;
  /**
   * Optional width and height for layout.
   */
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

/**
 * Union type representing any embedded instance that can be placed within containers.
 * This includes text, images, sketches, tables, and visualizations.
 */
export type EmbeddedInstance =
  | EmbeddedTextInstance
  | EmbeddedImageInstance
  | EmbeddedSketchInstance
  | EmbeddedTableInstance
  | VisualizationInstance;

/**
 * Represents a standalone text instance that can be placed on a canvas or page.
 * Text instances have positioning and sizing properties for layout.
 */
export type TextInstance = {
  id: string; // Unique identifier for this instance
  type: 'text';
  content: string; // The actual text content
  x?: number; // X coordinate position (default: 0)
  y?: number; // Y coordinate position (default: 0)
  width?: number; // Width of the text container (default: 100)
  height?: number; // Height of the text container (default: 20)
  sourcePageId?: string; // Optional reference to the source page if copied from elsewhere
};

/**
 * Represents a standalone image instance that can be placed on a canvas or page.
 * Image instances have positioning and sizing properties for layout.
 */
export type ImageInstance = {
  id: string; // Unique identifier for this instance
  type: 'image';
  src: string; // Source URL or data URI for the image
  x?: number; // X coordinate position (default: 0)
  y?: number; // Y coordinate position (default: 0)
  width?: number; // Width of the image (default: 100)
  height?: number; // Height of the image (default: 100)
  sourcePageId?: string; // Optional reference to the source page if copied from elsewhere
};

/**
 * Represents individual items within a sketch.
 * A sketch can contain both freehand strokes and embedded instances.
 */
export type SketchItem =
  | {
    type: 'stroke'; // Freehand drawing stroke
    id: string; // Unique identifier for this stroke
    points: Array<{ x: number; y: number }>; // Array of points defining the stroke path
    color: string; // Color of the stroke
    width: number; // Width/thickness of the stroke
  }
  | {
    type: 'instance'; // Embedded instance within the sketch
    id: string; // Unique identifier for this instance
    instance: EmbeddedInstance; // The embedded instance (text, image, etc.)
    x: number; // X coordinate within the sketch
    y: number; // Y coordinate within the sketch
    width: number; // Width of the instance within the sketch
    height: number; // Height of the instance within the sketch
  };

/**
 * Represents a sketch instance that can be placed on a canvas or page.
 * Sketches can contain both freehand drawings and embedded instances.
 */
export type SketchInstance = {
  id: string; // Unique identifier for this instance
  type: 'sketch';
  x?: number; // X coordinate position (default: 0)
  y?: number; // Y coordinate position (default: 0)
  width?: number; // Width of the sketch container (default: 400)
  height?: number; // Height of the sketch container (default: 300)
  content: SketchItem[]; // Array of sketch items (strokes and embedded instances)
  thumbnail?: string; // Optional thumbnail image for preview
  sourcePageId?: string; // Optional reference to the source page if copied from elsewhere
};

/**
 * Represents a table instance that can be placed on a canvas or page.
 * Tables contain a grid of cells, each of which can hold embedded instances.
 */
export type TableInstance = {
  id: string; // Unique identifier for this instance
  type: 'table';
  rows: number; // Number of rows in the table
  cols: number; // Number of columns in the table
  cells: Array<Array<EmbeddedInstance | null>>; // 2D array of cells, each can contain an embedded instance or be null
  x?: number; // X coordinate position (default: 0)
  y?: number; // Y coordinate position (default: 0)
  width?: number; // Width of the table (default: 400)
  height?: number; // Height of the table (default: 300)
  sourcePageId?: string; // Optional reference to the source page if copied from elsewhere
};

/**
 * Union type representing any instance that can be placed on a canvas or page.
 * This is the main type used throughout the application for all content types.
 */
export type Instance = TextInstance | ImageInstance | SketchInstance | TableInstance | VisualizationInstance;

/**
 * Represents a message in a conversation or chat interface.
 * Used for communication between components or with external services.
 */
export interface Message {
  role: string; // Role of the message sender (e.g., 'user', 'assistant', 'system')
  message: string; // The actual message content
}