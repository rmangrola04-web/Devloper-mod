const fs = require('fs');
let content = fs.readFileSync('src/views/LiveDocksView.tsx', 'utf8');

// The replacement logic:
const originalStr = `      const cardId = \`dock-card-\${dockName.replace(/\\s+/g, '-').toLowerCase()}\`;
      return (
        <div key={dockName} id={cardId} className={\`flex flex-col p-5 rounded-xl shadow-sm min-h-[250px] text-xs transition-all scroll-mt-6 \${cardColorClass}\`}>
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
            {record.shuttleSteps && record.shuttleSteps.map((step, index) => {
              const isActive = index === record.currentStepIndex;
              const isCompleted = step.status === 'COMPLETED';
              const isPending = step.status === 'PENDING';
              
              let stepBg = 'bg-slate-100 dark:bg-slate-800';
              if (isActive && step.status === 'IN-PROGRESS') stepBg = 'bg-blue-100 dark:bg-blue-900/50 border border-blue-300 cursor-pointer hover:bg-blue-200';
              else if (isActive && isPending) stepBg = 'bg-amber-100 dark:bg-amber-900/50 border border-amber-300 cursor-pointer hover:bg-amber-200';
              else if (isCompleted) stepBg = 'bg-emerald-50 dark:bg-emerald-900/30 opacity-70';

              return (
                <div 
                  key={step.id} 
                  className={\`p-3 rounded-lg \${stepBg} transition\`}
                  onClick={() => {
                    const el = document.getElementById(cardId);
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                    if (isActive) {
                      if (isPending) setStartingStep({ entry: record, index });
                      else if (step.status === 'IN-PROGRESS') setFinishingStep({ entry: record, index });
                    } else if (isCompleted) {
                      setFinishingStep({ entry: record, index });
                    }
                  }}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className={\`font-bold px-1.5 py-0.5 rounded text-[9px] \${
                      step.unit === 'AIL' ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700'
                    }\`}>
                      {step.unit || 'PENDING'}
                    </span>
                    <span className="text-[9px] font-bold text-slate-500">Step {index + 1}</span>
                  </div>
                  
                  <div className="text-[11px] text-slate-800 dark:text-slate-200 font-extrabold mt-1 mb-1">
                    {step.destination}
                  </div>
                  
                  {step.operator && (
                    <div className="text-[9px] text-slate-500 mt-1">Sup: {step.operator}</div>
                  )}
                  {isCompleted && (
                    <div className="text-[9px] text-emerald-600 font-bold mt-0.5">Cases: {step.cases} | {step.endTime}</div>
                  )}
                  {isActive && isPending && (
                    <div className="text-[9px] text-amber-600 font-bold mt-1 animate-pulse flex items-center justify-center gap-1">
                      <span>Click to Start</span>
                    </div>
                  )}
                  {isActive && step.status === 'IN-PROGRESS') && (
                    <div className="text-[9px] text-blue-600 font-bold mt-1 animate-pulse flex items-center justify-center gap-1">
                      <span>Click to Finish</span>
                    </div>
                  )}
                </div>
              );
            })}
            {!record.shuttleSteps && (
               <div 
                  className="p-2 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 cursor-pointer hover:bg-slate-200"
                  onClick={() => onEditOperation(record)}
               >
                  <div className="text-[10px] text-slate-700 dark:text-slate-300 font-bold text-center flex items-center justify-center gap-1">
                      <span>Legacy / Single Entry</span>
                  </div>
               </div>
            )}
          </div>
        </div>
      );
    }

    const cardId = \`dock-card-\${dockName.replace(/\\s+/g, '-').toLowerCase()}\`;
    return (
      <div key={dockName} id={cardId} className="p-5 rounded-xl bg-white dark:bg-slate-800/80 text-xs text-slate-400 space-y-3 border-2 border-dashed border-slate-300 dark:border-slate-600 min-h-[200px] flex flex-col transition-all hover:bg-slate-50 dark:hover:bg-slate-800 scroll-mt-6">`;


// Replace the specific chunk in the file
// Note: Due to formatting it's easier to regex replace or replace blocks.
