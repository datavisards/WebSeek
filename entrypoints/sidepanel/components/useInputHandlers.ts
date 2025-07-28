import { useCallback } from 'react';
import { Instance, TextInstance, ImageInstance } from '../types';
import { generateId, parseInstance } from '../utils';
import { createEmbeddedTextInstance, createEmbeddedImageInstance } from './instanceview-utils';

interface UseInputHandlersProps {
  instances: Instance[];
  setInstances: React.Dispatch<React.SetStateAction<Instance[]>>;
  onOperation: (message: string) => void;
  setImageCount: React.Dispatch<React.SetStateAction<number>>;
  imageCountRef: React.MutableRefObject<number>;
  setTextCount: React.Dispatch<React.SetStateAction<number>>;
  textCountRef: React.MutableRefObject<number>;
}

export const useInputHandlers = ({
  instances,
  setInstances,
  onOperation,
  setImageCount,
  imageCountRef,
  setTextCount,
  textCountRef,
}: UseInputHandlersProps) => {
  
  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const files = event.dataTransfer.files;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          if (result) {
            const newId = generateId();
            const newInstance: ImageInstance = {
              type: 'image',
              id: newId,
              source: { type: 'manual', createdAt: new Date().toISOString() },
              src: result,
              position: { x: x + i * 20, y: y + i * 20 },
              size: { width: 200, height: 150 }
            };
            setInstances(prev => [...prev, newInstance]);
            setImageCount(prev => prev + 1);
            imageCountRef.current += 1;
            onOperation(`Uploaded image [${newId}](#instance-${newId})`);
          }
        };
        reader.readAsDataURL(file);
      }
    }
  }, [instances, setInstances, onOperation, setImageCount, imageCountRef]);

  const handlePaste = useCallback((event: React.ClipboardEvent<HTMLDivElement>) => {
    const items = event.clipboardData.items;
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      if (item.type.indexOf('image') !== -1) {
        const blob = item.getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = (e) => {
            const result = e.target?.result as string;
            if (result) {
              const newId = generateId();
              const newInstance: ImageInstance = {
                type: 'image',
                id: newId,
                source: { type: 'manual', createdAt: new Date().toISOString() },
                src: result,
                position: { x: 50, y: 50 },
                size: { width: 200, height: 150 }
              };
              setInstances(prev => [...prev, newInstance]);
              setImageCount(prev => prev + 1);
              imageCountRef.current += 1;
              onOperation(`Pasted image [${newId}](#instance-${newId})`);
            }
          };
          reader.readAsDataURL(blob);
        }
      } else if (item.type === 'text/plain') {
        item.getAsString((text) => {
          if (text.trim()) {
            const newId = generateId();
            const newInstance: TextInstance = {
              type: 'text',
              id: newId,
              source: { type: 'manual', createdAt: new Date().toISOString() },
              content: text,
              position: { x: 50, y: 50 },
              size: { width: 300, height: 100 }
            };
            setInstances(prev => [...prev, newInstance]);
            setTextCount(prev => prev + 1);
            textCountRef.current += 1;
            onOperation(`Pasted text [${newId}](#instance-${newId})`);
          }
        });
      }
    }
  }, [setInstances, onOperation, setImageCount, imageCountRef, setTextCount, textCountRef]);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);

  return {
    handleDrop,
    handlePaste,
    handleDragOver,
  };
};