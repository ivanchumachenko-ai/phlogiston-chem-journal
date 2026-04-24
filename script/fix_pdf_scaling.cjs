const fs = require('fs');

let content = fs.readFileSync('client/src/lib/export.tsx', 'utf8');

// The issue in the screenshot is that the reaction scheme SVG is getting cut off on the right
// because we forced portrait scaling, but didn't allow the container to wrap or scale the SVG itself properly.
// The "ReactionScheme" container uses max-w-full and overflow-x-auto, which html2canvas might clip.

// 1. Let's fix the PrintSynthesis layout to ensure the scheme is fully visible
let printContent = fs.readFileSync('client/src/pages/PrintSynthesis.tsx', 'utf8');

// We need the scheme wrapper to not use overflow-x-auto during print, but flex-wrap or just be allowed to overflow
// The CSS override already has .overflow-x-auto { overflow: visible !important }
// But we need to make sure the SVGs themselves aren't getting cut off by fixed widths.
// In ReactionScheme.tsx, printMode sets min-w-[196px] max-w-[220px]. Let's adjust the html2canvas config
// to take a wider snapshot before scaling down to A4.

// Currently we use windowWidth: 1000. Let's change it back to 1200 or 1400 so it has plenty of room to render the wide scheme,
// and then scale it down to fit the A4 page.
content = content.replace(/windowWidth: 1000/g, 'windowWidth: 1400');
printContent = printContent.replace(/w-\[1000px\]/g, 'w-[1400px]');

// 2. Also ensure the pdfHeight/Width calculation strictly bounds both width and height for A4
const oldScaleLogic = `          // Force it to fit on one portrait page by scaling down if necessary
          if (pdfHeight > pageHeight) {
            // Document is taller than A4, scale by height
            pdfHeight = pageHeight;
            pdfWidth = (canvas.width * pdfHeight) / canvas.height;
            xOffset = (pageWidth - pdfWidth) / 2; // Center horizontally
          } else if (pdfWidth > pageWidth) {
            // Document is wider than A4, scale by width (though we start with pdfWidth = pageWidth)
            pdfWidth = pageWidth;
            pdfHeight = (canvas.height * pdfWidth) / canvas.width;
          }`;

const newScaleLogic = `          // Force it to fit on one portrait page by scaling down if necessary
          // First, fit to width
          if (pdfWidth > pageWidth) {
            pdfWidth = pageWidth;
            pdfHeight = (canvas.height * pdfWidth) / canvas.width;
          }
          
          // Then, if it's still too tall, fit to height
          if (pdfHeight > pageHeight) {
            const scale = pageHeight / pdfHeight;
            pdfHeight = pageHeight;
            pdfWidth = pdfWidth * scale;
            xOffset = (pageWidth - pdfWidth) / 2; // Center horizontally
          }`;

if (content.includes(oldScaleLogic)) {
  content = content.replace(oldScaleLogic, newScaleLogic);
}

// 3. Fix SVG sizing specifically in html2canvas onclone
const oldSvgLogic = `          // Ensure all SVG elements have explicit dimensions for html2canvas
          const svgs = printShell.querySelectorAll('svg');
          svgs.forEach(svg => {
            const width = svg.getAttribute('width') || svg.getBoundingClientRect().width;
            const height = svg.getAttribute('height') || svg.getBoundingClientRect().height;
            if (width && height) {
              svg.style.width = typeof width === 'number' ? \`\${width}px\` : width;
              svg.style.height = typeof height === 'number' ? \`\${height}px\` : height;
              svg.setAttribute('width', String(width));
              svg.setAttribute('height', String(height));
            }
          });`;

const newSvgLogic = `          // Ensure all SVG elements have explicit dimensions for html2canvas
          const svgs = printShell.querySelectorAll('svg');
          svgs.forEach(svg => {
            const rect = svg.getBoundingClientRect();
            // Try to get viewBox aspect ratio if width/height are missing
            let w = svg.getAttribute('width') || rect.width;
            let h = svg.getAttribute('height') || rect.height;
            
            if (!w || !h || w === 0 || h === 0) {
              const viewBox = svg.getAttribute('viewBox');
              if (viewBox) {
                 const parts = viewBox.split(' ');
                 if (parts.length === 4) {
                   w = parseFloat(parts[2]);
                   h = parseFloat(parts[3]);
                 }
              }
            }
            
            if (w && h) {
              // Set explicit pixel dimensions
              svg.style.width = typeof w === 'number' ? \`\${w}px\` : (w.toString().includes('%') ? \`\${rect.width}px\` : w);
              svg.style.height = typeof h === 'number' ? \`\${h}px\` : (h.toString().includes('%') ? \`\${rect.height}px\` : h);
              svg.setAttribute('width', parseFloat(w.toString()).toString());
              svg.setAttribute('height', parseFloat(h.toString()).toString());
              // Prevent flexbox from squishing it
              svg.style.minWidth = svg.style.width;
              svg.style.minHeight = svg.style.height;
            }
          });
          
          // Force flex containers in the scheme to wrap if they are too wide
          const flexRows = printShell.querySelectorAll('.flex.items-center.gap-6, .flex.items-center.gap-3');
          flexRows.forEach(row => {
             row.style.flexWrap = 'wrap';
             row.style.justifyContent = 'center';
          });`;

if (content.includes(oldSvgLogic)) {
  content = content.replace(oldSvgLogic, newSvgLogic);
}

fs.writeFileSync('client/src/lib/export.tsx', content);
fs.writeFileSync('client/src/pages/PrintSynthesis.tsx', printContent);
console.log("Success updating PDF scaling and SVG boundaries");
