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
  thumbnail: string;
  sourcePageId?: string;
};

type TableInstance = {
  id: string;
  type: 'table';
  rows: number;
  cols: number;
  cells: Array<{
    row: number;
    col: number;
    content: EmbeddedInstance | null;
  }>;
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
          {
            "row": 0,
            "col": 0,
            "content": {
              "type": "text",
              "content": "John Doe",
              "originalId": "Text1"
            }
          }, {
            "row": 1,
            "col": 0,
            "content": {
              "type": "text",
              "content": "Jane Smith",
              "originalId": null
            }
          }, {
            "row": 2,
            "col": 0,
            "content": {
              "type": "text",
              "content": "Alice Brown",
              "originalId": null
            }
          }
        ]
      }
    }
  ]
}

Now, analyze the provided logs and return the JSON response.
`.trim();

        console.log('Constructed prompt for LLM:', prompt);
        // return { summary: 'Processing...', results: [] };
        // return {
        //     "summary": "The user wants to extract a list of products from the Amazon search results page, getting the image and title for each product, and organize them in a two-column table.",
        //     "results": [
        //         {
        //             "type": "table",
        //             "content": {
        //                 "rows": 18,
        //                 "cols": 2,
        //                 "cells": [
        //                     {
        //                         "row": 0,
        //                         "col": 0,
        //                         "content": {
        //                             "type": "image",
        //                             "src": "https://m.media-amazon.com/images/I/611M64fQfJL._AC_UY218_.jpg",
        //                             "originalId": "Image1"
        //                         }
        //                     },
        //                     {
        //                         "row": 0,
        //                         "col": 1,
        //                         "content": {
        //                             "type": "text",
        //                             "text": "Blink Outdoor 4 (newest model), Wireless smart security camera, two-year battery, 1080p HD day and infrared night live view, two-way talk – 3 camera system",
        //                             "originalId": "Text1"
        //                         }
        //                     },
        //                     {
        //                         "row": 1,
        //                         "col": 0,
        //                         "content": {
        //                             "type": "image",
        //                             "src": "https://m.media-amazon.com/images/I/71whGfcSbeL._AC_UY218_.jpg"
        //                         }
        //                     },
        //                     {
        //                         "row": 1,
        //                         "col": 1,
        //                         "content": {
        //                             "type": "text",
        //                             "text": "Digital Camera, FHD 1080P Camera, Digital Point and Shoot Camera with 16X Zoom Anti Shake, Compact Small Camera for Boys Girls Kids"
        //                         }
        //                     },
        //                     {
        //                         "row": 2,
        //                         "col": 0,
        //                         "content": {
        //                             "type": "image",
        //                             "src": "https://m.media-amazon.com/images/I/61Y-FhF223L._AC_UY218_.jpg"
        //                         }
        //                     },
        //                     {
        //                         "row": 2,
        //                         "col": 1,
        //                         "content": {
        //                             "type": "text",
        //                             "text": "Fujifilm S9700 / S9750 16.2MP Digital Camera With 50x Optical Zoom, Black (Renewed)"
        //                         }
        //                     },
        //                     {
        //                         "row": 3,
        //                         "col": 0,
        //                         "content": {
        //                             "type": "image",
        //                             "src": "https://m.media-amazon.com/images/I/610CDb2u5GL._AC_UY218_.jpg"
        //                         }
        //                     },
        //                     {
        //                         "row": 3,
        //                         "col": 1,
        //                         "content": {
        //                             "type": "text",
        //                             "text": "REOLINK Smart 5MP 8CH Home Security Camera System, 4pcs Wired PoE IP Cameras Outdoor with Person/Pet/Vehicle Detection, 4K 8CH NVR with 2TB HDD for 24-7 Recording, RLK8-520D4-5MP"
        //                         }
        //                     },
        //                     {
        //                         "row": 4,
        //                         "col": 0,
        //                         "content": {
        //                             "type": "image",
        //                             "src": "https://m.media-amazon.com/images/I/51rP-l+s8xL._AC_UY218_.jpg"
        //                         }
        //                     },
        //                     {
        //                         "row": 4,
        //                         "col": 1,
        //                         "content": {
        //                             "type": "text",
        //                             "text": "Kasa Indoor Pan/Tilt Smart Security Camera, 1080p HD Dog-Camera,2.4GHz with Night Vision,Motion Detection for Baby and Pet Monitor, Cloud & SD Card Storage, Works with Alexa& Google Home (EC70), White"
        //                         }
        //                     },
        //                     {
        //                         "row": 5,
        //                         "col": 0,
        //                         "content": {
        //                             "type": "image",
        //                             "src": "https://m.media-amazon.com/images/I/51L8D2UqocL._AC_UY218_.jpg"
        //                         }
        //                     },
        //                     {
        //                         "row": 5,
        //                         "col": 1,
        //                         "content": {
        //                             "type": "text",
        //                             "text": "Ring Indoor Cam (newest model) — Home or business security in 1080p HD video, White"
        //                         }
        //                     },
        //                     {
        //                         "row": 6,
        //                         "col": 0,
        //                         "content": {
        //                             "type": "image",
        //                             "src": "https://m.media-amazon.com/images/I/410x1S1-xGL._AC_UY218_.jpg"
        //                         }
        //                     },
        //                     {
        //                         "row": 6,
        //                         "col": 1,
        //                         "content": {
        //                             "type": "text",
        //                             "text": "TP-Link Tapo 1080P Indoor Security Camera for Baby Monitor, Dog Camera w/Motion Detection, 2-Way Audio Siren, Night Vision, Cloud & SD Card Storage, Works w/Alexa & Google Home (Tapo C100)"
        //                         }
        //                     },
        //                     {
        //                         "row": 7,
        //                         "col": 0,
        //                         "content": {
        //                             "type": "image",
        //                             "src": "https://m.media-amazon.com/images/I/718E29NlV5L._AC_UY218_.jpg"
        //                         }
        //                     },
        //                     {
        //                         "row": 7,
        //                         "col": 1,
        //                         "content": {
        //                             "type": "text",
        //                             "text": "4K Retro Vintage Digital Camera, 64MP Retro 3" IPS Screen Camera with 6X Optical Zoom, WiFi Transfer Autofocus Rechargeable Retro Camera for Travel Vlogging and Gifts"
        //                         }
        //                     },
        //                     {
        //                         "row": 8,
        //                         "col": 0,
        //                         "content": {
        //                             "type": "image",
        //                             "src": "https://m.media-amazon.com/images/I/71-3m+Tq2HL._AC_UY218_.jpg"
        //                         }
        //                     },
        //                     {
        //                         "row": 8,
        //                         "col": 1,
        //                         "content": {
        //                             "type": "text",
        //                             "text": "4K Digital Camera for Photography, 64MP Vlogging Camera for YouTube with 3" 180° Flip Screen, 18X Digital Zoom Point and Shoot Camara with 32GB Micro SD Card for Beginner (Black)"
        //                         }
        //                     },
        //                     {
        //                         "row": 9,
        //                         "col": 0,
        //                         "content": {
        //                             "type": "image",
        //                             "src": "https://m.media-amazon.com/images/I/713J1LS3MRL._AC_UY218_.jpg"
        //                         }
        //                     },
        //                     {
        //                         "row": 9,
        //                         "col": 1,
        //                         "content": {
        //                             "type": "text",
        //                             "text": "REDTIGER Dash Cam Front Rear, 4K/2.5K Full HD Dash Camera for Cars, Included 32GB Card, Built-in Wi-Fi GPS, APP Control, 3.18" IPS Screen, Night Vision, Wide Angle, WDR, 24H Parking Mode(F7NP)"
        //                         }
        //                     },
        //                     {
        //                         "row": 10,
        //                         "col": 0,
        //                         "content": {
        //                             "type": "image",
        //                             "src": "https://m.media-amazon.com/images/I/51n8J-pX2ZL._AC_UY218_.jpg"
        //                         }
        //                     },
        //                     {
        //                         "row": 10,
        //                         "col": 1,
        //                         "content": {
        //                             "type": "text",
        //                             "text": "Blink Mini 2 (Newest Model) — Home Security & Pet Camera(s) with HD video, color night view, motion detection, two-way audio, and built-in spotlight — 1 camera (White)"
        //                         }
        //                     },
        //                     {
        //                         "row": 11,
        //                         "col": 0,
        //                         "content": {
        //                             "type": "image",
        //                             "src": "https://m.media-amazon.com/images/I/41D8O354aWL._AC_UY218_.jpg"
        //                         }
        //                     },
        //                     {
        //                         "row": 11,
        //                         "col": 1,
        //                         "content": {
        //                             "type": "text",
        //                             "text": "TP-Link Tapo Pan/Tilt Security Camera for Baby Monitor, Pet Camera w/Motion Detection, 1080P, 2-Way Audio, Night Vision, Cloud & SD Card Storage, Works with Alexa & Google Home (Tapo C200)"
        //                         }
        //                     },
        //                     {
        //                         "row": 12,
        //                         "col": 0,
        //                         "content": {
        //                             "type": "image",
        //                             "src": "https://m.media-amazon.com/images/I/714w+sQ3wHL._AC_UY218_.jpg"
        //                         }
        //                     },
        //                     {
        //                         "row": 12,
        //                         "col": 1,
        //                         "content": {
        //                             "type": "text",
        //                             "text": "4K Digital Camera for Photography- 48MP Autofocus Vlogging Camera with 2.8" 180° Flip Screen, 16X Digital Zoom- Compact Point and Shoot Camera with 64GB SD for YouTube, Travel, Beginners"
        //                         }
        //                     },
        //                     {
        //                         "row": 13,
        //                         "col": 0,
        //                         "content": {
        //                             "type": "image",
        //                             "src": "https://m.media-amazon.com/images/I/718y6JvHnHL._AC_UY218_.jpg"
        //                         }
        //                     },
        //                     {
        //                         "row": 13,
        //                         "col": 1,
        //                         "content": {
        //                             "type": "text",
        //                             "text": "4K Digital Camera for Photography Autofocus, 2024 Latest 48MP Vlogging Camera for YouTube with SD Card, 2 Batteries, 3" 180°Flip Screen Compact Travel Camera for Teens with 16X Zoom, Anti-Shake,Black"
        //                         }
        //                     },
        //                     {
        //                         "row": 14,
        //                         "col": 0,
        //                         "content": {
        //                             "type": "image",
        //                             "src": "https://m.media-amazon.com/images/I/61i+lPUYqjL._AC_UY218_.jpg"
        //                         }
        //                     },
        //                     {
        //                         "row": 14,
        //                         "col": 1,
        //                         "content": {
        //                             "type": "text",
        //                             "text": "Blink Mini - Compact indoor plug-in smart security camera, 1080p HD video, night vision, motion detection, two-way audio, easy set up, Works with Alexa – 2 cameras (White)"
        //                         }
        //                     },
        //                     {
        //                         "row": 15,
        //                         "col": 0,
        //                         "content": {
        //                             "type": "image",
        //                             "src": "https://m.media-amazon.com/images/I/71Yy+JNLZNL._AC_UY218_.jpg"
        //                         }
        //                     },
        //                     {
        //                         "row": 15,
        //                         "col": 1,
        //                         "content": {
        //                             "type": "text",
        //                             "text": "4K Digital Camera for Photography, UHD Autofocus 48MP 180° Flip Screen 16X Zoom Compact Point Shoot Vlogging Camera for YouTube with 2 Batteries, 32GB Card (Black)"
        //                         }
        //                     },
        //                     {
        //                         "row": 16,
        //                         "col": 0,
        //                         "content": {
        //                             "type": "image",
        //                             "src": "https://m.media-amazon.com/images/I/715Jv7t2A6L._AC_UY218_.jpg"
        //                         }
        //                     },
        //                     {
        //                         "row": 16,
        //                         "col": 1,
        //                         "content": {
        //                             "type": "text",
        //                             "text": "Digital Camera,Autofocus 4K Vlogging Camera for Photography with 32GB Card,48MP Portable Compact Point and Shoot Digital Camera for Teens Adult Beginner with 16X Zoom,Anti-Shake,2 Batteries(White)"
        //                         }
        //                     },
        //                     {
        //                         "row": 17,
        //                         "col": 0,
        //                         "content": {
        //                             "type": "image",
        //                             "src": "https://m.media-amazon.com/images/I/6182I7B7tML._AC_UY218_.jpg"
        //                         }
        //                     },
        //                     {
        //                         "row": 17,
        //                         "col": 1,
        //                         "content": {
        //                             "type": "text",
        //                             "text": "TP-Link 𝗧𝗮𝗽𝗼 MagCam, 2024 PCMag Editors' Choice & Wirecutter Recommended Outdoor Security Camera, 2K, Battery, Magnetic Mount Wireless Camera, 150° FOV, SD/Cloud Storage, Person/Vehicle Detection"
        //                         }
        //                     }
        //                 ]
        //             }
        //         }
        //     ]
        // }

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

        // Parse JSON response
        const cleanContent = content
            .replace(/^```json\s*/, '')  // Remove markdown code blocks
            .replace(/```$/, '')
            .trim();

        const sanitizedContent = sanitizeJSONString(cleanContent);

        let parsed;
        try {
            parsed = JSON.parse(sanitizedContent);
        } catch (e) {
            console.error('Failed to parse LLM response:', sanitizedContent);
            return {
                summary: 'Error: Invalid JSON response.',
                results: []
            };
        }

        // Return structured result
        return {
            summary: parsed.summary || 'Summary not provided by LLM.',
            results: parsed.results || []
        };
    } catch (error) {
        console.error('Error calling LLM:', error);
        return {
            summary: 'Error: Failed to communicate with the LLM.',
            results: []
        };
    }
}

function sanitizeJSONString(jsonString: string): string {
    // Replace invalid escaped single quotes (e.g., `\'`) with plain quotes (`'`)
    let sanitized = jsonString.replace(/\\'/g, "'");

    // Replace escaped spaces (`\s`) with actual spaces
    sanitized = sanitized.replace(/\\s/g, ' ');

    return sanitized;
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
- **TextInstance**: { "type": "text", "id": "string", "content": "string", "x": number, "y": number, "width": number, "height": number }
- **ImageInstance**: { "type": "image", "id": "string", "src": "string", "x": number, "y": number, "width": number, "height": number }
- **TableInstance**: { "type": "table", "id": "string", "rows": number, "cols": number, "cells": [...], "x": number, "y": number, "width": number, "height": number }
- **SketchInstance**: { "type": "sketch", "id": "string", "content": [...], "thumbnail": "string", "x": number, "y": number, "width": number, "height": number }

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

        // Check if response contains structured data
        const jsonMatch = content.match(/```json\s*(\{[\s\S]*?\})\s*```/);
        
        if (jsonMatch) {
            // Parse structured response
            try {
                const parsed = JSON.parse(jsonMatch[1]);
                return {
                    response: parsed.response || content,
                    results: parsed.results || []
                };
            } catch (e) {
                console.error('Failed to parse structured response:', e);
                return {
                    response: content,
                    results: []
                };
            }
        } else {
            // Return text-only response
            return {
                response: content,
                results: []
            };
        }
    } catch (error) {
        console.error('Error in chat with agent:', error);
        return {
            response: 'Sorry, I encountered an error while processing your request. Please try again.',
            results: []
        };
    }
}