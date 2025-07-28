import { InstanceSource, EmbeddedInstance } from '../types';
import { generateId } from '../utils';

// Helper function to create manual source for instances created within the app
export const createManualSource = (): InstanceSource => ({
  type: 'manual',
  createdAt: new Date().toISOString()
});

// Helper functions to create embedded instances with proper source
export const createEmbeddedTextInstance = (content: string, originalId?: string): EmbeddedInstance => ({
  type: 'text',
  id: generateId(),
  source: createManualSource(),
  content,
  originalId
});

export const createEmbeddedImageInstance = (src: string, originalId?: string): EmbeddedInstance => ({
  type: 'image',
  id: generateId(),
  source: createManualSource(),
  src,
  originalId
});