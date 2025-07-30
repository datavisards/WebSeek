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
        if (!element) return;
        
        // Scroll element into view
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Create highlight overlay
        const overlay = document.createElement('div');
        overlay.className = 'highlight-overlay';
        overlay.style.position = 'absolute';
        
        // Get element position relative to the iframe's content
        const rect = element.getBoundingClientRect();
        const iframeDocument = (iframe as HTMLIFrameElement).contentDocument!;
        const scrollTop = iframeDocument.documentElement.scrollTop || iframeDocument.body.scrollTop;
        const scrollLeft = iframeDocument.documentElement.scrollLeft || iframeDocument.body.scrollLeft;
        
        overlay.style.top = `${rect.top + scrollTop}px`;
        overlay.style.left = `${rect.left + scrollLeft}px`;
        overlay.style.width = `${rect.width}px`;
        overlay.style.height = `${rect.height}px`;
        
        // Add overlay to iframe document
        iframeDocument.body.appendChild(overlay);
        
        // Remove highlight after 5 seconds
        setTimeout(() => {
            if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        }, 5000);
    }
    
    function findElementByLocator(locator: any, iframeDocument: Document) {
        if (!locator || !iframeDocument) return null;
        
        try {
            // Locator is now just a stable ID string
            return iframeDocument.querySelector(`[data-aid-id="${locator}"]`);
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
        console.log('Snapshot ID:', snapshotId);
        console.log('Locator parameter:', locatorParam);
        
        if (!snapshotId) {
            showError('No snapshot ID provided');
            return;
        }
        
        let locator = null;
        if (locatorParam) {
            try {
                locator = JSON.parse(decodeURIComponent(locatorParam));
            } catch (error) {
                console.warn('Failed to parse locator parameter:', error);
            }
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
                // Give the iframe content a moment to fully render
                setTimeout(() => {
                    const targetElement = findElementByLocator(locator, (iframe as HTMLIFrameElement).contentDocument!);
                    if (targetElement) {
                        highlightElement(targetElement);
                    } else {
                        console.warn('Target element not found in snapshot');
                    }
                }, 500);
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