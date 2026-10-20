const fs = require('fs');

let content = fs.readFileSync('src/views/LiveDocksView.tsx', 'utf8');

const t1 = `      const cardId = \`dock-card-\${dockName.replace(/\\s+/g, '-').toLowerCase()}\`;

      return (
        <div key={dockName} id={cardId} className={\`flex flex-col p-6 rounded-2xl shadow-sm min-h-[340px] text-xs transition-all scroll-mt-6 \${cardColorClass}\`}>
          <div className="flex justify-between items-center font-bold mb-5">
            <span className="text-base font-extrabold text-slate-800 dark:text-slate-100">{dockName}</span>
            <div className="flex items-center gap-2">
              <span className={\`text-[10px] font-bold uppercase tracking-wider \${statusClass}\`}>{record.status === "LOADING IN-PROGRESS" || record.status === "UNLOADING IN-PROGRESS" ? "IN PROGRESS" : record.status}</span>
              <span className={\`w-3 h-3 rounded-full \${dotClass}\`} />
            </div>
          </div>
          
          {/* Top: Vehicle Number & Status */}`;

const r1 = `      const cardId = \`dock-card-\${dockName.replace(/\\s+/g, '-').toLowerCase()}\`;
      
      const MAX_CAPACITY = 4;
      const currentCount = activeRecords.length;
      const capacityPercent = Math.min(100, (currentCount / MAX_CAPACITY) * 100);
      let progressColor = 'bg-emerald-500';
      if (currentCount >= MAX_CAPACITY) progressColor = 'bg-red-500';
      else if (currentCount >= MAX_CAPACITY - 1) progressColor = 'bg-amber-500';

      return (
        <div key={dockName} id={cardId} className={\`flex flex-col p-6 rounded-2xl shadow-sm min-h-[340px] text-xs transition-all scroll-mt-6 \${cardColorClass}\`}>
          <div className="flex justify-between items-center font-bold mb-3">
            <span className="text-base font-extrabold text-slate-800 dark:text-slate-100">{dockName}</span>
            <div className="flex items-center gap-2">
              <span className={\`text-[10px] font-bold uppercase tracking-wider \${statusClass}\`}>{record.status === "LOADING IN-PROGRESS" || record.status === "UNLOADING IN-PROGRESS" ? "IN PROGRESS" : record.status}</span>
              <span className={\`w-3 h-3 rounded-full \${dotClass}\`} />
            </div>
          </div>
          
          <div className="mb-5">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Queue Capacity</span>
              <span className="text-[9px] font-bold text-slate-700 dark:text-slate-300">{currentCount} / {MAX_CAPACITY}</span>
            </div>
            <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div className={\`h-full \${progressColor} transition-all duration-500\`} style={{ width: \`\${capacityPercent}%\` }} />
            </div>
          </div>
          
          {/* Top: Vehicle Number & Status */}`;

content = content.replace(t1, r1);


const t2 = `    const cardId = \`dock-card-\${dockName.replace(/\\s+/g, '-').toLowerCase()}\`;
    return (
      <div key={dockName} id={cardId} className="p-6 rounded-2xl bg-white/50 dark:bg-slate-800/50 text-xs text-slate-400 space-y-3 border-2 border-dashed border-slate-300 dark:border-slate-600 min-h-[340px] flex flex-col transition-all hover:bg-slate-50 dark:hover:bg-slate-800 scroll-mt-6">
        <div className="flex justify-between items-center font-bold mb-5">
          <span className="text-base text-slate-500 dark:text-slate-400">{dockName}</span>
          <span className="w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-600" />
        </div>
        <div className="flex-1 flex items-center justify-center">
            <p className="text-center text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Available / Idle</p>
        </div>
      </div>
    );`;

const r2 = `    const cardId = \`dock-card-\${dockName.replace(/\\s+/g, '-').toLowerCase()}\`;
    const MAX_CAPACITY = 4;
    return (
      <div key={dockName} id={cardId} className="p-6 rounded-2xl bg-white/50 dark:bg-slate-800/50 text-xs text-slate-400 space-y-3 border-2 border-dashed border-slate-300 dark:border-slate-600 min-h-[340px] flex flex-col transition-all hover:bg-slate-50 dark:hover:bg-slate-800 scroll-mt-6">
        <div className="flex justify-between items-center font-bold mb-3">
          <span className="text-base text-slate-500 dark:text-slate-400">{dockName}</span>
          <span className="w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-600" />
        </div>
        
        <div className="mb-5">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Queue Capacity</span>
            <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400">0 / {MAX_CAPACITY}</span>
          </div>
          <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-slate-300 dark:bg-slate-600 transition-all duration-500" style={{ width: '0%' }} />
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center">
            <p className="text-center text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Available / Idle</p>
        </div>
      </div>
    );`;

content = content.replace(t2, r2);

fs.writeFileSync('src/views/LiveDocksView.tsx', content);
console.log('patched dock capacities');
