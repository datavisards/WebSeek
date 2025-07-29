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
import { getPrompt, promptChat, promptInfer } from './prompts';

const openai = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: import.meta.env.WXT_OPENROUTER_KEY,
    dangerouslyAllowBrowser: true
});

const model_name = "google/gemini-2.5-flash";

export async function chatWithAgent(
    chatType: 'chat' | 'infer',
    userMessage: string,
    conversationHistory: Message[] = [],
    instanceContext: string = "",
    imageContext: any[] = [],
    htmlContext: Record<string, {pageURL: string, htmlContent: string}> = {},
    // logs: string[] = [],
): Promise<{
    message: string;
    instances?: any[];
}> {
    try {
        console.log("imageContext:", imageContext)
        console.log("htmlContext:", htmlContext)
        // Extract all unique URLs from logs and conversation history

        const htmlContextString = Object.entries(htmlContext).map(([pageId, contextData]) =>
            `Page ID: ${pageId}\nPage URL: ${contextData.pageURL}\nHTML:\n\`\`\`html\n${contextData.htmlContent}\n\`\`\``).join('\n\n')

        // Format conversation history including operations
        const conversationText = conversationHistory
            .map(msg => {
                let text = `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.message}`;
                // Add operation logs for assistant messages if they exist
                if (msg.role === 'agent' && msg.operations && msg.operations.length > 0) {
                    text += `\n[Operations: ${msg.operations.join(', ')}]`;
                }
                return text;
            })
            .join('\n');

        // Construct system prompt
        const systemPrompt = getPrompt(chatType, htmlContextString, instanceContext, conversationText);

        console.log('System prompt:', systemPrompt);
        console.log('User message:', userMessage);

        // For debug -- please don't remove.
        // return {
        //     message: `Processing`,
        //     instances: []
        // }

        // Call the LLM
        const completion = await openai.chat.completions.create({
            model: model_name,
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
            message: jsonContent.message || 'Sorry, I encountered an error while processing your request. Please try again.',
            instances: jsonContent.instances || []
        };
    } catch (error) {
        console.error('Error in chat with agent:', error);
        return {
            message: 'Sorry, I encountered an error while processing your request. Please try again.',
            instances: []
        };
    }
}