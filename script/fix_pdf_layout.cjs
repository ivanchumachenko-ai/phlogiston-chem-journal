const fs = require('fs');

let content = fs.readFileSync('client/src/lib/export.tsx', 'utf8');

// 1. The problem with gray boxes instead of text is usually related to background colors on text nodes
//    or z-index issues where backgrounds overlap text in html2canvas.
//    The "clipping" is often related to padding/margin translating poorly to absolute positioning
//    or width constraints.

// Let's modify the html2canvas config in export.tsx
const oldConfigStr = `          const canvas = await html2canvas(printShell, {
            scale: 2,
            useCORS: true,
            logging: false,
            windowWidth: 1200,`;

const newConfigStr = `          const canvas = await html2canvas(printShell, {
            scale: 2,
            useCORS: true,
            logging: false,
            windowWidth: 1200,
            allowTaint: true,
            backgroundColor: '#ffffff',
            removeContainer: true,`;

if (content.includes(oldConfigStr)) {
  content = content.replace(oldConfigStr, newConfigStr);
  fs.writeFileSync('client/src/lib/export.tsx', content);
  console.log("Success updating html2canvas config");
} else {
  console.log("Could not find html2canvas config");
}

// 2. Also fix the CSS injection to make text explicit and remove all backgrounds from labels that might obscure text
const oldStyleStr = `                 :root, *, ::before, ::after {`;

const newStyleStr = `                 :root, *, ::before, ::after {
                   color: #000000 !important; /* Force all text to black */
                   text-shadow: none !important;`;

if (content.includes(oldStyleStr)) {
  // Let's replace the whole style block to be safe and ensure backgrounds aren't grey
  const fullStyleSearch = `style.innerHTML = \`
                 :root, *, ::before, ::after {
                   --background: 0 0% 100% !important;`;
                   
  const fullStyleReplace = `style.innerHTML = \`
                 :root, *, ::before, ::after {
                   --background: 0 0% 100% !important;
                   --foreground: 0 0% 0% !important;
                   --card: 0 0% 100% !important;
                   color: #000000 !important;
                   background-color: transparent !important;
                   box-shadow: none !important;
                   border-color: #e5e5e5 !important;
                 }
                 .print-shell { background-color: white !important; }
                 .bg-stone-50 { background-color: #fafaf9 !important; }
                 .bg-white { background-color: #ffffff !important; }
                 /* Keep table headers slightly grey but readable */
                 th { background-color: #f5f5f5 !important; }
                 
                 /* Fix text clipping by ensuring no max-heights or weird overflows */
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
                 }
                 
                 :root {
                   --background: 0 0% 100% !important;`;

  if (content.includes(fullStyleSearch)) {
    content = content.replace(fullStyleSearch, fullStyleReplace);
    fs.writeFileSync('client/src/lib/export.tsx', content);
    console.log("Success updating html2canvas CSS overrides");
  } else {
    console.log("Could not find style block");
  }
}
