const fs = require('fs');
let content = fs.readFileSync('src/views/GateSecurityView.tsx', 'utf8');

const target = `              {/* 8. Assigned Dedicated Dock (Read-Only) */}
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Assigned Dedicated Dock
                </label>
                <input
                  type="text"
                  value={
                    loadDivision === 'AIL' ? 'Auto-Assigned to AIL Zone (Docks 7-9)' :
                    loadDivision === 'AHPL' ? 'Auto-Assigned to AHPL Zone (Docks 1-4)' :
                    'Auto-Assigned sequentially per Stop'
                  }
                  disabled
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 rounded-lg p-2.5 text-[11px] font-bold cursor-not-allowed"
                />
              </div>`;

content = content.replace(target, '');
fs.writeFileSync('src/views/GateSecurityView.tsx', content);
console.log('Removed Assigned Dedicated Dock UI');
