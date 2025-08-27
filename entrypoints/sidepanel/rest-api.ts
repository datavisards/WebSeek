import { Instance, Message } from './types';

// REST API service class
class RestApiService {
  private baseUrl: string;

  constructor(baseUrl: string = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000') {
    this.baseUrl = baseUrl;
  }

  // Process a task with the backend
  async processTask(taskData: {
    task_type: string;
    prompt: string;
    context?: any;
    instances?: Instance[];
    messages?: Message[];
  }): Promise<{
    task_id: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    message?: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/process-task`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(taskData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return {
        task_id: result.task_id,
        status: result.status,
        message: result.message,
      };
    } catch (error) {
      console.error('Error processing task:', error);
      throw error;
    }
  }

  // Get task status
  async getTaskStatus(taskId: string): Promise<{
    task_id: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress?: number;
    result?: any;
    error?: string;
    created_at: string;
    updated_at: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tasks/${taskId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return {
        task_id: result.task_id,
        status: result.status,
        progress: result.progress,
        result: result.result,
        error: result.error,
        created_at: result.created_at,
        updated_at: result.updated_at,
      };
    } catch (error) {
      console.error('Error getting task status:', error);
      throw error;
    }
  }

  // Provide context to the backend
  async provideContext(contextData: {
    html_content?: string;
    metadata?: any;
    images?: any[];
    chat_history?: Message[];
    instances?: Instance[];
  }): Promise<{
    success: boolean;
    message?: string;
    context_id?: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/context`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(contextData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: result.success,
        message: result.message,
        context_id: result.context_id,
      };
    } catch (error) {
      console.error('Error providing context:', error);
      throw error;
    }
  }

  // Health check endpoint
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    message?: string;
    timestamp: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return {
        status: result.status,
        message: result.message,
        timestamp: result.timestamp,
      };
    } catch (error) {
      console.error('Health check failed:', error);
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Set base URL
  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  // Get base URL
  getBaseUrl(): string {
    return this.baseUrl;
  }
}

// Export singleton instance
export const restApiService = new RestApiService();
export default restApiService; 