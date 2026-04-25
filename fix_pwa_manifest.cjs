const fs = require('fs');
let content = fs.readFileSync('vite.config.ts', 'utf8');

// Replace the hardcoded absolute paths in PWA manifest with dynamic ones based on base path
content = content.replace(
  "        scope: '/',\n        start_url: '/',\n        icons: [\n          {\n            src: '/favicon.png',",
  "        scope: '/phlogiston-chem-journal/',\n        start_url: '/phlogiston-chem-journal/',\n        icons: [\n          {\n            src: '/phlogiston-chem-journal/favicon.png',"
);

// Also fix the 512x512 icon
content = content.replace(
  "          {\n            src: '/favicon.png',\n            sizes: '512x512',",
  "          {\n            src: '/phlogiston-chem-journal/favicon.png',\n            sizes: '512x512',"
);

fs.writeFileSync('vite.config.ts', content);
console.log('Fixed PWA manifest paths');
