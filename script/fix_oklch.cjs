const fs = require('fs');

let content = fs.readFileSync('client/src/lib/export.tsx', 'utf8');

const oldStr = `          const canvas = await html2canvas(printShell, {
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
            }
          });`;

const newStr = `          const canvas = await html2canvas(printShell, {
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

               // html2canvas doesn't support CSS oklch() colors which Tailwind v4 uses heavily
               // We need to convert them to hex/rgb or strip them from elements before capture
               // A simple approach is to find elements with inline styles or computed styles
               // and replace oklch with fallback colors. However, html2canvas fails during parse.
               // We will inject a style tag to force safe colors for standard tailwind variables
               // and specifically strip oklch variables on root.
               const style = clonedDoc.createElement('style');
               style.innerHTML = \`
                 :root {
                   --background: 0 0% 100%;
                   --foreground: 222.2 84% 4.9%;
                   --card: 0 0% 100%;
                   --card-foreground: 222.2 84% 4.9%;
                   --popover: 0 0% 100%;
                   --popover-foreground: 222.2 84% 4.9%;
                   --primary: 222.2 47.4% 11.2%;
                   --primary-foreground: 210 40% 98%;
                   --secondary: 210 40% 96.1%;
                   --secondary-foreground: 222.2 47.4% 11.2%;
                   --muted: 210 40% 96.1%;
                   --muted-foreground: 215.4 16.3% 46.9%;
                   --accent: 210 40% 96.1%;
                   --accent-foreground: 222.2 47.4% 11.2%;
                   --destructive: 0 84.2% 60.2%;
                   --destructive-foreground: 210 40% 98%;
                   --border: 214.3 31.8% 91.4%;
                   --input: 214.3 31.8% 91.4%;
                   --ring: 214.3 31.8% 91.4%;
                   --radius: 222.2 84% 4.9%;
                 }
                 * {
                   /* override any inline oklch */
                 }
               \`;
               clonedDoc.head.appendChild(style);

               // Walk all elements and strip inline oklch styles
               const allElements = clonedDoc.querySelectorAll('*');
               allElements.forEach(el => {
                 const styleAttr = el.getAttribute('style');
                 if (styleAttr && styleAttr.includes('oklch')) {
                    // Replace oklch(...) with a safe fallback like #ccc
                    el.setAttribute('style', styleAttr.replace(/oklch\\([^)]+\\)/g, '#cccccc'));
                 }
               });
            }
          });`;

if (content.includes(oldStr)) {
  content = content.replace(oldStr, newStr);
  fs.writeFileSync('client/src/lib/export.tsx', content);
  console.log("Success replacing html2canvas config");
} else {
  console.log("Could not find oldStr");
}
