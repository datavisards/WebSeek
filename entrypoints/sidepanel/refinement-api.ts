import { chatWithAgent } from './apis';
import { createRuleBasedSuggestionPrompt } from './prompts';
import { Message, Instance } from './types';

/**
 * Specialized API wrapper for suggestion refinement
 * Returns a single refined suggestion instead of an array
 */
export async function requestSuggestionRefinement(
  originalSuggestion: { id: string; message: string; category?: string },
  failedToolCall: { function: string; parameters: any },
  errorMessage: string,
  context: {
    messages: Message[];
    instances: Instance[];
    htmlContext: Record<string, {pageURL: string, htmlContent: string}>;
    logs: string[];
  }
): Promise<{
  success: boolean;
  message: string;
  refinedSuggestion?: {
    message: string;
    scope: string;
    modality: string;
    priority: string;
    confidence: number;
    category: string;
    toolCall?: any;
    toolSequence?: any;
  };
  error?: string;
}> {
  try {
    console.log('[RefinementAPI] Processing refinement request for suggestion:', originalSuggestion.id);

    // Create refinement rules for the macro suggestion system
    const refinementRules = [{
      id: 'refinement-suggestion',
      name: 'Suggestion Refinement',
      description: 'Refine failed tool suggestion with corrected parameters',
      priority: 'high',
      scope: 'macro'
    }];
    
    const refinementUserMessage = `SUGGESTION REFINEMENT REQUEST

ORIGINAL SUGGESTION: "${originalSuggestion.message}"

FAILED TOOL CALL:
${JSON.stringify(failedToolCall, null, 2)}

ERROR MESSAGE: "${errorMessage}"

ANALYSIS REQUIRED:
Please analyze the error and identify what went wrong. Common issues:
1. Incorrect column references (using column letters like "C" instead of actual column names like "Price")
2. Invalid instance IDs or non-existent resources
3. Malformed tool parameters
4. Wrong data types or formats

REFINEMENT TASK:
Provide a corrected macro suggestion that addresses the same goal but fixes the parameter errors. 

IMPORTANT: Return exactly ONE suggestion that:
- Uses correct column names from the table structure
- References valid instance IDs
- Provides working tool parameters
- Accomplishes the same goal as the original suggestion

The refined suggestion should accomplish: "${originalSuggestion.message}"`;

    // Use the macro suggestion generation system for refinement
    const refinementPrompt = createRuleBasedSuggestionPrompt(
      'macro', 
      refinementRules, 
      [], // No recent actions needed for refinement
      context.logs.slice(-5), // Include recent logs for context
      new Map(), // No suggestion history for refinement
      undefined // No specific workspace name needed
    );

    // Call the LLM API for suggestion refinement using the macro system
    const result = await chatWithAgent(
      'suggest', // Use suggest ChatType but with macro-formatted prompt
      `${refinementPrompt}\n\nUSER REQUEST:\n${refinementUserMessage}`,
      context.messages, // Include conversation history
      JSON.stringify(context.instances), // Current instance context
      [], // No image context needed for refinement
      context.htmlContext, // Include HTML context
      context.logs // Include recent logs
    );

    console.log('[RefinementAPI] Raw LLM response:', result);

    if (!result.suggestions || result.suggestions.length === 0) {
      return {
        success: false,
        message: 'No refined suggestions received from LLM',
        error: 'LLM did not provide any refined suggestions'
      };
    }

    // Extract the first (and should be only) suggestion
    const refinedSuggestion = result.suggestions[0];
    
    // Validate the refined suggestion
    if (!refinedSuggestion.message) {
      return {
        success: false,
        message: 'Invalid refined suggestion received',
        error: 'Refined suggestion missing required message field'
      };
    }

    return {
      success: true,
      message: `Successfully refined suggestion: ${refinedSuggestion.message}`,
      refinedSuggestion: {
        message: refinedSuggestion.message,
        scope: refinedSuggestion.scope || 'macro',
        modality: refinedSuggestion.modality || 'peripheral', 
        priority: refinedSuggestion.priority || 'high',
        confidence: refinedSuggestion.confidence || 0.9, // Higher confidence for refined suggestions
        category: refinedSuggestion.category || originalSuggestion.category || 'refinement',
        toolCall: refinedSuggestion.toolCall,
        toolSequence: refinedSuggestion.toolSequence
      }
    };

  } catch (error) {
    console.error('[RefinementAPI] Error in refinement request:', error);
    return {
      success: false,
      message: 'Error occurred during suggestion refinement',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
