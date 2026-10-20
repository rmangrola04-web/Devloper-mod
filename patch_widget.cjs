const fs = require('fs');
let content = fs.readFileSync('src/components/DashboardWidget.tsx', 'utf-8');

const target = `      {/* Security Checks */}
      <div className="widget-card bg-amber-50/80 dark:bg-[#242c3d] rounded-lg border border-amber-300 dark:border-[#3e4859] shadow-xs transition hover:shadow-sm">
        <div className="flex justify-between items-center text-amber-900 dark:text-amber-400">
          <span className="text-[10px] font-black uppercase tracking-wider">Security Checks</span>
          <div className="p-1.5 rounded bg-amber-200/80 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300">
            <ShieldAlert className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-1 flex-1 flex flex-col justify-end">
          <div className="flex items-center justify-between">
            <div className="widget-main-stat text-amber-950 dark:text-amber-300">
              {pendingSecurity}
            </div>
            <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold uppercase text-right">
              Checks<br/>Today
            </span>
          </div>
        </div>
      </div>`;

content = content.replace(target, '');
content = content.replace('grid-cols-1 sm:grid-cols-3', 'grid-cols-1 sm:grid-cols-2');

fs.writeFileSync('src/components/DashboardWidget.tsx', content);
