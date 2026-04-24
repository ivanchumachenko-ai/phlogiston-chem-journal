const fs = require('fs');

let content = fs.readFileSync('client/src/pages/PrintSynthesis.tsx', 'utf8');

// Replace all tracking-[0.xxem] classes with tracking-widest (which is standard tailwind and safer for html2canvas)
content = content.replace(/tracking-\[0\.28em\]/g, 'tracking-widest');
content = content.replace(/tracking-\[0\.2em\]/g, 'tracking-widest');
content = content.replace(/tracking-\[0\.24em\]/g, 'tracking-widest');

fs.writeFileSync('client/src/pages/PrintSynthesis.tsx', content);
console.log("Success replacing custom tracking classes");
