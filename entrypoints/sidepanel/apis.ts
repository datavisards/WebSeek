import OpenAI from 'openai';
import {
    Instance,
    EmbeddedInstance,
    EmbeddedTextInstance,
    EmbeddedImageInstance,
    EmbeddedSketchInstance,
    EmbeddedTableInstance,
    Message
} from './types';
import { extractJSONFromResponse } from './utils';

const openai = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: import.meta.env.WXT_OPENROUTER_KEY,
    dangerouslyAllowBrowser: true
});
export async function parseLogWithAgent(
    selectedLogs: string[],
    instanceContexts: string,
    imageContexts: any[],
    htmlContexts: Record<string, string>,
    currentInstanceId: string | null = null,
    previousCodeContexts: string[] = [],
): Promise<{
    summary: string;
    results: any[];
}> {
    try {
        console.log(htmlContexts)
        // Extract all unique URLs from selected logs
        const urlRegex = /\bhttps?:\/\/[^\s'"<>]+\b/gi;
        const seenUrls = new Set<string>();
        const uniqueHtmlContexts: { [url: string]: string } = {};

        selectedLogs.forEach(log => {
            const urls = log.match(urlRegex) || [];
            urls.forEach(url => {
                if (!seenUrls.has(url)) {
                    seenUrls.add(url);
                    const html = htmlContexts[url];
                    if (html) {
                        uniqueHtmlContexts[url] = html;
                    }
                }
            });
        });

        // Join logs and previous contexts into strings
        const logsText = selectedLogs.join('\n');
        // const previousCodeText = previousCodeContexts.length
        //     ? previousCodeContexts.join('\n\n')
        //     : 'None';

        // Construct prompt with HTML and code context
        const prompt = `
You are an AI assistant tasked with analyzing the intent behind the instance with ID '${currentInstanceId}' created by the user. Each instance serves as an example demonstration of the user's desired tasks, i.e., an initial artifact. Your goal is to generate both a concise summary of the inferred user's intent and produce the complete output wanted by the user in structured formats (detailed below). 

The operation logs provided below contain the user's actions and interactions for building the example instance, which are only meant to help you induct the user's intent.

### Your Task:
1. Analyze the instance with ID '${currentInstanceId}' and extract the primary intent or pattern based on the user's interaction logs.
2. If needed, use the provided HTML contexts for any URLs mentioned in the logs to assist your analysis.
3. Execute the tasks based on the inferred intent and provide the results.

### Expected Response Format:
Return your response strictly as a JSON object in the following format:
{
  "summary": "A concise summary of the user's intent inferred from the provided logs.",
  "results": Instance[]
}

The type of "results" is Instance[], which is defined as follows:
interface EmbeddedTextInstance {
  type: 'text';
  content: string;
  id: string;
}

interface EmbeddedImageInstance {
  type: 'image';
  src: string;
  id: string;
}

interface EmbeddedSketchInstance {
  type: 'sketch';
  id: string;
}

interface EmbeddedTableInstance = TableInstance

type EmbeddedInstance =
  | EmbeddedTextInstance
  | EmbeddedImageInstance
  | EmbeddedSketchInstance
  | EmbeddedTableInstance;

type TextInstance = {
  id: string;
  type: 'text';
  content: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  sourcePageId?: string;
};

type ImageInstance = {
  id: string;
  type: 'image';
  src: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  sourcePageId?: string;
};

type SketchItem =
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
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  };

type SketchInstance = {
  id: string;
  type: 'sketch';
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  content: SketchItem[];
  thumbnail?: string;
  sourcePageId?: string;
};

type TableInstance = {
  id: string;
  type: 'table';
  rows: number;
  cols: number;
  cells: Array<Array<EmbeddedInstance | null>>;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  sourcePageId?: string;
};

type Instance = TextInstance | ImageInstance | SketchInstance | TableInstance;

Note:
- Do NOT escape single quotes (').
- Use double backslashes (\\\\) for special regex characters like \\s or \\d.
- You may use markdown formatting in the summary for better readability (e.g., **bold**, *italic*, \`code\`, lists).
- Do not leave any non-optional fields empty for each result instance.
- When returning one or more instances in the results, assign a meaningful, human-readable, and unique ID to each instance (e.g., 'Annual_report', 'Info_list', etc.), which will be used for rendering.

---

### Operation Logs:
${logsText}

---

### HTML Contexts (for URLs referenced above):
${Object.entries(uniqueHtmlContexts).map(([url, html]) =>
            `URL: ${url}\nHTML:\n\`\`\`html\n${html}\n\`\`\``).join('\n\n')}

---

### Instance Context:
${instanceContexts}

---

### Example:
The user captures a text instance "John Doe" (Text1) from a table on a webpage (page1). You should find the HTML of page1 from the HTML context and locate the table:

<table>
    <thead>
        <tr>
            <th>Name</th>
            <th>Age</th>
            <th>Occupation</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>John Doe</td>
            <td>35</td>
            <td>Engineer</td>
        </tr>
        <tr>
            <td>Jane Smith</td>
            <td>28</td>
            <td>Data Scientist</td>
        </tr>
        <tr>
            <td>Alice Brown</td>
            <td>42</td>
            <td>Teacher</td>
        </tr>
    </tbody>
</table>

Inference: The user's intent is to scrape all names from the table.

Response for this example:
{
  "summary": "The user intends to scrape all names from the table in the webpage.",
  "results": [
    {
      "type": "table",
      "table": {
        "rols": 10,
        "cols": 1,
        "cells": [
          [{
            "type": "text",
            "content": "John Doe",
            "originalId": "Text1"
          }], [{
            "type": "text",
            "content": "Jane Smith",
            "originalId": null
          }], [{
            "type": "text",
            "content": "Alice Brown",
            "originalId": null
          }], ...]
      }
    }
  ]
}

Now, analyze the provided logs and return the JSON response.
`.trim();

        console.log('Constructed prompt for LLM:', prompt);

        // Call the LLM
        const completion = await openai.chat.completions.create({
            model: "anthropic/claude-sonnet-4",
            messages: [
                {
                    role: "user",
                    content: [{
                        type: "text",
                        text: prompt
                    }, ...imageContexts]
                },
            ]
        });

        // Extract content from response
        const content = completion.choices[0]?.message?.content || '';
        console.log('LLM response content:', content);

        // Extract the JSON part of the response. Note that the JSON may not start with ```json
        const jsonContent = extractJSONFromResponse(content);

        if (!jsonContent) {
            console.error('No JSON found in LLM response');
            return {
                summary: 'Error: No JSON found in LLM response.',
                results: []
            };
        }

        // Return structured result
        return {
            summary: jsonContent.summary || 'Summary not provided by LLM.',
            results: jsonContent.results || []
        };
    } catch (error) {
        console.error('Error calling LLM:', error);
        return {
            summary: 'Error: Failed to communicate with the LLM.',
            results: []
        };
    }
}

export async function chatWithAgent(
    userMessage: string,
    conversationHistory: Message[],
    instanceContexts: string,
    imageContexts: any[],
    htmlContexts: Record<string, string>,
    logs: string[],
): Promise<{
    response: string;
    results?: any[];
}> {
    try {
        // Extract all unique URLs from logs and conversation history
        const urlRegex = /\bhttps?:\/\/[^\s'"<>]+\b/gi;
        const seenUrls = new Set<string>();
        const uniqueHtmlContexts: { [url: string]: string } = {};

        // Check logs for URLs
        logs.forEach(log => {
            const urls = log.match(urlRegex) || [];
            urls.forEach(url => {
                if (!seenUrls.has(url)) {
                    seenUrls.add(url);
                    const html = htmlContexts[url];
                    if (html) {
                        uniqueHtmlContexts[url] = html;
                    }
                }
            });
        });

        // Check conversation history for URLs
        conversationHistory.forEach(msg => {
            const urls = msg.message.match(urlRegex) || [];
            urls.forEach(url => {
                if (!seenUrls.has(url)) {
                    seenUrls.add(url);
                    const html = htmlContexts[url];
                    if (html) {
                        uniqueHtmlContexts[url] = html;
                    }
                }
            });
        });

        // Format conversation history
        const conversationText = conversationHistory
            .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.message}`)
            .join('\n');

        // Construct chat prompt
        const prompt = 
`You are an AI assistant that helps users with web automation and data extraction tasks. You can analyze web content, understand user intentions, and generate structured data in various formats.

### Your Capabilities:
1. **Text Analysis**: Extract and process text content from web pages
2. **Image Processing**: Work with images and visual content
3. **Table Creation**: Generate structured tables from data
4. **Sketch Generation**: Create visual representations
5. **Web Content Understanding**: Analyze HTML and extract relevant information

### Available Data Types:
- **Text**: Plain text content
- **Image**: Image URLs and visual content
- **Table**: Structured tabular data with rows and columns
- **Sketch**: Visual drawings and diagrams

### Response Format:
You can respond in two ways:

1. **Text Response**: Provide helpful explanations, suggestions, or answers to questions
2. **Structured Response**: When the user asks for specific data extraction or creation, respond with JSON:

\`\`\`json
{
  "response": "A helpful text response explaining what you're doing",
  "results": [
    {
      "type": "text|image|table|sketch",
      // ... other properties based on type
    }
  ]
}
\`\`\`

### Instance Types for Results:
interface EmbeddedTextInstance {
  type: 'text';
  content: string;
  id: string;
}

interface EmbeddedImageInstance {
  type: 'image';
  src: string;
  id: string;
}

interface EmbeddedSketchInstance {
  type: 'sketch';
  id: string;
}

interface EmbeddedTableInstance = TableInstance

type EmbeddedInstance =
  | EmbeddedTextInstance
  | EmbeddedImageInstance
  | EmbeddedSketchInstance
  | EmbeddedTableInstance;

type TextInstance = {
  id: string;
  type: 'text';
  content: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  sourcePageId?: string;
};

type ImageInstance = {
  id: string;
  type: 'image';
  src: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  sourcePageId?: string;
};

type SketchItem =
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
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  };

type SketchInstance = {
  id: string;
  type: 'sketch';
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  content: SketchItem[];
  thumbnail?: string;
  sourcePageId?: string;
};

type TableInstance = {
  id: string;
  type: 'table';
  rows: number;
  cols: number;
  cells: Array<Array<EmbeddedInstance | null>>;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  sourcePageId?: string;
};

type Instance = TextInstance | ImageInstance | SketchInstance | TableInstance;

### Context Information:

**Current Instances:**
${instanceContexts}

**Operation Logs:**
${logs.join('\n')}

**HTML Contexts (for URLs mentioned):**
${Object.entries(uniqueHtmlContexts).map(([url, html]) =>
    `URL: ${url}\nHTML:\n\`\`\`html\n${html}\n\`\`\``).join('\n\n')}

**Conversation History:**
${conversationText}

**Current User Message:**
${userMessage}

### Instructions:
- If the user is asking for information or help, provide a helpful text response with markdown formatting when appropriate
- Use markdown formatting to improve readability: **bold** for emphasis, *italic* for subtle emphasis, \`code\` for technical terms, and lists for step-by-step instructions
- If the user wants to extract data or create structured content, provide both a text response and structured results
- Use the HTML contexts when URLs are mentioned to understand web content
- Reference existing instances when relevant using their IDs
- Be conversational and helpful while maintaining focus on web automation tasks
- When returning one or more instances in the results, assign a meaningful, human-readable, and unique ID to each instance (e.g., 'Annual_Report', 'Info_list', etc.), which will be used for rendering.

Now, respond to the user's message appropriately.`.trim();

        console.log('Constructed chat prompt for LLM:', prompt);

        // Call the LLM
        const completion = await openai.chat.completions.create({
            model: "anthropic/claude-sonnet-4",
            messages: [
                {
                    role: "user",
                    content: [{
                        type: "text",
                        text: prompt
                    }, ...imageContexts]
                },
            ]
        });

        // Extract content from response
        const content = completion.choices[0]?.message?.content || '';
        console.log('LLM chat response content:', content);

        // Extract the JSON part of the response. Note that the JSON may not start with ```json
        const jsonContent = extractJSONFromResponse(content);

        if (!jsonContent) {
          return {
            response: content,
            results: []
          };
        }

        // Return structured result
        return {
            response: jsonContent.response || 'Sorry, I encountered an error while processing your request. Please try again.',
            results: jsonContent.results || []
        };
    } catch (error) {
        console.error('Error in chat with agent:', error);
        return {
            response: 'Sorry, I encountered an error while processing your request. Please try again.',
            results: []
        };
    }
}