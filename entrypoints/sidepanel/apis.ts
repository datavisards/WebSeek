import OpenAI from 'openai';
import axios from 'axios';

const openai = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: import.meta.env.WXT_OPENROUTER_KEY,
    dangerouslyAllowBrowser: true
});

const backendBaseURL = "http://localhost:8000/api"

export async function chatWithAgent(
  userMessage: string,
): Promise<{
  message: string;
  instances?: any[];
}> {
  try {
    const request = {
      description: userMessage,
    };

    const response = await axios.post(backendBaseURL + '/process-task', request);

    // Axios stores HTTP status code in response.status, not response.status_code
    if (response.status !== 200) {
      throw new Error(`Unexpected status code: ${response.status}`);
    }

    // The response data should be the object described
    const data = response.data;

    if (!data.success) {
      // If the backend indicates failure, throw with the error message
      throw new Error(data.error_message || 'Unknown error from agent');
    }

    // Return the message and instances list (if any)
    return {
      message: data.message,
      instances: data.instances || [],
    };
  } catch (error: any) {
    // Handle any errors - log and rethrow or return a failure response
    console.error('Error in chatWithAgent:', error);
    return {
      message: `Error communicating with agent: ${error.message || error}`,
      instances: [],
    };
  }
}

export async function parseLogWithAgent(userMessage: string) {
  return chatWithAgent(userMessage);
}