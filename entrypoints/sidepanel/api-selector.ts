const USE_LLM = import.meta.env.WXT_USE_LLM === 'true';

// Dynamic imports based on environment variable
export const parseLogWithAgent = async (
    selectedLogs: string[],
    instanceContexts: string,
    imageContexts: any[],
    htmlContexts: Record<string, {pageURL: string, htmlContent: string}>,
    currentInstanceId: string | null = null,
    previousCodeContexts: string[] = [],
    userMessage: string = '',
) => {
    if (USE_LLM) {
        const apiModule = await import('./apis_old');
        return apiModule.parseLogWithAgent(selectedLogs, instanceContexts, imageContexts, htmlContexts, currentInstanceId, previousCodeContexts);
    } else {
        const apiModule = await import('./apis');
        return apiModule.parseLogWithAgent(userMessage);
    }
};

export const chatWithAgent = async (
    userMessage: string,
    conversationHistory?: any[],
    instanceContexts?: string,
    imageContexts?: any[],
    htmlContexts?: Record<string, {pageURL: string, htmlContent: string}>,
    logs?: string[],
) => {
    if (USE_LLM) {
        const apiModule = await import('./apis_old');
        return apiModule.chatWithAgent(userMessage, conversationHistory, instanceContexts, imageContexts, htmlContexts, logs);
    } else {
        const apiModule = await import('./apis');
        return apiModule.chatWithAgent(userMessage);
    }
};