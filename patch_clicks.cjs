const fs = require('fs');

let content = fs.readFileSync('src/views/LiveDocksView.tsx', 'utf8');

const t1 = `                    if (isActive) {
                      if (isPending) setStartingStep({ entry: record, index });
                      else if (step.status === 'IN-PROGRESS') setFinishingStep({ entry: record, index });
                    } else if (isCompleted) {
                      setFinishingStep({ entry: record, index });
                    }`;

const r1 = `                    if (isPending) {
                      setStartingStep({ entry: record, index });
                    } else if (step.status === 'IN-PROGRESS' || isCompleted) {
                      setFinishingStep({ entry: record, index });
                    }`;

content = content.replace(t1, r1);

// Also we should make sure the UI highlights ANY in-progress or pending step
// Currently:
// if (isActive && step.status === 'IN-PROGRESS') ...
// else if (isActive && isPending) ...
const t2 = `              let stepBg = 'bg-slate-100 dark:bg-slate-800';
              if (isActive && step.status === 'IN-PROGRESS') stepBg = 'bg-blue-100 dark:bg-blue-900/50 border border-blue-300 cursor-pointer hover:bg-blue-200';
              else if (isActive && isPending) stepBg = 'bg-amber-100 dark:bg-amber-900/50 border border-amber-300 cursor-pointer hover:bg-amber-200';
              else if (isCompleted) stepBg = 'bg-emerald-50 dark:bg-emerald-900/30 opacity-70';`;

const r2 = `              let stepBg = 'bg-slate-100 dark:bg-slate-800';
              if (step.status === 'IN-PROGRESS') stepBg = 'bg-blue-100 dark:bg-blue-900/50 border border-blue-300 cursor-pointer hover:bg-blue-200';
              else if (isPending) stepBg = 'bg-amber-100 dark:bg-amber-900/50 border border-amber-300 cursor-pointer hover:bg-amber-200';
              else if (isCompleted) stepBg = 'bg-emerald-50 dark:bg-emerald-900/30 opacity-70';`;

content = content.replace(t2, r2);

const t3 = `                  {isActive && isPending && (
                    <div className="text-[9px] text-amber-600 font-bold mt-1 animate-pulse flex items-center justify-center gap-1">
                      <span>Click to Start</span>
                    </div>
                  )}
                  {isActive && step.status === 'IN-PROGRESS' && (
                    <div className="text-[9px] text-blue-600 font-bold mt-1 animate-pulse flex items-center justify-center gap-1">
                      <span>Click to Finish</span>
                    </div>
                  )}`;

const r3 = `                  {isPending && (
                    <div className="text-[9px] text-amber-600 font-bold mt-1 animate-pulse flex items-center justify-center gap-1">
                      <span>Click to Start</span>
                    </div>
                  )}
                  {step.status === 'IN-PROGRESS' && (
                    <div className="text-[9px] text-blue-600 font-bold mt-1 animate-pulse flex items-center justify-center gap-1">
                      <span>Click to Finish</span>
                    </div>
                  )}`;

content = content.replace(t3, r3);

fs.writeFileSync('src/views/LiveDocksView.tsx', content);
console.log('patched LiveDocksView click logic');
