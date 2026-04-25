const fs = require('fs');
let content = fs.readFileSync('client/src/lib/export.tsx', 'utf8');

// Replace the exact section of code that removes stylesheet links
const oldCode = `                    // Remove original stylesheet links so html2canvas doesn't fetch and parse them
                    links.forEach(l => l.remove());
                  }`;

const newCode = `                  }
                  
                  // ALWAYS remove original stylesheet links so html2canvas doesn't fetch and parse them
                  // (which causes fatal 404 errors on GitHub Pages due to absolute paths)
                  links.forEach(l => l.remove());`;

content = content.replace(oldCode, newCode);
fs.writeFileSync('client/src/lib/export.tsx', content);
console.log('Fixed PDF CSS links issue');
