const fs = require('fs');
const file = 'src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "      htmlEl.setAttribute('data-theme', theme);",
  "      htmlEl.setAttribute('data-theme', theme);\n      if (theme === 'glass') {\n        htmlEl.classList.add('dark');\n      }"
);

fs.writeFileSync(file, content);
