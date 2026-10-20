const fs = require('fs');
let content = fs.readFileSync('src/index.css', 'utf-8');

const target = `.widget-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 1rem !important; /* Uniform padding */
  height: 110px !important; /* Strict uniform height for all operational cards */
}`;

const replacement = `.widget-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 0.875rem !important; /* Compact uniform padding */
  min-height: 140px !important;
  height: 100% !important; /* Stretch to grid cell height */
}`;

content = content.replace(target, replacement);
fs.writeFileSync('src/index.css', content);
