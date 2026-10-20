import fs from 'fs';
let content = fs.readFileSync('src/index.css', 'utf8');

// Completely remove the problematic text color overrides
const textOverridesRegex = /\/\* Text color overrides \*\/[\s\S]*?\/\* Main Borders \*\//;
content = content.replace(textOverridesRegex, '/* Main Borders */');

// Ensure header colors are exactly as requested: Light Brown (#b58b00) or similar
const headingsRegex = /\/\* HEADINGS & TITLES[\s\S]*?\/\* HOVER STATE FIXES/;
const newHeadings = `/* HEADINGS & TITLES (Explicitly Light Brown/Gold) */
h1, h2, h3, h4, h5, h6, .card-header, .section-title {
  color: #b58b00 !important;
}
.dark h1, .dark h2, .dark h3, .dark h4, .dark h5, .dark h6, .dark .card-header, .dark .section-title {
  color: #d97706 !important;
}

/* HOVER STATE FIXES`;
content = content.replace(headingsRegex, newHeadings);

fs.writeFileSync('src/index.css', content);
