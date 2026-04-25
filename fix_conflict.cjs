const fs = require('fs');
let content = fs.readFileSync('.github/workflows/deploy.yml', 'utf8');

// The conflict in the file
content = content.replace(/<<<<<<< HEAD\n.*\n=======\n.*\n>>>>>>> .*\n/g, '          cp dist/public/phlogiston.zip public_html/phlogiston.zip\n');

fs.writeFileSync('.github/workflows/deploy.yml', content);
