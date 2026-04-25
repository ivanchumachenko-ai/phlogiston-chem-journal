const fs = require('fs');
let content = fs.readFileSync('.github/workflows/deploy.yml', 'utf8');

// Update deploy.yml to copy the zip file into the public_html directory before uploading
const oldCode = `      - name: Unzip ready files
        run: unzip dist/public/phlogiston.zip -d public_html`;

const newCode = `      - name: Unzip ready files
        run: |
          unzip dist/public/phlogiston.zip -d public_html
          cp dist/public/phlogiston.zip public_html/project.zip`;

content = content.replace(oldCode, newCode);
fs.writeFileSync('.github/workflows/deploy.yml', content);
console.log('Fixed deploy.yml zip file');
