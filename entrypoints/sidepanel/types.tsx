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
  columnTypes: ColumnType[]; // Required: column types for each column
  columnNames: string[]; // Required: column names for each column
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

// ─────────────────────────────────────────────────────────────────────────────
// Typed Tool Call API (Table 3 in the CHI paper)
// ─────────────────────────────────────────────────────────────────────────────

export interface FilterCondition {
  column: string;
  operator: '>' | '>=' | '<' | '<=' | 'equals' | 'contains' | 'not_equals' | 'not_contains';
  value: string | number;
}

export type ToolCall =
  | { function: 'openPage'; parameters: { url: string; description: string; openInBackground?: boolean } }
  | { function: 'selectElements'; parameters: { selector: string; pageUrl: string } }
  | { function: 'inferSchema'; parameters: { pageUrl: string; targetElement: string } }
  | { function: 'extractBatch'; parameters: { pageUrl: string; pattern: string; maxItems?: number } }
  | { function: 'updateInstance'; parameters: { instanceId: string; newInstance: Instance } }
  | { function: 'addComputedColumn'; parameters: { instanceId: string; formula: string; newColumnName: string } }
  | { function: 'tableSort'; parameters: { instanceId: string; columnName: string; order: 'asc' | 'desc'; secondarySort?: { column: string; order: 'asc' | 'desc' } } }
  | { function: 'tableFilter'; parameters: { instanceId: string; conditions: FilterCondition[]; operator?: 'AND' | 'OR' } }
  | { function: 'renameColumn'; parameters: { instanceId: string; oldColumnName: string; newColumnName: string } }
  | { function: 'formatColumn'; parameters: { instanceId: string; columnName: string; formatPattern: string } }
  | { function: 'searchAndReplace'; parameters: { instanceId: string; searchPattern: string; replaceWith: string; useRegex?: boolean; columnName?: string } }
  | { function: 'mergeInstances'; parameters: { sourceInstanceIds: [string, string]; mergeStrategy: 'append' | 'union' | 'inner_join' | 'left_join' | 'right_join'; joinColumns?: { leftColumn: string; rightColumn: string }; newInstanceName?: string } }
  | { function: 'convertColumnType'; parameters: { instanceId: string; columnName: string; targetType: 'numerical' | 'categorical'; cleaningPattern?: string; replaceWith?: string } }
  | { function: 'fillMissingValues'; parameters: { instanceId: string; columnName: string; strategy: 'mean' | 'median' | 'mode' | 'forward_fill' | 'backward_fill' | 'constant' | 'interpolate'; constantValue?: string; missingIndicators?: string[] } }
  | { function: 'createVisualization'; parameters: { sourceInstanceId: string; chartType: 'bar' | 'line' | 'scatter' | 'histogram'; xAxis: string; yAxis?: string; title?: string } };

// Proactive suggestion - reuse existing chatWithAgent response format
// Suggestion scope classification
export type SuggestionScope = 'micro' | 'macro';

// Presentation modality classification
export type PresentationModality = 'in-situ' | 'peripheral';

// Suggestion priority level
export type SuggestionPriority = 'high' | 'medium' | 'low';

// Enhanced ProactiveSuggestion interface
export interface ProactiveSuggestion {
  id: string; // Unique identifier for tracking
  message: string; // Brief description of what this suggestion will do
  detailedDescription?: string; // More detailed explanation for peripheral suggestions
  instances: InstanceEvent[]; // Instance updates to apply
  scope: SuggestionScope; // micro or macro
  modality: PresentationModality; // in-situ or peripheral
  priority: SuggestionPriority; // high, medium, or low
  confidence: number; // AI confidence score (0-1)
  contextualData?: any; // Additional context for the suggestion
  triggerEvent?: string; // What user action triggered this suggestion
  estimatedImpact?: string; // Brief description of what will change
  category: string; // Category like 'data-extraction', 'data-cleaning', etc.
  timestamp: number; // When the suggestion was created
  undoable: boolean; // Whether this suggestion can be undone
  isLoading?: boolean; // Whether this suggestion is currently being processed/refined
  loadingMessage?: string; // Optional custom loading message
  toolCall?: ToolCall; // Optional single tool call for simple macro suggestions
  toolSequence?: { // Optional tool sequence for composite macro suggestions
    goal: string; // High-level goal description (e.g., "Sort table by price")
    steps: Array<{
      description: string; // Human-readable step description (e.g., "Convert 'Price' column to numbers")
      toolCall: ToolCall;
    }>;
  };
}

// User action types that can trigger suggestions
export interface UserActionEvent {
  type: string; // Type of action (e.g., 'element-selected', 'cell-edited', 'table-created')
  timestamp: number;
  context: any; // Context data relevant to the action
  instanceId?: string; // ID of the instance being acted upon
  metadata?: any; // Additional metadata
}

// Trigger rule for when to generate suggestions
export interface SuggestionTriggerRule {
  id: string;
  name: string;
  description: string;
  pattern: (events: UserActionEvent[], context: any) => boolean;
  /**
   * Optional confidence scorer (Section 5.1.2). Returns a value in [0, 1].
   * Higher values mean the suggestion is more likely to be relevant.
   * Used to sort and filter suggestions before display.
   * If omitted, a default score based on priority is used.
   */
  confidenceScore?: (events: UserActionEvent[], context: any) => number;
  suggestionType: string;
  scope: SuggestionScope;
  modality: PresentationModality;
  priority: SuggestionPriority;
  debounceMs?: number; // Optional debounce time
}

