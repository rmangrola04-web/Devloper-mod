const fs = require('fs');

let content = fs.readFileSync('src/views/LiveDocksView.tsx', 'utf8');

const oldRender = `            {!record.shuttleSteps && (
               <div 
                  className="p-2 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 cursor-pointer hover:bg-slate-200"
                  onClick={() => onEditOperation(record)}
               >
                  <div className="text-[10px] text-slate-700 dark:text-slate-300 font-bold text-center flex items-center justify-center gap-1">
                      <span>Legacy / Single Entry</span>
                  </div>
               </div>
            )}`;

const newRender = `            {(!record.shuttleSteps || record.shuttleSteps.length === 0) && (
               <div 
                  className="p-4 rounded-xl bg-blue-100 dark:bg-blue-900/50 border border-blue-300 cursor-pointer hover:bg-blue-200 transition shadow-sm"
                  onClick={() => onEditOperation(record)}
               >
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-white dark:bg-slate-800 text-blue-600 border border-blue-200 dark:border-blue-700 shadow-sm">
                      {record.unit || 'PENDING'}
                    </span>
                    <span className="text-[9px] font-bold text-slate-500">Destination</span>
                  </div>
                  
                  <div className="text-[11px] text-slate-800 dark:text-slate-200 font-extrabold mt-2 mb-1 line-clamp-2">
                    {record.opType === 'LOADING' ? record.toLoc : record.fromLoc}
                  </div>
                  
                  {record.operator && (
                    <div className="text-[9px] text-slate-500 mt-2">Sup: {record.operator}</div>
                  )}
                  <div className="text-[9px] text-blue-600 font-bold mt-2 flex items-center justify-center gap-1">
                    <span>Click to Edit Operation</span>
                  </div>
               </div>
            )}`;

content = content.replace(oldRender, newRender);

fs.writeFileSync('src/views/LiveDocksView.tsx', content);
console.log('LiveDocksView updated');
