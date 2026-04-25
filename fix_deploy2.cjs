const fs = require('fs');
let content = fs.readFileSync('.github/workflows/deploy.yml', 'utf8');

// Replace the conflict block with the correct code
content = content.replace(
  /<<<<<<< HEAD[\s\S]*?=======\n[\s\S]*?>>>>>>>[^\n]*\n/g,
  '          cp dist/public/phlogiston.zip public_html/phlogiston.zip\n'
);

fs.writeFileSync('.github/workflows/deploy.yml', content);
console.log('Fixed conflict');
