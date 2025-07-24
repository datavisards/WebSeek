import { Instance, Message } from './types';
import { generateInstanceContext } from './utils';

// Context service class
class ContextService {
  private instances: Instance[] = [];
  private messages: Message[] = [];
  private htmlContexts: Record<string, {pageURL: string, htmlContent: string}> = {};
  private imageContexts: any[] = [];

  // Set instances
  setInstances(instances: Instance[]): void {
    this.instances = instances;
  }

  // Get instances
  getInstances(): Instance[] {
    return this.instances;
  }

  // Set messages
  setMessages(messages: Message[]): void {
    this.messages = messages;
  }

  // Get messages
  getMessages(): Message[] {
    return this.messages;
  }

  // Set HTML contexts
  setHtmlContexts(htmlContexts: Record<string, {pageURL: string, htmlContent: string}>): void {
    this.htmlContexts = htmlContexts;
  }

  // Get HTML contexts
  getHtmlContexts(): Record<string, {pageURL: string, htmlContent: string}> {
    return this.htmlContexts;
  }

  // Set image contexts
  setImageContexts(imageContexts: any[]): void {
    this.imageContexts = imageContexts;
  }

  // Get image contexts
  getImageContexts(): any[] {
    return this.imageContexts;
  }

  // Get HTML content for a specific URL or current page
  async getHtmlContent(url?: string): Promise<{
    success: boolean;
    url: string;
    html: string;
    timestamp: number;
    error?: string;
  }> {
    try {
      const targetUrl = url || window.location.href;
      console.log("Fetching HTML content for URL:", targetUrl);
      console.log("Cached HTML contexts:", this.htmlContexts);
      
      // Search for HTML context that matches this URL
      const matchingContext = Object.values(this.htmlContexts).find(context => context.pageURL === targetUrl);
      if (matchingContext) {
        return {
          success: true,
          url: targetUrl,
          html: matchingContext.htmlContent,
          timestamp: Date.now(),
        };
      }

      // No matching context found - this should not happen in the new pageId-based system
      console.warn('No HTML context found for URL:', targetUrl, 'Available contexts:', Object.keys(this.htmlContexts));
      
      return {
        success: false,
        url: targetUrl,
        html: '',
        timestamp: Date.now(),
        error: 'No HTML context available for this URL. HTML is now managed via pageId.',
      };
    } catch (error) {
      return {
        success: false,
        url: url || window.location.href,
        html: '',
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : 'Failed to fetch HTML',
      };
    }
  }

  // Get metadata for instances
  async getMetadata(instanceIds?: string[]): Promise<{
    success: boolean;
    instances: any[];
    timestamp: number;
    error?: string;
  }> {
    try {
      let instancesToReturn = this.instances;

      // If instanceIds is provided and not ['<all>'], filter for specific instances
      if (instanceIds && !(instanceIds.length === 1 && instanceIds[0] === '<all>')) {
        instancesToReturn = this.instances.filter(instance => instanceIds.includes(instance.id));
      } else if (instanceIds && instanceIds.length === 1 && instanceIds[0] === '<all>') {
        // If instanceIds is ['<all>'], return all instances
        instancesToReturn = this.instances;
      }

      // Generate context for the instances
      const instanceContexts = await generateInstanceContext(instancesToReturn);

      return {
        success: true,
        instances: instancesToReturn.map(instance => ({
          id: instance.id,
          type: instance.type,
          content: instance,
          context: instanceContexts[instance.id] || '',
        })),
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        success: false,
        instances: [],
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : 'Failed to get metadata',
      };
    }
  }

  // Get image content for instances
  async getImageContent(instanceIds?: string[]): Promise<{
    success: boolean;
    images: any[];
    timestamp: number;
    error?: string;
  }> {
    try {
      const shouldProcessAll = !instanceIds || (instanceIds.length === 1 && instanceIds[0] === '<all>');
      const targetIds = shouldProcessAll ? [] : instanceIds;
      
      const instancesToProcess = shouldProcessAll ? this.instances : 
        this.instances.filter(instance => targetIds.includes(instance.id));

      const images: any[] = [];

      // Helper to extract embedded instances
      const getEmbeddedInstances = (instances: any[]) => {
        const embedded: any[] = [];
        for (const instance of instances) {
          if (instance.type === 'sketch') {
            embedded.push(...instance.content.filter((item: any) => 
              item.type === 'instance' && (shouldProcessAll || targetIds.includes(item.instance.id))
            ).map((item: any) => item.instance));
          } else if (instance.type === 'table') {
            embedded.push(...instance.cells.flat().filter((cell: any) => 
              cell && (shouldProcessAll || targetIds.includes(cell.id))
            ));
          }
        }
        return embedded;
      };

      // Process all instances (standalone + embedded)
      const allInstances = [...instancesToProcess, ...getEmbeddedInstances(shouldProcessAll ? this.instances : instancesToProcess)];
      
      for (const instance of allInstances) {
        if (instance.type === 'image') {
          images.push({
            id: instance.id,
            src: instance.src,
            width: instance.width,
            height: instance.height,
            type: 'image',
          });
        } else if (instance.type === 'sketch' && instance.thumbnail) {
          images.push({
            id: instance.id,
            src: instance.thumbnail,
            width: instance.width,
            height: instance.height,
            type: 'sketch_thumbnail',
          });
        } else if (instance.type === 'visualization' && instance.thumbnail) {
          images.push({
            id: instance.id,
            src: instance.thumbnail,
            width: instance.width,
            height: instance.height,
            type: 'visualization_thumbnail',
          });
        }
      }

      images.push(...this.imageContexts);

      return {
        success: true,
        images: images,
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        success: false,
        images: [],
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : 'Failed to get images',
      };
    }
  }

  // Get chat history
  async getChatHistory(): Promise<{
    success: boolean;
    messages: Message[];
    timestamp: number;
    error?: string;
  }> {
    try {
      return {
        success: true,
        messages: this.messages,
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        success: false,
        messages: [],
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : 'Failed to get chat history',
      };
    }
  }

  // Get all context data for backend
  async getAllContext(): Promise<{
    html_content?: string;
    metadata?: any;
    images?: any[];
    chat_history?: Message[];
    instances?: Instance[];
  }> {
    const [htmlResult, metadataResult, imageResult, chatResult] = await Promise.all([
      this.getHtmlContent(),
      this.getMetadata(),
      this.getImageContent(),
      this.getChatHistory(),
    ]);

    return {
      html_content: htmlResult.success ? htmlResult.html : undefined,
      metadata: metadataResult.success ? metadataResult.instances : undefined,
      images: imageResult.success ? imageResult.images : undefined,
      chat_history: chatResult.success ? chatResult.messages : undefined,
      instances: this.instances,
    };
  }

  // Add a new instance
  addInstance(instance: Instance): void {
    this.instances.push(instance);
  }

  // Remove an instance
  removeInstance(instanceId: string): void {
    this.instances = this.instances.filter(instance => instance.id !== instanceId);
  }

  // Update an instance
  updateInstance(instanceId: string, updates: Partial<Instance>): void {
    const index = this.instances.findIndex(instance => instance.id === instanceId);
    if (index !== -1) {
      this.instances[index] = { ...this.instances[index], ...updates } as Instance;
    }
  }

  // Add a new message
  addMessage(message: Message): void {
    this.messages.push(message);
  }

  // Clear all data
  clear(): void {
    this.instances = [];
    this.messages = [];
    this.htmlContexts = {};
    this.imageContexts = [];
  }
}

// Export singleton instance
export const contextService = new ContextService();
export default contextService; 