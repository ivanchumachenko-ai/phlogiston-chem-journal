const fs = require('fs');
let content = fs.readFileSync('client/src/lib/export.tsx', 'utf8');

// Fix print preview window URL
content = content.replace(
  `    const previewWindow = window.open("/print", "_blank", "noopener,noreferrer");
    if (!previewWindow) {
      window.location.href = "/print";
    }`,
  `    // Use hash router path to ensure it works on GitHub Pages subdirectories
    const printPath = window.location.pathname + '#/print';
    const previewWindow = window.open(printPath, "_blank", "noopener,noreferrer");
    if (!previewWindow) {
      window.location.href = printPath;
    }`
);

fs.writeFileSync('client/src/lib/export.tsx', content);
console.log('Fixed PDF print preview window URLs');
