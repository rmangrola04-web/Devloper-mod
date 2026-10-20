const fs = require('fs');
const file = 'src/index.css';
let content = fs.readFileSync(file, 'utf8');

// Replace the glass theme variable definitions
const glassStart = '[data-theme="glass"] {';
const glassEndRegex = /\[data-theme="glass"\] \{\s*(?:--[^;]+;\s*)+\}/;

const newGlassVars = `[data-theme="glass"] {
  --bg-main: #0b1120; /* Very dark blue/slate for high contrast */
  --bg-sidebar: #020617; /* Almost black */
  --bg-header: #0b1120;
  --bg-card: rgba(30, 41, 59, 0.65); /* Translucent Slate 800 */
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

content = content.replace(glassEndRegex, newGlassVars);

// Remove the forced dark text overrides for glass cards
content = content.replace(/\[data-theme="glass"\] main \.text-slate-100,[\s\S]*?color: #0f172a !important;\s*\}/g, '');
content = content.replace(/\[data-theme="glass"\] main \.text-slate-400,[\s\S]*?color: #334155 !important;\s*\}/g, '');
content = content.replace(/\[data-theme="glass"\] \.widget-main-stat,[\s\S]*?color: #0f172a !important;\s*\}/g, '');
content = content.replace(/\[data-theme="glass"\] \.widget-card \.font-black\s*\{\s*color: #1e293b !important;\s*\}/g, '');

fs.writeFileSync(file, content);
