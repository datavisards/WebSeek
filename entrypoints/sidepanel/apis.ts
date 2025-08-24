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

const openai = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: import.meta.env.WXT_OPENROUTER_KEY,
    dangerouslyAllowBrowser: true
});

const model_name = {
    "chat": "google/gemini-2.5-flash",
    "infer": "google/gemini-2.5-flash",
    "suggest": "google/gemini-2.5-flash",
};

export async function chatWithAgent(
    chatType: ChatType,
    userMessage: string,
    conversationHistory: Message[] = [],
    instanceContext: string = "",
    imageContext: any[] = [],
    htmlContext: Record<string, {pageURL: string, htmlContent: string}> = {},
    logs: string[] = [],
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

        // Construct system prompt
        const systemPrompt = getPrompt(chatType, htmlContextString, instanceContext, conversationText, logText);

        console.log('System prompt:', systemPrompt);
        console.log('User message:', userMessage);

        // For debug -- please don't remove.
        // return {
        //     message: `Processing`,
        //     instances: []
        // }

        // Call the LLM
        const completion = await openai.chat.completions.create({
            model: model_name[chatType],
            messages: [
                {
                    role: "system",
                    content: systemPrompt
                }, {
                    role: "user",
                    content: [{
                        type: "text",
                        text: userMessage
                    }, ...imageContext]
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