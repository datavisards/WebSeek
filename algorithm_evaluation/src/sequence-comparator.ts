/**
 * Sequence Comparator - Compares generated tool sequences against golden sequences
 */

import { ToolCall } from './types';
import { MACRO_TOOLS } from '../../entrypoints/sidepanel/macro-tools';

export interface ComparisonResult {
  perfect_match: boolean;
  tool_selection_precision: number;
  tool_selection_recall: number;
  tool_selection_f1: number;
  parameter_accuracy: number;
  step_count_diff: number;
  matched_tools: number;
  total_generated: number;
  total_golden: number;
  detailed_comparison: Array<{
    index: number;
    generated_tool: string | null;
    golden_tool: string | null;
    match: boolean;
    parameter_errors: string[];
  }>;
}

/**
 * Compare a generated tool sequence against the golden sequence
 */
export function compareSequences(
  generated: ToolCall[],
  golden: ToolCall[]
): ComparisonResult {
  // Check for perfect match first
  const perfect_match = sequencesAreIdentical(generated, golden);
  
  // Calculate tool selection metrics
  const generatedTools = new Set(generated.map(tc => tc.function));
  const goldenTools = new Set(golden.map(tc => tc.function));
  
  const matchedTools = [...generatedTools].filter(tool => goldenTools.has(tool)).length;
  const precision = generatedTools.size > 0 ? matchedTools / generatedTools.size : 0;
  const recall = goldenTools.size > 0 ? matchedTools / goldenTools.size : 0;
  const f1 = (precision + recall) > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
  
  // Detailed step-by-step comparison
  const maxLength = Math.max(generated.length, golden.length);
  const detailed_comparison: ComparisonResult['detailed_comparison'] = [];
  
  let totalParams = 0;
  let correctParams = 0;
  
  for (let i = 0; i < maxLength; i++) {
    const gen = generated[i];
    const gold = golden[i];
    
    const match = gen && gold && gen.function === gold.function;
    const parameter_errors: string[] = [];
    
    if (gen && gold && match) {
      // Compare parameters
      const { total, correct, errors } = compareParameters(gen, gold);
      totalParams += total;
      correctParams += correct;
      parameter_errors.push(...errors);
    }
    
    detailed_comparison.push({
      index: i,
      generated_tool: gen?.function || null,
      golden_tool: gold?.function || null,
      match: match || false,
      parameter_errors
    });
  }
  
  const parameter_accuracy = totalParams > 0 ? correctParams / totalParams : 0;
  
  return {
    perfect_match,
    tool_selection_precision: precision,
    tool_selection_recall: recall,
    tool_selection_f1: f1,
    parameter_accuracy,
    step_count_diff: generated.length - golden.length,
    matched_tools: matchedTools,
    total_generated: generated.length,
    total_golden: golden.length,
    detailed_comparison
  };
}

/**
 * Check if two sequences are perfectly identical
 */
function sequencesAreIdentical(seq1: ToolCall[], seq2: ToolCall[]): boolean {
  if (seq1.length !== seq2.length) return false;
  
  for (let i = 0; i < seq1.length; i++) {
    if (seq1[i].function !== seq2[i].function) return false;
    if (!parametersAreEqual(seq1[i].parameters, seq2[i].parameters)) return false;
  }
  
  return true;
}

/**
 * Compare parameters of two tool calls
 */
function compareParameters(
  generated: ToolCall,
  golden: ToolCall
): { total: number; correct: number; errors: string[] } {
  const errors: string[] = [];
  
  // Get tool definition to know which parameters are required
  const toolDef = MACRO_TOOLS.find(t => t.name === golden.function);
  if (!toolDef) {
    return { total: 0, correct: 0, errors: ['Unknown tool'] };
  }
  
  const requiredParams = toolDef.parameters.filter(p => p.required);
  let total = 0;
  let correct = 0;
  
  // Check required parameters
  for (const param of requiredParams) {
    total++;
    const genValue = generated.parameters[param.name];
    const goldValue = golden.parameters[param.name];
    
    if (genValue === undefined) {
      errors.push(`Missing required parameter: ${param.name}`);
    } else if (valuesAreEqual(genValue, goldValue)) {
      correct++;
    } else {
      errors.push(`Incorrect value for ${param.name}: expected ${JSON.stringify(goldValue)}, got ${JSON.stringify(genValue)}`);
    }
  }
  
  // Check optional parameters that are present in golden
  for (const [key, goldValue] of Object.entries(golden.parameters)) {
    const paramDef = toolDef.parameters.find(p => p.name === key);
    if (paramDef && !paramDef.required) {
      total++;
      const genValue = generated.parameters[key];
      if (valuesAreEqual(genValue, goldValue)) {
        correct++;
      } else {
        errors.push(`Incorrect optional parameter ${key}: expected ${JSON.stringify(goldValue)}, got ${JSON.stringify(genValue)}`);
      }
    }
  }
  
  return { total, correct, errors };
}

/**
 * Check if two parameter values are equal
 */
function parametersAreEqual(params1: Record<string, any>, params2: Record<string, any>): boolean {
  const keys1 = Object.keys(params1).sort();
  const keys2 = Object.keys(params2).sort();
  
  if (keys1.length !== keys2.length) return false;
  if (!keys1.every((key, i) => key === keys2[i])) return false;
  
  for (const key of keys1) {
    if (!valuesAreEqual(params1[key], params2[key])) return false;
  }
  
  return true;
}

/**
 * Deep equality check for parameter values
 */
function valuesAreEqual(val1: any, val2: any): boolean {
  if (val1 === val2) return true;
  
  if (typeof val1 !== typeof val2) return false;
  
  if (Array.isArray(val1) && Array.isArray(val2)) {
    if (val1.length !== val2.length) return false;
    return val1.every((v, i) => valuesAreEqual(v, val2[i]));
  }
  
  if (typeof val1 === 'object' && val1 !== null && val2 !== null) {
    return parametersAreEqual(val1, val2);
  }
  
  return false;
}

/**
 * Calculate aggregate metrics across multiple task results
 */
export function calculateAggregateMetrics(
  results: ComparisonResult[]
): {
  avg_f1: number;
  avg_precision: number;
  avg_recall: number;
  avg_parameter_accuracy: number;
  perfect_match_rate: number;
  avg_step_count_diff: number;
} {
  const n = results.length;
  
  if (n === 0) {
    return {
      avg_f1: 0,
      avg_precision: 0,
      avg_recall: 0,
      avg_parameter_accuracy: 0,
      perfect_match_rate: 0,
      avg_step_count_diff: 0
    };
  }
  
  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
  
  return {
    avg_f1: sum(results.map(r => r.tool_selection_f1)) / n,
    avg_precision: sum(results.map(r => r.tool_selection_precision)) / n,
    avg_recall: sum(results.map(r => r.tool_selection_recall)) / n,
    avg_parameter_accuracy: sum(results.map(r => r.parameter_accuracy)) / n,
    perfect_match_rate: results.filter(r => r.perfect_match).length / n,
    avg_step_count_diff: sum(results.map(r => Math.abs(r.step_count_diff))) / n
  };
}
