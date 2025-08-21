import { Instance, Message } from './types';

// WebSocket connection state
let ws: WebSocket | null = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
const reconnectDelay = 1000; // Start with 1 second

// Event listeners
const eventListeners: Map<string, Function[]> = new Map();

// WebSocket message types
export interface WebSocketMessage {
  type: string;
  data?: any;
  id?: string;
}

export interface ConnectionMessage extends WebSocketMessage {
  type: 'connection';
  data: {
    client_id: string;
    timestamp: number;
  };
}

export interface PingMessage extends WebSocketMessage {
  type: 'ping';
  data: {
    timestamp: number;
  };
}

export interface PongMessage extends WebSocketMessage {
  type: 'pong';
  data: {
    timestamp: number;
  };
}

export interface ContextRequestMessage extends WebSocketMessage {
  type: 'context_request';
  data: {
    request_type: 'get_html' | 'get_metadata' | 'get_image' | 'get_chat_history';
    request_id: string;
    parameters: {
      instance_ids?: string[];
      url?: string;
    };
  };
}

export interface ContextResponseMessage extends WebSocketMessage {
  type: 'context_response';
  data: {
    request_type: string;
    request_id: string;
    content: any;
    success: boolean;
    error?: string;
  };
}

export type WebSocketMessageTypes = 
  | ConnectionMessage 
  | PingMessage 
  | PongMessage 
  | ContextRequestMessage 
  | ContextResponseMessage;

// WebSocket service class
class WebSocketService {
  private url: string;
  private clientId: string;
  private isConnecting: boolean = false;
  private pingInterval: NodeJS.Timeout | null = null;

  constructor(url: string = 'ws://localhost:8000/ws') {
    this.url = url;
    this.clientId = this.generateClientId();
  }

  private generateClientId(): string {
    return 'webseek_' + Math.random().toString(36).substring(2, 15);
  }

  // Connect to WebSocket
  async connect(): Promise<void> {
    if (this.isConnecting || ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      try {
        ws = new WebSocket(this.url);

        ws.onopen = () => {
          console.log('WebSocket connected');
          this.isConnecting = false;
          reconnectAttempts = 0;
          this.sendConnectionMessage();
          this.startPingInterval();
          this.emit('connected');
          resolve();
        };

        ws.onmessage = (event) => {
          try {
            const message: WebSocketMessageTypes = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        ws.onclose = (event) => {
          console.log('WebSocket disconnected:', event.code, event.reason);
          this.isConnecting = false;
          this.stopPingInterval();
          this.emit('disconnected', event);
          
          // Attempt reconnection if not a clean close
          if (event.code !== 1000 && reconnectAttempts < maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.isConnecting = false;
          reject(error);
        };

      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  // Disconnect from WebSocket
  disconnect(): void {
    if (ws) {
      ws.close(1000, 'Client disconnecting');
      ws = null;
    }
    this.stopPingInterval();
  }

  // Send connection initialization message
  private sendConnectionMessage(): void {
    const message: ConnectionMessage = {
      type: 'connection',
      data: {
        client_id: this.clientId,
        timestamp: Date.now()
      }
    };
    this.send(message);
  }

  // Send ping message
  private sendPing(): void {
    const message: PingMessage = {
      type: 'ping',
      data: {
        timestamp: Date.now()
      }
    };
    this.send(message);
  }

  // Send message to WebSocket
  send(message: WebSocketMessage): void {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected, cannot send message:', message);
    }
  }

  // Handle incoming messages
  private handleMessage(message: WebSocketMessageTypes): void {
    console.log('Received message:', message);
    switch (message.type) {
      case 'pong':
        // Handle pong response
        console.log('Received pong:', message.data);
        break;
      
      case 'context_request':
        // Handle context request from backend
        this.handleContextRequest(message as ContextRequestMessage);
        break;
      
      default:
        console.log('Received unknown message type:', message.type);
    }
  }

  // Handle context requests from backend
  private async handleContextRequest(request: ContextRequestMessage): Promise<void> {
    try {
      console.log('Handling context request:', request);
      let response: any = { success: false, error: 'Unknown request type' };

      switch (request.data.request_type) {
        case 'get_html':
          response = await this.getHtmlContent(request.data.parameters.url);
          break;
        
        case 'get_metadata':
          response = await this.getMetadata(request.data.parameters.instance_ids);
          break;
        
        case 'get_image':
          response = await this.getImageContent(request.data.parameters.instance_ids);
          break;
        
        case 'get_chat_history':
          response = await this.getChatHistory();
          break;
      }

      const responseMessage: ContextResponseMessage = {
        type: 'context_response',
        data: {
          request_type: request.data.request_type,
          request_id: request.data.request_id,
          content: response,
          success: response.success !== false,
          error: response.error
        }
      };

      console.log('Sending response:', responseMessage);

      this.send(responseMessage);

    } catch (error) {
      console.error('Error handling context request:', error);
      const errorResponse: ContextResponseMessage = {
        type: 'context_response',
        data: {
          request_type: request.data.request_type,
          request_id: request.data.request_id,
          content: null,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
      this.send(errorResponse);
    }
  }

  // Context API methods
  private async getHtmlContent(url?: string): Promise<any> {
    // TODO: Implement direct HTML content retrieval
    // This would need to interface with the content script or background script
    return { success: false, error: 'HTML content retrieval not implemented' };
  }

  private async getMetadata(instanceIds?: string[]): Promise<any> {
    // TODO: Implement direct metadata retrieval
    // This would need to access instance data from the current context
    return { success: false, error: 'Metadata retrieval not implemented' };
  }

  private async getImageContent(instanceIds?: string[]): Promise<any> {
    // TODO: Implement direct image content retrieval
    // This would need to access image data from instances
    return { success: false, error: 'Image content retrieval not implemented' };
  }

  private async getChatHistory(): Promise<any> {
    // TODO: Implement direct chat history retrieval
    // This would need to access chat messages from the current session
    return { success: false, error: 'Chat history retrieval not implemented' };
  }

  // Start ping interval
  private startPingInterval(): void {
    this.stopPingInterval();
    this.pingInterval = setInterval(() => {
      this.sendPing();
    }, 30000); // Send ping every 30 seconds
  }

  // Stop ping interval
  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  // Schedule reconnection with exponential backoff
  private scheduleReconnect(): void {
    const delay = reconnectDelay * Math.pow(2, reconnectAttempts);
    reconnectAttempts++;
    
    console.log(`Scheduling reconnection attempt ${reconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      this.connect().catch(error => {
        console.error('Reconnection failed:', error);
      });
    }, delay);
  }

  // Event emitter methods
  on(event: string, callback: Function): void {
    if (!eventListeners.has(event)) {
      eventListeners.set(event, []);
    }
    eventListeners.get(event)!.push(callback);
  }

  off(event: string, callback: Function): void {
    const listeners = eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, data?: any): void {
    const listeners = eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in event listener:', error);
        }
      });
    }
  }

  // Get connection status
  isConnected(): boolean {
    return ws?.readyState === WebSocket.OPEN;
  }

  // Get client ID
  getClientId(): string {
    return this.clientId;
  }
}

// Export singleton instance
export const websocketService = new WebSocketService();
export default websocketService; 