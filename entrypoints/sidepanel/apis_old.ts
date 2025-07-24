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
    message: string;
    instances: any[];
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
You are an AI assistant tasked with analyzing the intent behind the instance(s) with ID '${currentInstanceId}' created by the user. Each instance serves as an example demonstration of the user's desired tasks, i.e., an initial artifact. Your goal is to generate both a concise summary of the inferred user's intent and produce the complete output wanted by the user in structured formats (detailed below). 

### Your Task:
1. Analyze the instance(s) with ID '${currentInstanceId}' and extract the primary intent or pattern.
2. If needed, use the provided HTML contexts for any URLs mentioned in the instance to assist your analysis.
3. Execute the tasks based on the inferred intent and provide the results.

### Expected Response Format:
Return your response strictly as a JSON object in the following format:
{
  "success": boolean,
  "error_message"?: string, // Only if success is false
  "message": string, // A concise summary of the user's intent
  "instances": InstanceEvent[] // Can be [] if no instances need to be created, removed or updated
}

The type of "instances" is InstanceEvent[], which is defined as follows:
export type Locator =
          | { type: 'id'; value: string }
          | { type: 'attribute'; name: string; value: string }
          | { type: 'contextual'; anchor: Locator; target: { tag: string; occurrence?: number } }
          | { type: 'css'; selector: string };
        export interface WebCaptureSource {
          type: 'web';
          pageId: string;
          url: string;
          locator: Locator; // Use the new structured locator
          htmlSnippet?: string;
          elementId?: string;
          capturedAt: string;
        }

        /**
         * Describes the source of an instance created manually by the user.
         */
        export interface ManualSource {
          type: 'manual';
          createdAt: string; // ISO timestamp
        }

        export type InstanceSource = WebCaptureSource | ManualSource;

        /**
         * Base interface for all instances, establishing common properties.
         */
        export interface BaseInstance {
          id: string;
          source: InstanceSource; // This field is NOT optional.
          originalId?: string;
        }

        // --- Embedded Instances (all extend BaseInstance) ---
        export interface EmbeddedTextInstance extends BaseInstance { type: 'text'; content: string; }
        export interface EmbeddedImageInstance extends BaseInstance { type: 'image'; src: string; }
        export interface EmbeddedSketchInstance extends BaseInstance { type: 'sketch'; }
        export interface EmbeddedTableInstance extends TableInstance {}
        export interface EmbeddedVisualizationInstance extends VisualizationInstance {}
        export type EmbeddedInstance = EmbeddedTextInstance | EmbeddedImageInstance | EmbeddedSketchInstance | EmbeddedTableInstance | EmbeddedVisualizationInstance;

        // --- Standalone Instances (all extend BaseInstance) ---
        export interface TextInstance extends BaseInstance { type: 'text'; content: string; x?: number; y?: number; width?: number; height?: number; }
        export interface ImageInstance extends BaseInstance { type: 'image'; src: string; x?: number; y?: number; width?: number; height?: number; }
        
        export type SketchItem =
          | { type: 'stroke', id: string, points: Array<{ x: number; y: number }>, color: string, width: number }
          | { type: 'instance', id: string, instance: EmbeddedInstance, x: number, y: number, width: number, height: number };
        
        export interface SketchInstance extends BaseInstance { type: 'sketch'; content: SketchItem[]; thumbnail?: string; x?: number; y?: number; width?: number; height?: number; }
        export interface TableInstance extends BaseInstance { type: 'table'; rows: number; cols: number; cells: Array<Array<EmbeddedInstance | null>>; x?: number; y?: number; width?: number; height?: number; }
        export interface VisualizationInstance extends BaseInstance { type: 'visualization'; spec: object; thumbnail?: string; x?: number; y?: number; width?: number; height?: number; }

        /** The main union type for all standalone instances. */
        export type Instance = TextInstance | ImageInstance | SketchInstance | TableInstance | VisualizationInstance;

        export interface InstanceEvent {
          action: 'add' | 'remove' | 'update';
          targetId?: string; // The original ID of the instance being modified or removed
          instance?: Instance; // The new content of the instance
        }

Note:
- Do NOT escape single quotes (').
- Use double backslashes (\\) for special regex characters like \\s or \\d.
- You may use markdown formatting in the summary for better readability (e.g., **bold**, *italic*, \`code\`, lists).
- Do not leave any non-optional fields empty for each result instance.
- When returning one or more instances in the results, assign a meaningful, human-readable, and unique ID to each instance (e.g., 'Annual_report', 'Info_list', etc.), which will be used for rendering.
- For visualization, use the 'visualization' type and provide a Vega-Lite or similar spec in the 'spec' field.
- - **Source Assignment:** When generating an instance, you MUST correctly assign its \`source\` field.
  - For a new instance created from scratch (e.g., a summary you write), use a \`ManualSource\`. Example: \`"source": { "type": "manual", "createdAt": "2024-01-01T12:00:00Z" }\`.
  - For new instances created from web content, you MUST generate a \`WebCaptureSource\` object. This includes creating a \`locator\` object.
# **How to Generate a \`locator\` Object:**
Instead of a brittle CSS string, you will generate a structured \`locator\` object. Your goal is to choose the most robust strategy to find the element. Follow this order of preference:

**1. \`id\` (Highest Priority):** If the element has a unique \`id\`.
\`{ "type": "id", "value": "main-product-image" }\`

**2. \`attribute\`:** If the element has another unique attribute like \`data-testid\`, \`data-cy\`, or \`data-id\`.
\`{ "type": "attribute", "name": "data-testid", "value": "add-to-cart-button" }\`

**3. \`contextual\` (For elements inside a unique container):** This is the best way to handle items in a list, like products.
- First, find a stable parent container using an \`id\` or \`attribute\` locator (this is the \`anchor\`).
- Then, specify the element you want inside that anchor (this is the \`target\`).
- **Example:** To get the title (\`<h2>\`) of a product in a container marked by \`data-asin\`:
  \`{ "type": "contextual", "anchor": { "type": "attribute", "name": "data-asin", "value": "B0BLB6W78J" }, "target": { "tag": "h2", "occurrence": 0 } }\` 
  *(This means "find the element with data-asin='B0BLB6W78J', and inside it, get the first \`h2\` element.")*

**4. \`css\` (Last Resort):** Only if none of the above strategies work, fall back to a simple CSS selector.
\`{ "type": "css", "selector": "nav > ul > li:nth-of-type(3)" }\`

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
  "message": "The user intends to scrape all names from the table in the webpage.",
  "instances": [
    {
      "action": "add",
      "instance": {
        "type": "table",
        "table": {
          "rols": 10,
          "cols": 1,
          "cells": [
            [{
              "type": "text",
              "content": "John Doe",
              "id": "_12345678", // Unique ID for this instance
              "originalId": "Text1",
              "source": {
                  "type": "web",
                  "pageId": "Page1",
                  "url": "https://www.amazon.com/s?k=camera&webseek_selector=%5Bdata-asin%3D%22B0F1Y81JH8%22%5D+img.s-image&ref=nav_bb_sb",
                  "locator": {
                      "type": "css",
                      "selector": "table > tbody > tr:nth-of-type(1) > td:nth-of-type(1)"
                  },
                  "htmlSnippet": "<td>John Doe</td>",
                  "capturedAt": "2025-07-24T09:23:46.687Z"
              }
            }], [{
              "type": "text",
              "content": "Jane Smith",
              "originalId": null,
              ... // Other instances follow the same structure
            }], [{
              "type": "text",
              "content": "Alice Brown",
              "originalId": null,
              ...
            }], ...]
        },
        "id": "Scraped_Names_Table",
        "source": {
          "type": "manual",
          "createdAt": "2025-07-24T09:23:46.687Z"
        },
        "originalId": null
      }
    }
  ]
}

Now, analyze the provided instance and return the JSON response.
`.trim();

        console.log('Constructed prompt for LLM:', prompt);
        return {
            message: 'Processing your request...',
            instances: []
        };

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
                message: 'Error: No JSON found in LLM response.',
                instances: []
            };
        }

        if (!jsonContent.success) {
            console.error('LLM response indicates failure:', jsonContent.error_message);
            return {
                message: jsonContent.error_message || 'Error: LLM response indicated failure.',
                instances: []
            };
        }

        // Return structured result
        return {
            message: jsonContent.message || 'Message not provided by LLM.',
            instances: jsonContent.instances || []
        };
    } catch (error) {
        console.error('Error calling LLM:', error);
        return {
            message: 'Error: Failed to communicate with the LLM.',
            instances: []
        };
    }
}

export async function chatWithAgent(
    userMessage: string,
    conversationHistory: Message[] = [],
    instanceContexts: string = "",
    imageContexts: any[] = [],
    htmlContexts: Record<string, string> = {},
    logs: string[] = [],
): Promise<{
    message: string;
    instances?: any[];
}> {
    try {
        console.log(imageContexts)
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
5. **Visualization Generation**: Create and suggest data visualizations (e.g., Vega-Lite, charts, graphs)
6. **Web Content Understanding**: Analyze HTML and extract relevant information

### Available Data Types:
- **Text**: Plain text content
- **Image**: Image URLs and visual content
- **Table**: Structured tabular data with rows and columns
- **Sketch**: Visual drawings and diagrams
- **Visualization**: Data visualizations (charts, graphs, etc.) with Vega-Lite or similar specs

### Response Format:
You can respond:

1. **A textual message**: Provide helpful explanations, suggestions, or answers to questions
2. **A list of actions on the instances**: When the user asks for specific data extraction or creation, you can update the instances in the instance view.

Organize your response as follows:
\`\`\`json
{
  "success": boolean,
  "error_message"?: string, // Only if success is false
  "message": string, // A helpful response to the user's query
  "instances": InstanceEvent[] // Can be [] if no instances need to be created, removed or updated
}
\`\`\`

The type of "instances" is InstanceEvent[], which is defined as follows:
export type Locator =
          | { type: 'id'; value: string }
          | { type: 'attribute'; name: string; value: string }
          | { type: 'contextual'; anchor: Locator; target: { tag: string; occurrence?: number } }
          | { type: 'css'; selector: string };
        export interface WebCaptureSource {
          type: 'web';
          pageId: string;
          url: string;
          locator: Locator; // Use the new structured locator
          htmlSnippet?: string;
          elementId?: string;
          capturedAt: string;
        }

        /**
         * Describes the source of an instance created manually by the user.
         */
        export interface ManualSource {
          type: 'manual';
          createdAt: string; // ISO timestamp
        }

        export type InstanceSource = WebCaptureSource | ManualSource;

        /**
         * Base interface for all instances, establishing common properties.
         */
        export interface BaseInstance {
          id: string;
          source: InstanceSource; // This field is NOT optional.
          originalId?: string;
        }

        // --- Embedded Instances (all extend BaseInstance) ---
        export interface EmbeddedTextInstance extends BaseInstance { type: 'text'; content: string; }
        export interface EmbeddedImageInstance extends BaseInstance { type: 'image'; src: string; }
        export interface EmbeddedSketchInstance extends BaseInstance { type: 'sketch'; }
        export interface EmbeddedTableInstance extends TableInstance {}
        export interface EmbeddedVisualizationInstance extends VisualizationInstance {}
        export type EmbeddedInstance = EmbeddedTextInstance | EmbeddedImageInstance | EmbeddedSketchInstance | EmbeddedTableInstance | EmbeddedVisualizationInstance;

        // --- Standalone Instances (all extend BaseInstance) ---
        export interface TextInstance extends BaseInstance { type: 'text'; content: string; x?: number; y?: number; width?: number; height?: number; }
        export interface ImageInstance extends BaseInstance { type: 'image'; src: string; x?: number; y?: number; width?: number; height?: number; }
        
        export type SketchItem =
          | { type: 'stroke', id: string, points: Array<{ x: number; y: number }>, color: string, width: number }
          | { type: 'instance', id: string, instance: EmbeddedInstance, x: number, y: number, width: number, height: number };
        
        export interface SketchInstance extends BaseInstance { type: 'sketch'; content: SketchItem[]; thumbnail?: string; x?: number; y?: number; width?: number; height?: number; }
        export interface TableInstance extends BaseInstance { type: 'table'; rows: number; cols: number; cells: Array<Array<EmbeddedInstance | null>>; x?: number; y?: number; width?: number; height?: number; }
        export interface VisualizationInstance extends BaseInstance { type: 'visualization'; spec: object; thumbnail?: string; x?: number; y?: number; width?: number; height?: number; }

        /** The main union type for all standalone instances. */
        export type Instance = TextInstance | ImageInstance | SketchInstance | TableInstance | VisualizationInstance;

        export interface InstanceEvent {
          action: 'add' | 'remove' | 'update';
          targetId?: string; // The original ID of the instance being modified or removed
          instance?: Instance; // The new content of the instance
        }

### Context Information:

**Current Instances:**
${instanceContexts}

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
- If the user wants to extract data, create structured content, or generate a visualization, provide both a text response and structured results
- Use the HTML contexts when URLs are mentioned to understand web content
- Reference existing instances when relevant using their IDs
- Be conversational and helpful while maintaining focus on web automation and visualization tasks
- When returning one or more instances in the results, assign a meaningful, human-readable, and unique ID to each instance (e.g., 'Annual_Report', 'Info_list', 'Sales_Bar_Chart', etc.), which will be used for rendering.
- For visualization, use the 'visualization' type and provide a Vega-Lite or similar spec in the 'spec' field.
- - **Source Assignment:** When generating an instance, you MUST correctly assign its \`source\` field.
  - For a new instance created from scratch (e.g., a summary you write), use a \`ManualSource\`. Example: \`"source": { "type": "manual", "createdAt": "2024-01-01T12:00:00Z" }\`.
  - For new instances created from web content, you MUST generate a \`WebCaptureSource\` object. This includes creating a \`locator\` object.
# **How to Generate a \`locator\` Object:**
Instead of a brittle CSS string, you will generate a structured \`locator\` object. Your goal is to choose the most robust strategy to find the element. Follow this order of preference:

**1. \`id\` (Highest Priority):** If the element has a unique \`id\`.
\`{ "type": "id", "value": "main-product-image" }\`

**2. \`attribute\`:** If the element has another unique attribute like \`data-testid\`, \`data-cy\`, or \`data-id\`.
\`{ "type": "attribute", "name": "data-testid", "value": "add-to-cart-button" }\`

**3. \`contextual\` (For elements inside a unique container):** This is the best way to handle items in a list, like products.
- First, find a stable parent container using an \`id\` or \`attribute\` locator (this is the \`anchor\`).
- Then, specify the element you want inside that anchor (this is the \`target\`).
- **Example:** To get the title (\`<h2>\`) of a product in a container marked by \`data-asin\`:
  \`{ "type": "contextual", "anchor": { "type": "attribute", "name": "data-asin", "value": "B0BLB6W78J" }, "target": { "tag": "h2", "occurrence": 0 } }\` 
  *(This means "find the element with data-asin='B0BLB6W78J', and inside it, get the first \`h2\` element.")*

**4. \`css\` (Last Resort):** Only if none of the above strategies work, fall back to a simple CSS selector.
\`{ "type": "css", "selector": "nav > ul > li:nth-of-type(3)" }\`

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
            message: content,
            instances: []
          };
        }

        if (!jsonContent.success) {
            console.error('LLM response indicates failure:', jsonContent.error_message);
            return {
                message: jsonContent.error_message || 'Error: LLM response indicated failure.',
                instances: []
            };
        }

        // Return structured result
        return {
            message: jsonContent.response || 'Sorry, I encountered an error while processing your request. Please try again.',
            instances: jsonContent.results || []
        };
    } catch (error) {
        console.error('Error in chat with agent:', error);
        return {
            message: 'Sorry, I encountered an error while processing your request. Please try again.',
            instances: []
        };
    }
}