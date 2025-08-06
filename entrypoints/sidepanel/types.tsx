/**
 * Type definitions for WebSeek sidepanel components and data structures.
 * This file defines the core data types used throughout the application.
 */

/**
 * Simple locator using stable ID (AID) to identify elements.
 */
export type Locator = string; // Stable ID (AID)

/**
 * Describes the source of an instance captured from a webpage.
 */
export interface WebCaptureSource {
  type: 'web';
  /** The internal ID of the page record where the full HTML is stored. */
  pageId: string;
  /** A structured locator object to precisely locate the element on the page. */
  locator: Locator;
}

/**
 * Describes the source of an instance created manually by the user.
 */
export interface ManualSource {
  type: 'manual';
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

export type ColumnType = 'numeral' | 'categorical';

export interface TableInstance extends BaseInstance {
  type: 'table';
  rows: number;
  cols: number;
  cells: Array<Array<EmbeddedInstance | null>>;
  columnTypes?: ColumnType[];
  columnNames?: string[]; // Custom column names, defaults to A, B, C...
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

// --- Other types ---

export type ChatType = 'chat' | 'infer' | 'suggest';
export interface Message {
  role: string;
  message: string;
  chatType?: ChatType;
  id?: string;
  isRetrying?: boolean;
  instancesCheckpoint?: Instance[];
  operations?: string[]; // Brief operation logs like "Created table Table1", "Updated instance X"
}

export interface InstanceEvent {
  action: 'add' | 'remove' | 'update';
  targetId?: string; // The original ID of the instance being modified or removed; NOT OPTIONAL FOR 'update' and 'remove' ACTIONS
  instance?: Instance; // The new content of the instance; NOT OPTIONAL FOR 'add' and 'update' ACTIONS
}

// Proactive suggestion - reuse existing chatWithAgent response format
export interface ProactiveSuggestion {
  message: string; // Brief description of what this suggestion will do
  instances: InstanceEvent[]; // Instance updates to apply
  id: string; // Unique identifier for tracking
}

