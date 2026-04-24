const fs = require('fs');
let content = fs.readFileSync('client/src/lib/export.tsx', 'utf8');

// Update to catch computed styles as well
const newStr2 = `
          // We need a more comprehensive way to strip oklch before html2canvas sees it
          const canvas = await html2canvas(printShell, {
            scale: 2,
            useCORS: true,
            logging: false,
            windowWidth: 1200,
            onclone: (clonedDoc) => {
               const controls = clonedDoc.querySelector('.print-controls');
               if (controls) controls.remove();
               
               // Fix reaction scheme overflow
               const schemeWrap = clonedDoc.querySelector('.overflow-x-auto');
               if (schemeWrap) {
                 schemeWrap.style.overflow = 'visible';
               }

               // html2canvas fails hard on oklch() color syntax which Tailwind v4 uses
               // We must remove or replace it from all elements in the cloned document
               
               // 1. Override CSS variables that might contain oklch
               const style = clonedDoc.createElement('style');
               style.innerHTML = \`
                 :root, *, ::before, ::after {
                   --background: 0 0% 100% !important;
                   --foreground: 222.2 84% 4.9% !important;
                   --card: 0 0% 100% !important;
                   --card-foreground: 222.2 84% 4.9% !important;
                   --popover: 0 0% 100% !important;
                   --popover-foreground: 222.2 84% 4.9% !important;
                   --primary: 222.2 47.4% 11.2% !important;
                   --primary-foreground: 210 40% 98% !important;
                   --secondary: 210 40% 96.1% !important;
                   --secondary-foreground: 222.2 47.4% 11.2% !important;
                   --muted: 210 40% 96.1% !important;
                   --muted-foreground: 215.4 16.3% 46.9% !important;
                   --accent: 210 40% 96.1% !important;
                   --accent-foreground: 222.2 47.4% 11.2% !important;
                   --destructive: 0 84.2% 60.2% !important;
                   --destructive-foreground: 210 40% 98% !important;
                   --border: 214.3 31.8% 91.4% !important;
                   --input: 214.3 31.8% 91.4% !important;
                   --ring: 214.3 31.8% 91.4% !important;
                   --radius: 0.5rem !important;
                 }
               \`;
               clonedDoc.head.appendChild(style);

               // 2. Strip inline styles containing oklch
               const allElements = clonedDoc.querySelectorAll('*');
               for (let i = 0; i < allElements.length; i++) {
                 const el = allElements[i];
                 const styleAttr = el.getAttribute('style');
                 if (styleAttr && styleAttr.includes('oklch')) {
                    // Replace oklch(...) with a safe fallback
                    el.setAttribute('style', styleAttr.replace(/oklch\\([^)]+\\)/g, '#cccccc'));
                 }
                 
                 // Clean up classes that might trigger oklch from tailwind if needed
                 // (usually covered by the CSS variable overrides above)
               }
               
               // Remove style tags that might have oklch in them (except the one we just added)
               const styleTags = clonedDoc.querySelectorAll('style:not(:last-child)');
               for (let i = 0; i < styleTags.length; i++) {
                 const st = styleTags[i];
                 if (st.innerHTML.includes('oklch')) {
                   st.innerHTML = st.innerHTML.replace(/oklch\\([^)]+\\)/g, '#cccccc');
                 }
               }
            }
          });`;

const searchStr = `          const canvas = await html2canvas(printShell, {`;
const endStr = `          });`;

const startIdx = content.indexOf(searchStr);
if (startIdx !== -1) {
  const nextEndIdx = content.indexOf(endStr, startIdx);
  if (nextEndIdx !== -1) {
    const prefix = content.substring(0, startIdx);
    const suffix = content.substring(nextEndIdx + endStr.length);
    fs.writeFileSync('client/src/lib/export.tsx', prefix + newStr2 + suffix);
    console.log("Success with fix_oklch_2");
  }
}
