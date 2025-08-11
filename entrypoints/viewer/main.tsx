// WebSeek Snapshot Viewer
(async function() {
    const loadingEl = document.getElementById('loading');
    const errorEl = document.getElementById('error');
    const iframe = document.getElementById('snapshot-frame');
    const urlInfo = document.getElementById('url-info');
    
    function showError(message: string) {
        loadingEl!.style.display = 'none';
        (iframe as HTMLIFrameElement)!.style.display = 'none';
        errorEl!.textContent = message;
        errorEl!.style.display = 'block';
    }
    
    function showContent() {
        loadingEl!.style.display = 'none';
        errorEl!.style.display = 'none';
        (iframe as HTMLIFrameElement)!.style.display = 'block';
    }
    
    function highlightElement(element: HTMLElement) {
        if (!element) {
            console.warn('No element provided for highlighting');
            return;
        }
        
        console.log('Starting to highlight element:', element);
        
        const iframeElement = iframe as HTMLIFrameElement;
        const iframeDocument = iframeElement.contentDocument!;
        
        if (!iframeDocument) {
            console.error('Cannot access iframe document');
            return;
        }
        
        // First, scroll element into view within the iframe context
        try {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            console.log('Scrolled element into view');
            
            // Wait a moment for smooth scrolling to complete before calculating positions
            setTimeout(() => {
                console.log('Recalculating position after scroll...');
                updateOverlayPosition();
            }, 600);
        } catch (error) {
            console.warn('Error scrolling element into view:', error);
            // If scrolling fails, create overlay immediately
            updateOverlayPosition();
        }
        
        function updateOverlayPosition() {
            console.log('Highlighting element directly:', element);
            
            // Store original styles to restore later
            const originalBorder = element.style.border;
            const originalBoxShadow = element.style.boxShadow;
            const originalOutline = element.style.outline;
            
            // Apply highlight directly to the element
            element.style.border = '3px solid #ff6b35';
            element.style.boxShadow = '0 0 20px rgba(255, 107, 53, 0.8)';
            element.style.outline = 'none';
            element.style.transition = 'all 0.3s ease';
            
            console.log('Applied direct highlighting to element');
            
            // Remove highlight after 5 seconds
            setTimeout(() => {
                element.style.border = originalBorder;
                element.style.boxShadow = originalBoxShadow;
                element.style.outline = originalOutline;
                console.log('Removed direct highlighting from element');
            }, 5000);
        }
    }
    
    function findElementByLocator(locator: any, iframeDocument: Document) {
        if (!locator || !iframeDocument) return null;
        
        try {
            console.log('Searching for element with locator:', locator);
            
            // Locator is now just a stable ID string
            const element = iframeDocument.querySelector(`[data-aid-id="${locator}"]`);
            
            if (element) {
                console.log('Found element:', element);
                return element;
            } else {
                console.warn('Element not found with locator:', locator);
                // Debug: log all elements with data-aid-id attributes
                const allElements = iframeDocument.querySelectorAll('[data-aid-id]');
                console.log(`Found ${allElements.length} elements with data-aid-id attributes:`, 
                    Array.from(allElements).slice(0, 10).map(el => el.getAttribute('data-aid-id')));
                return null;
            }
        } catch (error) {
            console.warn('Error finding element by locator:', error);
            return null;
        }
    }
    
    try {
        // Get URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const snapshotId = urlParams.get('snapshotId');
        const locatorParam = urlParams.get('locator');
        console.log('Viewer loaded with URL:', window.location.href);
        console.log('Snapshot ID:', snapshotId);
        console.log('Locator parameter:', locatorParam);
        console.log('All URL params:', Array.from(urlParams.entries()));
        
        if (!snapshotId) {
            showError('No snapshot ID provided');
            return;
        }
        
        let locator = null;
        if (locatorParam) {
            locator = decodeURIComponent(locatorParam);
            console.log('Decoded locator:', locator);
        }
        
        // Fetch snapshot data
        const response = await fetch(`http://localhost:8000/api/snapshots/${snapshotId}`);
        if (!response.ok) {
            showError(`Failed to load snapshot: ${response.status} ${response.statusText}`);
            return;
        }
        
        const snapshotData = await response.json();
        
        // Update URL info
        if (snapshotData.originalUrl) {
            urlInfo!.textContent = `Original URL: ${snapshotData.originalUrl}`;
        }
        
        // Set up iframe with sandbox for security
        (iframe as HTMLIFrameElement).sandbox = 'allow-same-origin';
        (iframe as HTMLIFrameElement).srcdoc = snapshotData.htmlContent;
        
        // Wait for iframe to load and then highlight element
        (iframe as HTMLIFrameElement).onload = () => {
            showContent();
            
            if (locator) {
                console.log('Will attempt to highlight element with locator:', locator);
                
                // Function to try highlighting with retries
                let highlightAttempted = false;
                let retryTimeouts: number[] = [];
                
                const clearAllTimeouts = () => {
                    retryTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
                    retryTimeouts = [];
                };
                
                const tryHighlight = (retryCount = 0) => {
                    if (highlightAttempted) {
                        console.log('Highlighting already attempted, skipping retry');
                        return;
                    }
                    
                    const iframeDocument = (iframe as HTMLIFrameElement).contentDocument;
                    if (!iframeDocument) {
                        console.error('Cannot access iframe document for highlighting');
                        return;
                    }
                    
                    const targetElement = findElementByLocator(locator, iframeDocument);
                    if (targetElement) {
                        console.log(`Found target element on attempt ${retryCount + 1}, highlighting...`);
                        highlightAttempted = true; // Mark as attempted before calling highlightElement
                        clearAllTimeouts(); // Cancel all pending retry attempts
                        try {
                            highlightElement(targetElement as HTMLElement);
                            console.log('Successfully highlighted element!');
                            return; // Stop retrying once we succeed
                        } catch (error) {
                            console.error('Error highlighting element:', error);
                            highlightAttempted = false; // Allow retry on error
                        }
                    }
                    
                    if (retryCount < 5) {
                        console.log(`Element not found on attempt ${retryCount + 1}, retrying in ${500 * (retryCount + 1)}ms...`);
                        console.log('Available elements with data-aid-id:', 
                            Array.from(iframeDocument.querySelectorAll('[data-aid-id]')).slice(0, 5).map(el => el.getAttribute('data-aid-id')));
                        const timeoutId = setTimeout(() => tryHighlight(retryCount + 1), 500 * (retryCount + 1)) as any;
                        retryTimeouts.push(timeoutId);
                    } else {
                        console.warn('Target element not found after all retries');
                        console.warn('Looking for locator:', locator);
                        console.warn('Total elements with data-aid-id:', iframeDocument.querySelectorAll('[data-aid-id]').length);
                    }
                };
                
                // Start highlighting attempts after iframe loads
                setTimeout(() => tryHighlight(), 500);
            }
        };
        
        (iframe as HTMLIFrameElement).onerror = () => {
            showError('Failed to load snapshot content');
        };
        
    } catch (error) {
        console.error('Error loading snapshot:', error);
        showError(`Error loading snapshot: ${(error as Error).message}`);
    }
})();