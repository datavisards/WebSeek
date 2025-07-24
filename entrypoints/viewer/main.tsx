// WebSeek Snapshot Viewer
(async function() {
    const loadingEl = document.getElementById('loading');
    const errorEl = document.getElementById('error');
    const iframe = document.getElementById('snapshot-frame');
    const urlInfo = document.getElementById('url-info');
    
    function showError(message) {
        loadingEl.style.display = 'none';
        iframe.style.display = 'none';
        errorEl.textContent = message;
        errorEl.style.display = 'block';
    }
    
    function showContent() {
        loadingEl.style.display = 'none';
        errorEl.style.display = 'none';
        iframe.style.display = 'block';
    }
    
    function highlightElement(element) {
        if (!element) return;
        
        // Scroll element into view
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Create highlight overlay
        const overlay = document.createElement('div');
        overlay.className = 'highlight-overlay';
        overlay.style.position = 'absolute';
        
        // Get element position relative to the iframe's content
        const rect = element.getBoundingClientRect();
        const iframeDocument = iframe.contentDocument;
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
    
    function findElementByLocator(locator, iframeDocument) {
        if (!locator || !iframeDocument) return null;
        
        try {
            switch (locator.type) {
                case 'stableId':
                    return iframeDocument.querySelector(`[data-aid-id="${locator.value}"]`);
                
                case 'id':
                    return iframeDocument.getElementById(locator.value);
                
                case 'attribute':
                    const escapedValue = locator.value.replace(/"/g, '\\"');
                    return iframeDocument.querySelector(`[${locator.name}="${escapedValue}"]`);
                
                case 'contextual':
                    const anchorElement = findElementByLocator(locator.anchor, iframeDocument);
                    if (!anchorElement) return null;
                    
                    const targetElements = anchorElement.querySelectorAll(locator.target.tag);
                    return targetElements[locator.target.occurrence || 0] || null;
                
                case 'css':
                    return iframeDocument.querySelector(locator.selector);
                
                default:
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
            urlInfo.textContent = `Original URL: ${snapshotData.originalUrl}`;
        }
        
        // Set up iframe with sandbox for security
        iframe.sandbox = 'allow-same-origin';
        iframe.srcdoc = snapshotData.htmlContent;
        
        // Wait for iframe to load and then highlight element
        iframe.onload = () => {
            showContent();
            
            if (locator) {
                // Give the iframe content a moment to fully render
                setTimeout(() => {
                    const targetElement = findElementByLocator(locator, iframe.contentDocument);
                    if (targetElement) {
                        highlightElement(targetElement);
                    } else {
                        console.warn('Target element not found in snapshot');
                    }
                }, 500);
            }
        };
        
        iframe.onerror = () => {
            showError('Failed to load snapshot content');
        };
        
    } catch (error) {
        console.error('Error loading snapshot:', error);
        showError(`Error loading snapshot: ${error.message}`);
    }
})();