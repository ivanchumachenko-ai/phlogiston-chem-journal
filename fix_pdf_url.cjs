const fs = require('fs');
let content = fs.readFileSync('client/src/lib/export.tsx', 'utf8');

// Replace the hardcoded absolute URL for the print iframe
const oldCode = `  // Load the print page in the iframe. Use the current location with hash router if active,
  // or window.location.origin + '/print' for absolute
  const printUrl = window.location.origin + '/print';`;

const newCode = `  // Load the print page in the iframe using hash routing
  // window.location.pathname ensures it works on GitHub Pages subdirectories
  const printUrl = window.location.origin + window.location.pathname + '#/print';`;

content = content.replace(oldCode, newCode);
fs.writeFileSync('client/src/lib/export.tsx', content);
console.log('Fixed PDF print iframe URL');
