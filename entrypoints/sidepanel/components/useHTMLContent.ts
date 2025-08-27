import { useState, useRef, useCallback } from 'react';
import { cleanHTML } from '../utils';

export const useHTMLContent = (updateHTMLContext: React.Dispatch<React.SetStateAction<Record<string, {pageURL: string, htmlContent: string}>>>) => {
  const htmlCache = useRef<Record<string, string>>({});
  const [htmlLoadingStates, setHtmlLoadingStates] = useState<Record<string, boolean>>({});
  
  const fetchHTMLContent = useCallback(async (pageId: string, pageURL: string, retryCount = 0) => {
    if (htmlCache.current[pageId]) {
      updateHTMLContext(prev => ({
        ...prev,
        [pageId]: {
          pageURL: pageURL,
          htmlContent: htmlCache.current[pageId]
        }
      }));
      return;
    }
    
    setHtmlLoadingStates(prev => ({ ...prev, [pageId]: true }));
    
    const maxRetries = 5;
    const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 5000); // Exponential backoff, max 5s
    
    try {
      // Use background script proxy to avoid HTTPS/HTTP mixed content issues  
      const backendUrl = `http://${import.meta.env.VITE_BACKEND_URL}`; // Force HTTP
      const response = await chrome.runtime.sendMessage({
        type: 'PROXY_FETCH',
        url: `${backendUrl}/api/snapshots/${pageId}`,
        options: { method: 'GET' }
      });
      
      if (response?.ok) {
        const snapshotData = JSON.parse(response.data);
        const cleanedHTML = cleanHTML(snapshotData.htmlContent);
        
        htmlCache.current[pageId] = cleanedHTML;
        
        updateHTMLContext(prev => ({
          ...prev,
          [pageId]: {
            pageURL: pageURL,
            htmlContent: cleanedHTML
          }
        }));
      } else if (response?.status === 404 && retryCount < maxRetries) {
        // Snapshot not ready yet, retry after delay
        setTimeout(() => {
          fetchHTMLContent(pageId, pageURL, retryCount + 1);
        }, retryDelay);
        return; // Don't set loading to false yet
      } else {
        console.warn(`Failed to fetch snapshot for pageId: ${pageId} (status: ${response?.status || 'Unknown'})`);
      }
    } catch (error) {
      if (retryCount < maxRetries) {
        setTimeout(() => {
          fetchHTMLContent(pageId, pageURL, retryCount + 1);
        }, retryDelay);
        return; // Don't set loading to false yet
      } else {
        console.error("Error fetching HTML content after max retries:", error);
      }
    } finally {
      // Only set loading to false if we're not retrying
      const shouldClearLoading = retryCount >= maxRetries || htmlCache.current[pageId];
      if (shouldClearLoading) {
        setHtmlLoadingStates(prev => ({ ...prev, [pageId]: false }));
      }
    }
  }, [updateHTMLContext]);

  return {
    htmlLoadingStates,
    fetchHTMLContent
  };
};