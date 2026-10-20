import fs from 'fs';
let content = fs.readFileSync('src/index.css', 'utf8');

// Remove duplicate option rule
const duplicateOptionRegex = /\/\* Dropdown Options \*\/[\s\S]*?font-weight: 500;\n\}/;
content = content.replace(duplicateOptionRegex, '');

fs.writeFileSync('src/index.css', content);
