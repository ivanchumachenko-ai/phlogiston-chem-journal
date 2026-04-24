const fs = require('fs');
let content = fs.readFileSync('client/src/pages/PrintSynthesis.tsx', 'utf8');

// For portrait A4, the aspect ratio is 1:1.414
// If width is 1000, height is 1414. Let's use w-[1000px] to make it more compact 
// so it looks better when scaled onto an A4 page, rather than wide and stretched.
content = content.replace(/w-\[1200px\]/g, 'w-[1000px]');

// Also update the html2canvas config in export.tsx to match
let exportContent = fs.readFileSync('client/src/lib/export.tsx', 'utf8');
exportContent = exportContent.replace(/windowWidth: 1200/g, 'windowWidth: 1000');
fs.writeFileSync('client/src/lib/export.tsx', exportContent);

fs.writeFileSync('client/src/pages/PrintSynthesis.tsx', content);
console.log("Success updating print container to better fit A4 proportions");
