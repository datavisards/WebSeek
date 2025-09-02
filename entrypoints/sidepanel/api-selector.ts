import { ChatType } from './types';

const USE_LLM = import.meta.env.WXT_USE_LLM === 'true';

// Dynamic imports based on environment variable
export const chatWithAgent = async (
    chatType: ChatType,
    userMessage: string,
    conversationHistory?: any[],
    instanceContext?: string,
    imageContext?: any[],
    htmlContext?: Record<string, {pageURL: string, htmlContent: string}>,
    logs?: string[],
    applicationContext?: {
        currentToolViewTab?: string;
        currentPageInfo?: {pageId: string, url: string} | null;
        isInEditor?: boolean;
        editingTableId?: string | null;
    }
) => {
    // if (USE_LLM) {
        const apiModule = await import('./apis');
        return apiModule.chatWithAgent(chatType, userMessage, conversationHistory, instanceContext, imageContext, htmlContext, logs, applicationContext);
    // } else {
    //     const apiModule = await import('./apis');
    //     return apiModule.chatWithAgent(chatType, userMessage);
    // }
};