import fs from 'fs';
let content = fs.readFileSync('src/index.css', 'utf8');

// 1. Remove `.text-white` from overrides
content = content.replace('.text-white,', '');
content = content.replace('.text-white', '');

// 2. Add Heading Colors
const headingCSS = `
/* ========================================================================== */
/* HEADINGS & TITLES (Explicitly Light Brown/Gold)                            */
/* ========================================================================== */
h1, h2, h3, h4, h5, h6, .card-header, .section-title {
  color: #b58b00 !important;
}
.dark h1, .dark h2, .dark h3, .dark h4, .dark h5, .dark h6, .dark .card-header, .dark .section-title {
  color: #d97706 !important;
}
`;

// 3. Fix Hover Backgrounds (Remove black hover states entirely)
// I will just add a global rule to map any tailwind dark hover background to something soft.
const hoverCSS = `
/* ========================================================================== */
/* HOVER STATE FIXES (Remove Pitch Black)                                     */
/* ========================================================================== */
[class*="hover:bg-slate-700"]:hover,
[class*="hover:bg-slate-800"]:hover,
[class*="hover:bg-slate-900"]:hover,
[class*="hover:bg-slate-950"]:hover,
[class*="hover:bg-black"]:hover {
  background-color: rgba(0, 0, 0, 0.05) !important;
}
.dark [class*="hover:bg-slate-700"]:hover,
.dark [class*="hover:bg-slate-800"]:hover,
.dark [class*="hover:bg-slate-900"]:hover,
.dark [class*="hover:bg-slate-950"]:hover,
.dark [class*="hover:bg-black"]:hover {
  background-color: rgba(255, 255, 255, 0.1) !important;
}

[class*="hover:bg-slate-100"]:hover,
[class*="hover:bg-slate-50"]:hover,
[class*="hover:bg-white"]:hover {
  background-color: rgba(0, 0, 0, 0.03) !important;
}
.dark [class*="hover:bg-slate-100"]:hover,
.dark [class*="hover:bg-slate-50"]:hover,
.dark [class*="hover:bg-white"]:hover {
  background-color: rgba(255, 255, 255, 0.05) !important;
}
`;

// 4. Dropdown options explicitly
const optionCSS = `
/* ========================================================================== */
/* DROPDOWN & SELECT OPTION FIXES                                             */
/* ========================================================================== */
option {
  background-color: #ffffff !important;
  color: #333333 !important;
  font-weight: 500;
}
.dark option {
  background-color: #4b5563 !important;
  color: #f3f4f6 !important;
}
select:focus > option:checked, 
select:focus > option:hover,
option:hover,
option:checked {
  background-color: #f0f9ff !important;
  color: #0369a1 !important;
}
.dark select:focus > option:checked, 
.dark select:focus > option:hover,
.dark option:hover,
.dark option:checked {
  background-color: #374151 !important;
  color: #93c5fd !important;
}
`;

// Append everything
content += headingCSS + hoverCSS + optionCSS;

fs.writeFileSync('src/index.css', content);
