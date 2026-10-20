const fs = require('fs');
let content = fs.readFileSync('src/index.css', 'utf8');

const startStr = '[data-theme="glass"] {';
const startIndex = content.indexOf(startStr);
const endIndex = content.indexOf('}', startIndex) + 1;

const newGlassVars = `[data-theme="glass"] {
  --bg-main: #0b1120;
  --bg-sidebar: #020617;
  --bg-header: #0b1120;
  --bg-card: rgba(30, 41, 59, 0.65);
  --bg-input: rgba(15, 23, 42, 0.8);
  --bg-input-focus: rgba(30, 41, 59, 1);
  
  --text-main: #f8fafc;
  --text-muted: #94a3b8;
  --text-sidebar: #f8fafc;
  --text-header: #f8fafc;
  --text-heading: #f1f5f9;
  
  --border-subtle: rgba(255, 255, 255, 0.12);
  --border-sidebar: rgba(255, 255, 255, 0.08);
  --border-header: rgba(255, 255, 255, 0.1);
  --border-input: rgba(255, 255, 255, 0.2);
  --border-focus: #3b82f6;
  --shadow-card: 0 8px 32px 0 rgba(0, 0, 0, 0.4);
}`;

content = content.substring(0, startIndex) + newGlassVars + content.substring(endIndex);

fs.writeFileSync('src/index.css', content);
