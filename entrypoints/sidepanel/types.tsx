export interface EmbeddedTextInstance {
  type: 'text';
  content: string;
  id: string;
  originalId?: string;
}

export interface EmbeddedImageInstance {
  type: 'image';
  src: string;
  id: string;
  originalId?: string;
}

export interface EmbeddedSketchInstance {
  type: 'sketch';
  id: string;
  originalId?: string;
}

export interface EmbeddedTableInstance extends TableInstance {
  originalId?: string;
}

export interface VisualizationInstance {
  id: string;
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

export type EmbeddedInstance =
  | EmbeddedTextInstance
  | EmbeddedImageInstance
  | EmbeddedSketchInstance
  | EmbeddedTableInstance
  | VisualizationInstance;

export type TextInstance = {
  id: string;
  type: 'text';
  content: string;
  x?: number; // default: 0
  y?: number; // default: 0
  width?: number; // default: 100
  height?: number; // default: 20
  sourcePageId?: string;
};

export type ImageInstance = {
  id: string;
  type: 'image';
  src: string;
  x?: number; // default: 0
  y?: number; // default: 0
  width?: number; // default: 100
  height?: number; // default: 100
  sourcePageId?: string;
};

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
    id: string;
    instance: EmbeddedInstance;
    x: number;
    y: number;
    width: number;
    height: number;
  };

export type SketchInstance = {
  id: string;
  type: 'sketch';
  x?: number; // default: 0
  y?: number; // default: 0
  width?: number; // default: 400
  height?: number; // default: 300
  content: SketchItem[];
  thumbnail?: string;
  sourcePageId?: string;
};

export type TableInstance = {
  id: string;
  type: 'table';
  rows: number;
  cols: number;
  cells: Array<Array<EmbeddedInstance | null>>;
  x?: number; // default: 0
  y?: number; // default: 0
  width?: number; // default: 400
  height?: number; // default: 300
  sourcePageId?: string;
};

export type Instance = TextInstance | ImageInstance | SketchInstance | TableInstance | VisualizationInstance;

export interface Message {
  role: string;
  message: string;
}