const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

// Force the theme to always be 'glass' temporarily, ignoring localStorage
content = content.replace(
  "const saved = localStorage.getItem('themePrefs') as any;",
  "const saved = 'glass';"
);

fs.writeFileSync('src/App.tsx', content);
