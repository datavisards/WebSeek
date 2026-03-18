import OpenAI from 'openai';
import {
    Instance,
    EmbeddedInstance,
    EmbeddedTextInstance,
    EmbeddedImageInstance,
    EmbeddedSketchInstance,
    EmbeddedTableInstance,
    Message,
    ChatType
} from './types';
import { extractJSONFromResponse, cleanHTML } from './utils';
import { getPrompt, promptChat, promptInfer } from './prompts';

// --- User-configurable API settings (persisted in localStorage) ---
const STORAGE_KEY_API = 'webseek_api_settings';

export interface ApiSettings {
    apiKey: string;        // OpenRouter API key
    baseURL: string;       // Base URL (OpenRouter or compatible)
    model: string;         // Model identifier
}

const DEFAULT_API_SETTINGS: ApiSettings = {
    apiKey: import.meta.env.WXT_OPENROUTER_KEY || '',
    baseURL: import.meta.env.VITE_OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    model: import.meta.env.VITE_LLM_MODEL || 'google/gemini-2.5-flash',
};

export function getApiSettings(): ApiSettings {
    try {
        const stored = localStorage.getItem(STORAGE_KEY_API);
        if (stored) {
            const parsed = JSON.parse(stored) as Partial<ApiSettings>;
            return { ...DEFAULT_API_SETTINGS, ...parsed };
        }
    } catch {/* ignore */}
    return { ...DEFAULT_API_SETTINGS };
}

export function saveApiSettings(settings: Partial<ApiSettings>): void {
    const current = getApiSettings();
    localStorage.setItem(STORAGE_KEY_API, JSON.stringify({ ...current, ...settings }));
}

function getOpenAIClient() {
    const settings = getApiSettings();
    return new OpenAI({
        baseURL: settings.baseURL,
        apiKey: settings.apiKey,
        dangerouslyAllowBrowser: true,
    });
}


export async function chatWithAgent(
    chatType: ChatType,
    userMessage: string,
    conversationHistory: Message[] = [],
    instanceContext: string = "",
    imageContext: any[] = [],
    htmlContext: Record<string, {pageURL: string, htmlContent: string}> = {},
    logs: string[] = [],
    applicationContext: {
        currentToolViewTab?: string;
        currentPageInfo?: {pageId: string, url: string} | null;
        isInEditor?: boolean;
        editingTableId?: string | null;
    } = {}
): Promise<{
    message: string;
    instances?: any[];
    suggestions?: any[];
}> {
    try {
        console.log("imageContext:", imageContext)
        console.log("htmlContext:", htmlContext)
        // Extract all unique URLs from logs and conversation history

        const htmlContextString = Object.entries(htmlContext).map(([pageId, contextData]) =>
            `Page ID: ${pageId}\nPage URL: ${contextData.pageURL}\nHTML:\n\`\`\`html\n${cleanHTML(contextData.htmlContent)}\n\`\`\``).join('\n\n')

        // Format conversation history including operations
        let conversationText = conversationHistory
            .map(msg => {
                let text = `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.message}`;
                // Add operation logs for assistant messages if they exist
                if (msg.role === 'agent' && msg.operations && msg.operations.length > 0) {
                    text += `\n[Operations: ${msg.operations.join(', ')}]`;
                }
                return text;
            })
            .join('\n');
        if (conversationText == '') {
            conversationText = 'No conversation history.';
        }

        // Construct log text
        let logText = logs.length > 0 ? `${logs.slice(-15).map((log, index) => `${index + 1}. ${log}`).join('\n')}` : 'No logs available.';
        
        console.log('DEBUG: Logs array:', logs);
        console.log('DEBUG: Log text:', logText);

        // Construct application context string
        let applicationContextString = '';
        if (applicationContext) {
            const contextParts = [];
            
            if (applicationContext.currentPageInfo) {
                contextParts.push(`Current active webpage: ${applicationContext.currentPageInfo.url} (Page ID: ${applicationContext.currentPageInfo.pageId})`);
            }
            
            if (applicationContext.currentToolViewTab) {
                contextParts.push(`Current view: User is currently in the "${applicationContext.currentToolViewTab}" tab of the tool panel`);
            }
            
            if (applicationContext.isInEditor) {
                if (applicationContext.editingTableId) {
                    contextParts.push(`Editing mode: User is currently editing a table (Table ID: ${applicationContext.editingTableId})`);
                } else {
                    contextParts.push(`Editing mode: User is currently in editing mode`);
                }
            }
            
            if (contextParts.length > 0) {
                applicationContextString = contextParts.join('\n');
            }
        }

        // Construct system prompt
        const systemPrompt = getPrompt(chatType, htmlContextString, instanceContext, conversationText, logText, applicationContextString);

        console.log('System prompt:', systemPrompt);
        console.log('User message:', userMessage);

        // For debug -- please don't remove.
        // return {
        //     message: `Processing`,
        //     instances: []
        // }

        // Call the LLM
        const openai = getOpenAIClient();
        const settings = getApiSettings();
        const completion = await openai.chat.completions.create({
            model: settings.model,
            messages: [
                {
                    role: "system",
                    content: systemPrompt
                }, {
                    role: "user",
                    content: [{
                        type: "text",
                        text: userMessage
                    }]
                },
            ],
            response_format: { type: 'json_object' },
        });

        // Extract content from response
        const content = completion.choices[0]?.message?.content || '';
        console.log('LLM chat response content:', content);

        // Extract the JSON part of the response. Note that the JSON may not start with ```json
        const jsonContent = extractJSONFromResponse(content);

        if (!jsonContent) {
          return {
            message: content,
            instances: [],
            suggestions: []
          };
        }

        if (!jsonContent.success) {
            console.error('LLM response indicates failure:', jsonContent.error_message);
            return {
                message: jsonContent.error_message || 'Error: LLM response indicated failure.',
                instances: [],
                suggestions: []
            };
        }

        // Return structured result
        return {
            message: jsonContent.message || 
                    (jsonContent.suggestions && jsonContent.suggestions.length > 0 
                     ? `Generated ${jsonContent.suggestions.length} suggestion${jsonContent.suggestions.length > 1 ? 's' : ''}` 
                     : 'Response processed successfully'),
            instances: jsonContent.instances || [],
            suggestions: jsonContent.suggestions || []
        };
    } catch (error) {
        console.error('Error in chat with agent:', error);
        return {
            message: 'Sorry, I encountered an error while processing your request. Please try again.',
            instances: [],
            suggestions: []
        };
    }
}