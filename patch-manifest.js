const fs = require('fs');
const path = require('path');

const manifestPath = path.join(__dirname, '.output/chrome-mv3-dev/manifest.json');

// Read the existing manifest
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

// Add the side_panel and permissions
manifest.permissions = [...(manifest.permissions || []), 'sidePanel'];
manifest.side_panel = {
  default_path: 'sidepanel.html',
};

// Write the updated manifest back
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log('Manifest patched successfully.');
