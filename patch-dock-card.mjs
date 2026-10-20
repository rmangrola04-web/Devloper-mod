import fs from 'fs';
const file = './src/views/LiveDocksView.tsx';
let content = fs.readFileSync(file, 'utf8');

const search = `      return (
        <div key={dockName} className={\`p-5 rounded-xl shadow-sm min-h-[200px] space-y-3 text-xs transition-all \${cardColorClass}\`}>
          <div className="flex justify-between items-center font-bold">
            <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100">{dockName}</span>
            <span className={\`w-2.5 h-2.5 rounded-full \${dotClass}\`} />
          </div>
          <div className="bg-white/60 dark:bg-slate-900/40 px-3 py-2.5 rounded-lg flex justify-between items-center border border-slate-200/50 dark:border-slate-700/50">
             <p className="font-bold text-sm text-slate-800 dark:text-slate-100 font-mono">{vehicleNo}</p>
             <p className={\`text-[11px] font-bold uppercase tracking-wider \${statusClass}\`}>{record.status}</p>
          </div>
          
          <div className="space-y-3 pt-3 border-t border-slate-200/50 dark:border-slate-700/50">
            {record.shuttleSteps && record.shuttleSteps.map((step, index) => {`;

const replace = `      return (
        <div key={dockName} className={\`flex flex-col p-5 rounded-xl shadow-sm min-h-[250px] text-xs transition-all \${cardColorClass}\`}>
          <div className="flex justify-between items-center font-bold mb-3">
            <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100">{dockName}</span>
            <span className={\`w-2.5 h-2.5 rounded-full \${dotClass}\`} />
          </div>
          
          {/* Top: Vehicle Number */}
          <div className="bg-white/80 dark:bg-slate-900/60 px-3 py-2 rounded-lg border border-slate-200/50 dark:border-slate-700/50 mb-4 shadow-sm">
             <p className="font-bold text-lg text-slate-800 dark:text-slate-100 font-mono text-center tracking-widest">{vehicleNo}</p>
          </div>
          
          {/* Middle: Shuttle Steps */}
          <div className="flex-1 space-y-3">
            {record.shuttleSteps && record.shuttleSteps.map((step, index) => {`;

content = content.replace(search, replace);

const legacySearch = `            {!record.shuttleSteps && (
               <div 
                  className="p-2 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 cursor-pointer hover:bg-slate-200"
                  onClick={() => onEditOperation(record)} // In a real app this could open EditOperationModal
               >
                  <div className="text-[10px] text-slate-700 dark:text-slate-300 font-bold text-center flex items-center justify-center gap-1">
                      <span>Legacy / Single Entry</span>
                  </div>
               </div>
            )}
          </div>
        </div>
      );`;

const legacyReplace = `            {!record.shuttleSteps && (
               <div 
                  className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 cursor-pointer hover:bg-slate-200"
                  onClick={() => onEditOperation(record)}
               >
                  <div className="text-[11px] text-slate-700 dark:text-slate-300 font-bold text-center flex items-center justify-center gap-1">
                      <span>Single Drop / Legacy Entry</span>
                  </div>
               </div>
            )}
          </div>

          {/* Bottom: Highlighted Status Box */}
          <div className="mt-5 pt-4 border-t border-slate-200/50 dark:border-slate-700/50">
             <div className={\`w-full py-2 px-3 rounded-md text-center font-extrabold uppercase tracking-widest text-[11px] shadow-sm \${
                 isLoad ? 'bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700' 
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700'
             }\`}>
                {record.status}
             </div>
          </div>
        </div>
      );`;

content = content.replace(legacySearch, legacyReplace);

fs.writeFileSync(file, content);
console.log('patched dock card layout');
