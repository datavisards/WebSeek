export type EmbeddedInstance = 
  | { type: 'text'; content: string; id: string; originalId?: string }
  | { type: 'image'; src: string; id: string; originalId?: string }
  | { type: 'sketch'; id: string; originalId?: string }
  | { type: 'table'; id: string; originalId?: string };

export type TextInstance = {
  id: string;
  type: 'text';
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  sourcePageId?: string;
};

export type ImageInstance = {
  id: string;
  type: 'image';
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
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
  x: number;
  y: number;
  width: number;
  height: number;
  content: SketchItem[];
  thumbnail: string;
  sourcePageId?: string;
};

export type TableInstance = {
  id: string;
  type: 'table';
  rows: number;
  cols: number;
  cells: Array<{
    row: number;
    col: number;
    content: EmbeddedInstance[];
  }>;
  x: number;
  y: number;
  width: number;
  height: number;
  sourcePageId?: string;
};

export type Instance = TextInstance | ImageInstance | SketchInstance | TableInstance;