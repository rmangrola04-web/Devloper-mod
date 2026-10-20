const fs = require('fs');
let content = fs.readFileSync('src/views/LoadUnloadView.tsx', 'utf8');

// We will do a series of exact regex replacements to rip out the dead code.

// 1. Remove state variables for Shuttle
content = content.replace(/  \/\/ Shuttle Sequence States[\s\S]*?handlePickCurrentTime2 = \(\) => {[\s\S]*?};\n/g, '');

// 2. Remove Dual Loading States & Effects
content = content.replace(/  \/\/ Dual Loading State[\s\S]*?\}\n  \}, \[loadLocations\]\);\n/g, '');

// 3. Remove BOTH and SHUTTLE options from Company / Unit
content = content.replace(/                  <option value="BOTH">BOTH \(AHPL \& AIL - Dock 1 to 9\)<\/option>\n/g, '');
content = content.replace(/                  <option value="THERMOCOL">THERMOCOL \(All Docks\)<\/option>\n/g, '                  <option value="THERMOCOL">THERMOCOL (All Docks)</option>\n');
content = content.replace(/                  <option value="SHUTTLE">SHUTTLE ROUTE \(Multi-Dock\)<\/option>\n/g, '');

// 4. Clean up Dock dropdown
const dockTarget = `disabled={unit === 'BOTH' || unit === 'SHUTTLE'}
                  className={\`w-full border rounded p-1.5 text-xs font-bold \${unit === 'BOTH' || unit === 'SHUTTLE' ? 'bg-slate-200 dark:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-400 cursor-not-allowed' : 'bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-emerald-600 dark:text-emerald-400'}\`}
                >
                  {unit === 'BOTH' || unit === 'SHUTTLE' ? (
                     <option value={bayNo}>-- See Block Configuration Below --</option>
                  ) : dockList.map((dock) => {`;
const dockReplace = `className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400"
                >
                  {dockList.map((dock) => {`;
content = content.replace(dockTarget, dockReplace);
content = content.replace(/                    \);(?:(?!\);)[\s\S])*\}\)}/, '                    );\n                  })}'); // Wait, manual fix is safer.

fs.writeFileSync('src/views/LoadUnloadView.tsx', content);
