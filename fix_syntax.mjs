import fs from 'fs';

let content = fs.readFileSync('index.html', 'utf8');

// The bash heredoc left literal \` and \${ in the code
content = content.replace(/\\\`/g, '`');
content = content.replace(/\\\$\{/g, '${');

fs.writeFileSync('index.html', content);
console.log('Fixed syntax errors');
