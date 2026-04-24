const fs = require('fs');

let content = fs.readFileSync('client/src/lib/export.tsx', 'utf8');

// 1. Remove the aggressive flexWrap hack
const flexWrapHack = `// Force flex containers in the scheme to wrap if they are too wide
          const flexRows = printShell.querySelectorAll('.flex.items-center.gap-6, .flex.items-center.gap-3');
          flexRows.forEach(row => {
             row.style.flexWrap = 'wrap';
             row.style.justifyContent = 'center';
          });`;

if (content.includes(flexWrapHack)) {
  content = content.replace(flexWrapHack, '');
}

// 2. Remove the aggressive white-space and overflow overrides on ALL divs
const aggressiveCss = `/* Fix text clipping by ensuring no max-heights or weird overflows */
                 div, p, span, td, th {
                    overflow: visible !important;
                    text-overflow: clip !important;
                    white-space: normal !important;
                 }
                 /* Prevent flex layouts from collapsing text */
                 .truncate {
                    white-space: normal !important;
                    overflow: visible !important;
                    text-overflow: clip !important;
                 }`;

if (content.includes(aggressiveCss)) {
  content = content.replace(aggressiveCss, `/* Allow text to wrap only where necessary */
                 .truncate {
                    white-space: normal !important;
                    overflow: visible !important;
                    text-overflow: clip !important;
                 }
                 /* Ensure table cells don't clip */
                 td, th {
                    word-wrap: break-word !important;
                    white-space: normal !important;
                 }`);
}

// 3. Set windowWidth back to 1000 to match the A4 ratio, reducing layout shifts
content = content.replace(/windowWidth: 1400/g, 'windowWidth: 1000');

fs.writeFileSync('client/src/lib/export.tsx', content);

// 4. Update PrintSynthesis width back to 1000px for consistent layout
let printContent = fs.readFileSync('client/src/pages/PrintSynthesis.tsx', 'utf8');
printContent = printContent.replace(/w-\[1400px\]/g, 'w-[1000px]');

// 5. In ReactionScheme.tsx, we need to ensure the flex items don't shrink below their minimum sizes
let schemeContent = fs.readFileSync('client/src/components/ReactionScheme.tsx', 'utf8');
// Add shrink-0 to StructureCard wrapper
schemeContent = schemeContent.replace(
  'const wrapperClass = printMode\n    ? "flex min-w-[196px] max-w-[220px] flex-col items-center text-center gap-2"',
  'const wrapperClass = printMode\n    ? "flex shrink-0 min-w-[196px] max-w-[220px] flex-col items-center text-center gap-2"'
);
// Ensure the arrow container doesn't shrink below 120px
schemeContent = schemeContent.replace(
  '<div className="flex flex-col items-center gap-2 min-w-[120px]">',
  '<div className="flex flex-col items-center gap-2 shrink-0 min-w-[120px]">'
);

fs.writeFileSync('client/src/components/ReactionScheme.tsx', schemeContent);
console.log("Success reverting aggressive CSS overrides and fixing scheme flex shrink");
