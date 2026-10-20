const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

const oldSelector = `{/* Theme Selector */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-700/60 border border-slate-300 dark:border-slate-600 rounded p-1 text-xs shadow-sm hidden sm:flex">
                <Sun className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 mx-1.5" />
                <select 
                  value={theme} 
                  onChange={(e) => setTheme(e.target.value as any)}
                  className="bg-transparent font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
                  title="Select Theme"
                >
                  <option value="light">Soft Light</option>
                  <option value="dark">Dim Gray</option>
                  <option value="light-brown">Light Brown</option>
                  <option value="sky-blue">Sky Blue</option>
                </select>
              </div>`;

const newSelector = `{/* Theme Toggle Button */}
              <button
                onClick={() => setTheme(theme === 'glass' ? 'sky-blue' : 'glass')}
                className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-full px-3 py-1.5 shadow-sm transition hover:opacity-80"
                title="Toggle Dark/Light Mode"
              >
                {theme === 'glass' ? (
                  <>
                    <Sun className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-bold text-slate-300 hidden sm:inline">Light Mode</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-bold text-slate-700 hidden sm:inline">Dark Mode</span>
                  </>
                )}
              </button>`;

content = content.replace(oldSelector, newSelector);
fs.writeFileSync('src/App.tsx', content);
