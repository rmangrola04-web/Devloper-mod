import fs from 'fs';
const file = './src/views/LiveDocksView.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldLegacy = `            {!record.shuttleSteps && (
               <div className="text-[10px] text-slate-500 italic">Legacy Entry</div>
            )}`;

const newLegacy = `            {!record.shuttleSteps && (
               <div 
                  className="p-2 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 cursor-pointer hover:bg-slate-200"
                  onClick={() => onUpdateOperation(record)} // In a real app this could open EditOperationModal
               >
                  <div className="text-[10px] text-slate-700 dark:text-slate-300 font-bold text-center flex items-center justify-center gap-1">
                      <span>Legacy / Single Entry</span>
                  </div>
               </div>
            )}`;

content = content.replace(oldLegacy, newLegacy);

fs.writeFileSync(file, content);
console.log('patched LiveDocksView legacy entry');
