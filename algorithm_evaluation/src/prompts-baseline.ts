/**
 * Baseline Prompt for Generic GPT-4 Agent
 * 
 * This prompt represents a generic AI agent with access to the same tools as WebSeek,
 * but without WebSeek's domain-specific optimizations and embedded heuristic rules.
 */

import { generateToolDocumentation } from '../../entrypoints/sidepanel/macro-tools';

export const createBaselinePrompt = (
  htmlContext: string,
  instanceContext: string,
  goalDescription: string,
  conversationHistory: any[],
  recentLogs: string[],
  currentPageInfo: { pageId: string; url: string } | null
): string => {
  return `
You are a helpful AI assistant with access to data manipulation tools.
The user is working on a data-driven task using a browser extension called WebSeek.

**USER'S GOAL**: ${goalDescription}

## Current Context

**Current Webpage**: ${currentPageInfo ? `${currentPageInfo.url} (ID: ${currentPageInfo.pageId})` : 'No page loaded'}

**HTML Content**:
\`\`\`html
${htmlContext}
\`\`\`

**Existing Data Instances on Canvas**:
${instanceContext}

**Recent User Actions**:
${recentLogs.join('\n')}

${conversationHistory.length > 0 ? `**Conversation History**:
${conversationHistory.map((msg: any) => `${msg.role}: ${msg.content}`).join('\n')}` : ''}

## Available Tools

You have access to the following data manipulation tools:

${generateToolDocumentation()}

## Your Task

Analyze the user's goal and the provided context. Generate a sequence of tool calls that will help the user achieve their goal.

**Response Format**:
Return ONLY a valid JSON object with the following structure:

\`\`\`json
{
  "analysis": "Brief explanation of your approach",
  "tool_sequence": [
    {
      "function": "toolName",
      "parameters": {
        "param1": "value1",
        "param2": "value2"
      }
    }
  ]
}
\`\`\`

**Important Guidelines**:
1. Use ONLY the tools listed above
2. Ensure all required parameters are provided
3. Reference actual instance IDs from the context
4. Use exact column names from table structures
5. Keep the sequence as efficient as possible (minimal steps)
6. Ensure tool calls are in the correct order (handle dependencies)

Generate the optimal tool sequence for the user's goal.
`.trim();
};

/**
 * Call baseline agent (generic GPT-4)
 */
export async function callBaselineAgent(
  apiKey: string,
  htmlContext: string,
  instanceContext: string,
  goalDescription: string,
  conversationHistory: any[],
  recentLogs: string[],
  currentPageInfo: { pageId: string; url: string } | null
): Promise<{
  tool_sequence: any[];
  execution_time_ms: number;
  error?: string;
}> {
  const startTime = Date.now();
  
  try {
    const prompt = createBaselinePrompt(
      htmlContext,
      instanceContext,
      goalDescription,
      conversationHistory,
      recentLogs,
      currentPageInfo
    );
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful AI assistant specialized in data manipulation and analysis.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 4096
      })
    });
    
    const data = await response.json();
    const execution_time_ms = Date.now() - startTime;
    
    if (!response.ok) {
      return {
        tool_sequence: [],
        execution_time_ms,
        error: data.error?.message || 'API request failed'
      };
    }
    
    const content = data.choices[0].message.content;
    
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        tool_sequence: [],
        execution_time_ms,
        error: 'Failed to parse JSON response'
      };
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      tool_sequence: parsed.tool_sequence || [],
      execution_time_ms
    };
    
  } catch (error: any) {
    return {
      tool_sequence: [],
      execution_time_ms: Date.now() - startTime,
      error: error.message
    };
  }
}
