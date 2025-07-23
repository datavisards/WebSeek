/**
 * Type definitions for WebSeek sidepanel components and data structures.
 * This file defines the core data types used throughout the application.
 */

/**
 * Describes the source of an instance captured from a webpage.
 */
export interface WebCaptureSource {
  type: 'web';
  /** The internal ID of the page record where the full HTML is stored. */
  pageId: string;
  /** The public URL of the source webpage for navigation. */
  url: string;
  /** A CSS selector to precisely locate the element on the page. */
  selector: string;
  /** A minimal HTML snippet for AI context (max 500 chars). */
  htmlSnippet?: string;
  /** Unique identifier for the element (id, data-* attribute, or generated). */
  elementId?: string;
  /** ISO timestamp of when the capture was made. */
  capturedAt: string;
}

/**
 * Describes the source of an instance created manually by the user.
 */
export interface ManualSource {
  type: 'manual';
  /** ISO timestamp of when the instance was created. */
  createdAt: string;
}

/**
 * A union type representing the origin of any instance.
 * This is the key to distinguishing between created and captured content.
 */
export type InstanceSource = WebCaptureSource | ManualSource;

/**
 * A new base interface to establish common properties for all instances,
 * reducing repetition and ensuring consistency.
 */
export interface BaseInstance {
  /** Unique identifier for this instance. */
  id: string;
  /** The explicit source of the instance. This is NOT optional. */
  source: InstanceSource;
  /** Optional reference to the original instance if this is a copy. */
  originalId?: string;
}

// --- Embedded Instances ---

export interface EmbeddedTextInstance extends BaseInstance {
  type: 'text';
  content: string;
}

export interface EmbeddedImageInstance extends BaseInstance {
  type: 'image';
  src: string; // Source URL or data URI for the image
}

export interface EmbeddedSketchInstance extends BaseInstance {
  type: 'sketch';
  // A sketch embedded within another container might not have its own content
  // if it's just a reference. If it contains data, add content property.
}

export interface EmbeddedTableInstance extends TableInstance {
  // `TableInstance` will also extend `BaseInstance`, so `source` is inherited.
}

export interface EmbeddedVisualizationInstance extends VisualizationInstance {
  // `VisualizationInstance` will also extend `BaseInstance`.
}

/** Union type for any embedded instance. */
export type EmbeddedInstance =
  | EmbeddedTextInstance
  | EmbeddedImageInstance
  | EmbeddedSketchInstance
  | EmbeddedTableInstance
  | EmbeddedVisualizationInstance;


// --- Standalone Instances ---

export interface TextInstance extends BaseInstance {
  type: 'text';
  content: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface ImageInstance extends BaseInstance {
  type: 'image';
  src: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export type SketchItem =
  | {
    type: 'stroke';
    id: string;
    points: Array<{ x: number; y: number }>;
    color: string;
    width: number;
  }
  | {
    type: 'instance';
    id: string; // ID for the container item itself
    instance: EmbeddedInstance; // The embedded instance now carries its own source
    x: number;
    y: number;
    width: number;
    height: number;
  };

export interface SketchInstance extends BaseInstance {
  type: 'sketch';
  content: SketchItem[];
  thumbnail?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface TableInstance extends BaseInstance {
  type: 'table';
  rows: number;
  cols: number;
  cells: Array<Array<EmbeddedInstance | null>>;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface VisualizationInstance extends BaseInstance {
  type: 'visualization';
  spec: object;
  thumbnail?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

/** The main union type for all standalone instances. */
export type Instance = TextInstance | ImageInstance | SketchInstance | TableInstance | VisualizationInstance;

// --- Other types (unchanged) ---

export interface Message {
  role: string;
  message: string;
}