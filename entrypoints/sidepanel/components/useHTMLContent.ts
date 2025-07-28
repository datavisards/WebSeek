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
      const response = await fetch(`http://localhost:8000/api/snapshots/${pageId}`);
      if (response.ok) {
        const snapshotData = await response.json();
        const cleanedHTML = cleanHTML(snapshotData.htmlContent);
        
        htmlCache.current[pageId] = cleanedHTML;
        
        updateHTMLContext(prev => ({
          ...prev,
          [pageId]: {
            pageURL: pageURL,
            htmlContent: cleanedHTML
          }
        }));
        console.log("HTML fetched and cached for pageId:", pageId);
      } else if (response.status === 404 && retryCount < maxRetries) {
        // Snapshot not ready yet, retry after delay
        console.log(`Snapshot not ready for pageId: ${pageId}, retrying in ${retryDelay}ms (attempt ${retryCount + 1}/${maxRetries + 1})`);
        setTimeout(() => {
          fetchHTMLContent(pageId, pageURL, retryCount + 1);
        }, retryDelay);
        return; // Don't set loading to false yet
      } else {
        console.warn(`Failed to fetch snapshot for pageId: ${pageId} (status: ${response.status})`);
      }
    } catch (error) {
      if (retryCount < maxRetries) {
        console.log(`Error fetching snapshot for pageId: ${pageId}, retrying in ${retryDelay}ms (attempt ${retryCount + 1}/${maxRetries + 1})`);
        setTimeout(() => {
          fetchHTMLContent(pageId, pageURL, retryCount + 1);
        }, retryDelay);
        return; // Don't set loading to false yet
      } else {
        console.error("Error fetching HTML content after max retries:", error);
      }
    } finally {
      // Only set loading to false if we're not retrying
      if (retryCount >= maxRetries || htmlCache.current[pageId]) {
        setHtmlLoadingStates(prev => ({ ...prev, [pageId]: false }));
      }
    }
  }, [updateHTMLContext]);

  return {
    htmlLoadingStates,
    fetchHTMLContent
  };
};