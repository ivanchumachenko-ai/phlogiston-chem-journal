const fs = require('fs');
let content = fs.readFileSync('client/src/lib/export.tsx', 'utf8');

const searchStr = `// 2. Strip inline styles containing oklch`;

const insertStr = `
               // Handle external stylesheets which html2canvas parses and crashes on
               try {
                 const links = clonedDoc.querySelectorAll('link[rel="stylesheet"]');
                 if (links.length > 0) {
                   let combinedCss = '';
                   // The original iframe document
                   const sourceDoc = iframe.contentDocument || iframe.contentWindow?.document;
                   if (sourceDoc && sourceDoc.styleSheets) {
                     for (let i = 0; i < sourceDoc.styleSheets.length; i++) {
                       const sheet = sourceDoc.styleSheets[i];
                       try {
                         for (let j = 0; j < sheet.cssRules.length; j++) {
                           combinedCss += sheet.cssRules[j].cssText + '\\n';
                         }
                       } catch(e) {
                         // ignore cross-origin stylesheet errors
                       }
                     }
                   }
                   if (combinedCss) {
                     // Replace oklch with a safe fallback
                     combinedCss = combinedCss.replace(/oklch\\([^)]+\\)/g, '#888888');
                     const styleNode = clonedDoc.createElement('style');
                     styleNode.innerHTML = combinedCss;
                     clonedDoc.head.appendChild(styleNode);
                     
                     // Remove original stylesheet links so html2canvas doesn't fetch and parse them
                     links.forEach(l => l.remove());
                   }
                 }
               } catch (e) {
                 console.warn("Failed to process stylesheets for oklch stripping", e);
               }
               
               `;

if (content.includes(searchStr) && !content.includes('Handle external stylesheets')) {
  content = content.replace(searchStr, insertStr + searchStr);
  fs.writeFileSync('client/src/lib/export.tsx', content);
  console.log("Success adding external stylesheet processing");
} else {
  console.log("Already applied or search string not found");
}
