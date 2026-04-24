const fs = require('fs');

let content = fs.readFileSync('client/src/lib/export.tsx', 'utf8');

// The issue with grey boxes obscuring text is almost certainly due to how html2canvas handles 
// nested backgrounds, text color variables, and CSS specificity from Tailwind.
// We need to make the override CSS much stronger and target text elements specifically.

const oldStyleStr = `                 :root, *, ::before, ::after {
                   --background: 0 0% 100% !important;
                   --foreground: 0 0% 0% !important;
                   --card: 0 0% 100% !important;
                   color: #000000 !important;
                   background-color: transparent !important;
                   box-shadow: none !important;
                   border-color: #e5e5e5 !important;
                 }`;

const newStyleStr = `                 :root, *, ::before, ::after {
                   --background: 0 0% 100% !important;
                   --foreground: 0 0% 0% !important;
                   --card: 0 0% 100% !important;
                   --muted: 0 0% 96% !important;
                   --muted-foreground: 0 0% 40% !important;
                   --border: 0 0% 90% !important;
                   color: #000000 !important;
                   background-color: transparent !important;
                   box-shadow: none !important;
                   border-color: #e5e5e5 !important;
                   /* Force visibility */
                   visibility: visible !important;
                   opacity: 1 !important;
                 }
                 
                 /* Specifically fix text elements that might get grey boxes */
                 span, p, div, h1, h2, h3, td, th {
                   color: #000000 !important;
                   background: none !important;
                   background-color: transparent !important;
                 }`;

if (content.includes(oldStyleStr)) {
  content = content.replace(oldStyleStr, newStyleStr);
  fs.writeFileSync('client/src/lib/export.tsx', content);
  console.log("Success updating html2canvas advanced CSS overrides");
} else {
  console.log("Could not find old style block for advanced fix");
}

// 2. We also need to fix the padding and margins in PrintSynthesis that cause clipping
let printContent = fs.readFileSync('client/src/pages/PrintSynthesis.tsx', 'utf8');

// Replace the main container classes to ensure it doesn't clip content
// We had w-[1200px] but sometimes the content inside is wider. Let's use max-w-[1200px] w-full
// and ensure we don't have overflow-hidden anywhere on the main body
printContent = printContent.replace(/w-\[1200px\]/g, 'w-[1200px] max-w-none');

fs.writeFileSync('client/src/pages/PrintSynthesis.tsx', printContent);
console.log("Success updating PrintSynthesis container width");
