import React from 'react';
import { useEffect, useState } from 'react';

const ErrorDisplay = ({ message }: { message: string }) => (
  <div style={{
    padding: '1rem',
    color: '#a94442',
    backgroundColor: '#f2dede',
    border: '1px solid #ebccd1',
    borderRadius: '4px',
    fontSize: '0.9em',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  }}>
    <strong>Rendering Error:</strong>
    <p style={{ margin: '0.5em 0 0', fontFamily: 'monospace' }}>{message}</p>
  </div>
);

interface VisualizationRendererProps {
  spec: object;
  onImageUrlReady?: (url: string) => void; // Optional callback to expose the Data URL
}

const VisualizationRenderer: React.FC<VisualizationRendererProps> = ({ spec, onImageUrlReady }) => {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    setImageUrl('');
    fetch('http://127.0.0.1:8000/api/render-vega-lite/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(spec)
    })
    .then(response => {
      if (!response.ok) throw new Error('Failed to fetch image');
      return response.blob();
    })
    .then(blob => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        setImageUrl(dataUrl);
        if (onImageUrlReady) onImageUrlReady(dataUrl);
      };
      reader.onerror = () => setError('Failed to read image blob');
      reader.readAsDataURL(blob);
    })
    .catch(err => setError(err.message));
  }, [spec, onImageUrlReady]);

  if (error) return <ErrorDisplay message={error} />;
  if (!imageUrl) return <div>Loading...</div>;
  
  return (
    <img 
      src={imageUrl} 
      alt="Visualization" 
      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
    />
  );
};

export default VisualizationRenderer;