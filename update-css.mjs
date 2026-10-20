import fs from 'fs';
const newCSS = `@import "tailwindcss";

:root {
  /* ========================================================= */
  /* REFINED LIGHT MODE                                        */
  /* ========================================================= */
  /* Main Background - Soft Gray */
  --bg-main: #f0f2f5;        
  /* Sidebar - Solid Deep Dark Blue */
  --bg-sidebar: #0f172a;     
  /* Header - Distinct White */
  --bg-header: #ffffff;      
  /* Widget Cards - Pure White (Elevated above bg-main) */
  --bg-card: #ffffff;        
  
  --bg-input: #f8fafc;
  --bg-input-focus: #ffffff;
  
  --text-main: #334155;      /* Highly readable dark slate */
  --text-muted: #64748b;
  --text-sidebar: #f8fafc;
  --text-header: #1e293b;
  --text-heading: #b58b00;   /* Light Brown/Gold */
  
  --border-subtle: #e2e8f0;
  --border-sidebar: #1e293b;
  --border-header: #e2e8f0;
  --border-input: #cbd5e1;
  --border-focus: #3b82f6;

  --shadow-card: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
}

.dark {
  /* ========================================================= */
  /* REFINED DARK MODE                                         */
  /* ========================================================= */
  /* Main Background - Dim Slate Gray */
  --bg-main: #1e293b;        
  /* Sidebar - Solid Deep Black/Blue */
  --bg-sidebar: #020617;     
  /* Header - Distinct Slate */
  --bg-header: #0f172a;      
  /* Widget Cards - Elevated Gray */
  --bg-card: #334155;        
  
  --bg-input: #1e293b;
  --bg-input-focus: #334155;
  
  --text-main: #f8fafc;      /* Crisp off-white */
  --text-muted: #94a3b8;
  --text-sidebar: #f8fafc;
  --text-header: #f8fafc;
  --text-heading: #d97706;   /* Light Brown/Amber */
  
  --border-subtle: #475569;
  --border-sidebar: #1e293b;
  --border-header: #1e293b;
  --border-input: #64748b;
  --border-focus: #60a5fa;

  --shadow-card: 0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 10px 15px -3px rgba(0, 0, 0, 0.2);
}

/* ========================================================================== */
/* BASE STYLES                                                                */
/* ========================================================================== */
body {
  background-color: var(--bg-main) !important;
  color: var(--text-main) !important;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  transition: background-color 0.3s ease, color 0.3s ease;
  font-size: 13px;
  line-height: 1.5;
}

/* ========================================================================== */
/* 1. SIDEBAR MENU                                                            */
/* ========================================================================== */
aside, .sidebar {
  background-color: var(--bg-sidebar) !important;
  border-right: 1px solid var(--border-sidebar) !important;
  color: var(--text-sidebar) !important;
}

/* Ensure all links and text inside sidebar are high contrast white/blue */
aside h2, aside p, aside span, aside svg, aside a {
  color: var(--text-sidebar) !important;
}
/* Exception: Blue active buttons or specific role boxes shouldn't lose their text colors if they are explicitly colored */
aside .text-sky-400, aside .text-blue-400 {
  color: #38bdf8 !important;
}
aside .bg-\\[\\#fef3c7\\] *, aside .bg-\\[\\#1e3a8a\\] * {
  color: inherit !important;
}
/* Exception: Active menu item background text */
aside .bg-blue-600 * {
  color: #ffffff !important;
}

/* ========================================================================== */
/* 2. TOP HEADER BAR                                                          */
/* ========================================================================== */
header {
  background-color: var(--bg-header) !important;
  color: var(--text-header) !important;
  border-bottom: 1px solid var(--border-header) !important;
  box-shadow: 0 1px 3px 0 rgba(0,0,0,0.05);
}
header h1, header span:not(.bg-blue-50):not(.dark\\:bg-blue-950\\/60), header svg {
  color: var(--text-header) !important;
}
/* Ensure header inputs/buttons look distinct */
header .bg-slate-100, header .dark\\:bg-slate-700\\/60 {
  background-color: var(--bg-input) !important;
  border-color: var(--border-subtle) !important;
}

/* ========================================================================== */
/* 3. WIDGET CARDS & CONTAINERS                                               */
/* ========================================================================== */
/* Only target background classes INSIDE the main content area */
main div.bg-white, 
main div.bg-slate-50, 
main div.bg-slate-100, 
main div.bg-slate-800, 
main div.bg-slate-900, 
main div.bg-slate-950,
main div.bg-\\[\\#1e2430\\],
main div.bg-\\[\\#252e3e\\]\\/80,
main div.bg-slate-50\\/90 {
  background-color: var(--bg-card) !important;
  border-color: var(--border-subtle) !important;
  box-shadow: var(--shadow-card) !important;
}

/* Modal Overlay Backgrounds (prevent card styling) */
.bg-slate-900\\/90, .bg-slate-800\\/90 {
  background-color: rgba(0, 0, 0, 0.7) !important;
  backdrop-filter: blur(4px);
  box-shadow: none !important;
}

/* ========================================================================== */
/* 4. TEXT VISIBILITY & CONTRAST                                              */
/* ========================================================================== */
/* Section Headers & Titles */
h1, h2, h3, h4, h5, h6, .card-header, .section-title {
  color: var(--text-heading) !important;
  font-weight: 700;
}

/* Safe text overrides restricted to main area */
main .text-slate-900, 
main .text-slate-800, 
main .text-slate-700, 
main .text-white,
main .text-slate-100,
main .text-slate-200,
main .text-slate-300 {
  color: var(--text-main) !important;
}
main .text-slate-500, 
main .text-slate-400, 
main .text-slate-600 {
  color: var(--text-muted) !important;
}

/* Exception: Buttons and explicit colored pills should keep their white text */
main .bg-blue-600 .text-white, 
main .bg-emerald-500 .text-white,
main .bg-red-500 .text-white {
  color: #ffffff !important;
}

/* ========================================================================== */
/* 5. FORM CONTROLS (Input, Select, Options)                                  */
/* ========================================================================== */
input, textarea, select {
  background-color: var(--bg-input) !important;
  color: var(--text-main) !important;
  border: 1px solid var(--border-input) !important;
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
  font-weight: 500;
  transition: all 0.2s ease-in-out;
}
input:focus, textarea:focus, select:focus {
  background-color: var(--bg-input-focus) !important;
  border-color: var(--border-focus) !important;
  outline: none !important;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2) !important;
}
input::placeholder, textarea::placeholder {
  color: var(--text-muted) !important;
  opacity: 0.8;
}

/* Explicit high-contrast Dropdown Options */
option {
  background-color: #ffffff !important;
  color: #1e293b !important;
  font-weight: 500;
}
.dark option {
  background-color: #334155 !important;
  color: #f8fafc !important;
}

/* Checkboxes and Radios */
input[type="checkbox"], input[type="radio"] {
  background-color: var(--bg-input) !important;
}

/* Disabled */
input:disabled, select:disabled, textarea:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background-color: var(--bg-main) !important;
}

/* ========================================================================== */
/* 6. HOVER STATE FIXES (Remove Pitch Black)                                  */
/* ========================================================================== */
[class*="hover:bg-slate-"] {
  transition: background-color 0.2s ease;
}
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

/* Sidebar specific hovers */
aside [class*="hover:bg-slate-"]:hover {
  background-color: rgba(255, 255, 255, 0.1) !important;
}

/* ========================================================================== */
/* 7. TABLES                                                                  */
/* ========================================================================== */
table thead {
  background-color: var(--bg-main) !important;
  color: var(--text-heading) !important;
  border-bottom: 1px solid var(--border-subtle) !important;
}
table tbody tr {
  border-bottom: 1px solid var(--border-subtle) !important;
}
table tbody tr:hover {
  background-color: var(--bg-main) !important;
}
`;

fs.writeFileSync('src/index.css', newCSS);
