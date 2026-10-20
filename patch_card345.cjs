const fs = require('fs');
let content = fs.readFileSync('src/views/DashboardView.tsx', 'utf-8');

// Replace Card 3
content = content.replace(
  /\{\/\* Card 3: Total Operations Done Today \*\/\}([\s\S]*?)\{\/\* Card 4:/,
  `{/* Card 3: Completed Plans */}
        <div className="widget-card bg-emerald-50/80 dark:bg-[#242c3d] rounded-lg border border-emerald-300 dark:border-[#3e4859] shadow-xs transition hover:shadow-sm">
          <div className="flex justify-between items-center text-emerald-900 dark:text-emerald-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Completed Plans</span>
            <div className="p-1.5 rounded bg-emerald-200/80 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1">
            <div className="flex items-center justify-between">
              <div className="widget-main-stat text-emerald-950 dark:text-emerald-300">
                {completedPlansToday}
              </div>
              <span className="text-[10px] text-emerald-800 dark:text-emerald-400 font-bold uppercase text-right">
                Plans<br/>Finished
              </span>
            </div>
            
            <p className="text-[10px] text-emerald-700 dark:text-slate-400 font-medium mt-1 text-right">
              Fully Confirmed/Archived
            </p>
          </div>
        </div>

        {/* Card 4:`
);

// We also need to fix Card 5 text back, because earlier I updated Card 5's footer to show Completed/Pending
content = content.replace(
  /<div className="mt-2 grid grid-cols-2 gap-1\.5 pt-1\.5 border-t border-sky-200 dark:border-\[#3e4859\]">[\s\S]*?<\/div>\s*<\/div>/,
  `<p className="text-[10px] text-sky-800/80 dark:text-slate-400 font-medium mt-1 text-right">
              Total Plan Entries for Today
            </p>
          </div>`
);

fs.writeFileSync('src/views/DashboardView.tsx', content);
