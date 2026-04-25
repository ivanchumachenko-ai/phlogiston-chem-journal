const fs = require('fs');
let content = fs.readFileSync('.github/workflows/deploy.yml', 'utf8');

// Just to be absolutely sure the conflict is resolved cleanly, let's rewrite the whole Unzip block
content = content.replace(
  /- name: Unzip ready files[\s\S]*?- name: Setup Pages/,
  `- name: Unzip ready files
        run: |
          unzip dist/public/phlogiston.zip -d public_html
          cp dist/public/phlogiston.zip public_html/phlogiston.zip
      - name: Setup Pages`
);

fs.writeFileSync('.github/workflows/deploy.yml', content);
