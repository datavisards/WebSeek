/**
 * Benchmark Task Type Definitions
 */

export type TaskCategory = 
  | 'Discovery' 
  | 'Extraction & Wrangling' 
  | 'Profiling & Cleaning'
  | 'Modeling & Visualization' 
  | 'Composite';

export type TaskDifficulty = 'Easy' | 'Medium' | 'Hard';

export interface ToolCall {
  function: string;
  parameters: Record<string, any>;
}

export interface ToolSequence {
  goal: string;
  steps: Array<{
    description: string;
    toolCall: ToolCall;
  }>;
}

export interface BenchmarkTask {
  task_id: string;
  task_category: TaskCategory;
  difficulty: TaskDifficulty;
  goal_description: string;
  
  // Static Context
  starting_url: string;
  html_context: string;
  initial_canvas_state: {
    instances: any[]; // Instance[] from WebSeek types
    focus_instance_id?: string;
  };
  conversation_history: any[]; // Message[] from WebSeek types
  recent_logs: string[];
  
  // Ground Truth
  golden_tool_sequence: ToolCall[];
  golden_final_state?: {
    instances: any[];
  };
  alternative_sequences?: ToolCall[][];
  
  // Metadata
  expected_complexity: number; // Expected tool call count
  requires_html_analysis: boolean;
  requires_instance_analysis: boolean;
  
  // Annotations
  created_by?: string;
  validated_by?: string[];
  notes?: string;
}

export interface EvaluationResult {
  task_id: string;
  system: 'webseek' | 'baseline';
  
  // Generated Output
  generated_sequence: ToolCall[];
  execution_time_ms: number;
  step_count: number;
  
  // Validation Results
  is_valid: boolean;
  validation_errors: string[];
  
  // Metrics
  tool_selection_precision: number;
  tool_selection_recall: number;
  tool_selection_f1: number;
  parameter_accuracy: number;
  perfect_match: boolean;
  
  // LLM Judge Scores (0-5)
  llm_judge_completion: number;
  llm_judge_accuracy: number;
  llm_judge_efficiency: number;
  llm_judge_average: number;
  
  // Human Scores (optional, for 20% validation)
  human_judge_completion?: number;
  human_judge_accuracy?: number;
  human_judge_efficiency?: number;
  human_judge_average?: number;
  
  // Metadata
  timestamp: string;
  model_used: string;
  error_message?: string;
}

export interface AggregateMetrics {
  system: 'webseek' | 'baseline';
  total_tasks: number;
  
  // Overall Performance
  avg_f1_score: number;
  avg_parameter_accuracy: number;
  avg_execution_time_ms: number;
  avg_step_count: number;
  perfect_match_rate: number;
  task_success_rate: number;
  
  // LLM Judge Scores
  avg_llm_completion: number;
  avg_llm_accuracy: number;
  avg_llm_efficiency: number;
  avg_llm_overall: number;
  
  // Per-Category Breakdown
  by_category: Record<TaskCategory, {
    count: number;
    avg_f1: number;
    avg_parameter_accuracy: number;
    task_success_rate: number;
  }>;
  
  // Per-Difficulty Breakdown
  by_difficulty: Record<TaskDifficulty, {
    count: number;
    avg_f1: number;
    avg_parameter_accuracy: number;
    task_success_rate: number;
  }>;
  
  // Error Analysis
  common_errors: Array<{
    error_type: string;
    count: number;
    percentage: number;
  }>;
}

export interface ComparisonMetrics {
  webseek: AggregateMetrics;
  baseline: AggregateMetrics;
  
  // Delta Metrics
  delta_f1: number;
  delta_parameter_accuracy: number;
  delta_step_count: number;
  delta_execution_time: number;
  
  // Statistical Tests
  t_test_f1: {
    statistic: number;
    p_value: number;
    significant: boolean; // p < 0.05
  };
  cohens_d: number;
  
  // Win/Tie/Loss
  win_tie_loss: {
    webseek_wins: number;
    ties: number;
    baseline_wins: number;
  };
}
