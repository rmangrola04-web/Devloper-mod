const fs = require('fs');
let content = fs.readFileSync('src/views/DashboardView.tsx', 'utf-8');

const target = `            <p className="text-[10px] text-sky-800/80 dark:text-slate-400 font-medium mt-1 text-right">
              Total Plan Entries for Today
            </p>`;

const replacement = `            <div className="mt-2 grid grid-cols-2 gap-1.5 pt-1.5 border-t border-sky-200 dark:border-[#3e4859]">
              <div className="bg-emerald-100/70 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800/80 rounded px-1.5 py-0.5 flex flex-col items-center">
                <span className="text-[8px] font-black uppercase text-emerald-800 dark:text-emerald-300">Completed</span>
                <span className="text-xs font-mono font-black text-emerald-950 dark:text-emerald-200">{completedPlansToday}</span>
              </div>
              <div className="bg-purple-100/70 dark:bg-purple-950/50 border border-purple-300 dark:border-purple-800/80 rounded px-1.5 py-0.5 flex flex-col items-center">
                <span className="text-[8px] font-black uppercase text-purple-800 dark:text-purple-300">Pending</span>
                <span className="text-xs font-mono font-black text-purple-950 dark:text-purple-200">{totalPendingPlans}</span>
              </div>
            </div>`;

content = content.replace(target, replacement);
fs.writeFileSync('src/views/DashboardView.tsx', content);
