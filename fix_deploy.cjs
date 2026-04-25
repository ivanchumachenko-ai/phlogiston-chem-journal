const fs = require('fs');
let content = fs.readFileSync('.github/workflows/deploy.yml', 'utf8');

content = content.replace(
  'cp dist/public/phlogiston.zip public_html/project.zip',
  'cp dist/public/phlogiston.zip public_html/phlogiston.zip'
);

fs.writeFileSync('.github/workflows/deploy.yml', content);
console.log('Fixed zip name in deploy.yml');
