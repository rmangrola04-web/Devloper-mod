import fs from 'fs';
const file = './src/views/LiveDocksView.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldRender = `  const renderDockCard = (dockName: string, activeRecords: LoadUnloadEntry[]) => {
    if (activeRecords.length > 0) {
      const record = activeRecords[0];
      const isLoad = record.opType === 'LOADING';
      const vehicleNo = record.vehicleNo;

      const bgClass = isLoad 
        ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800'
        : 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-300 dark:border-blue-800';
      const dotClass = isLoad ? 'bg-amber-500 animate-pulse' : 'bg-blue-500 animate-pulse';
      const statusClass = isLoad ? 'text-amber-700 dark:text-amber-300' : 'text-blue-700 dark:text-blue-300';

      return (
        <div key={dockName} className={\`p-3 rounded border \${bgClass} space-y-1.5 text-xs shadow-xs\`}>
          <div className="flex justify-between items-center font-bold">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{dockName}</span>
            <span className={\`w-2 h-2 rounded-full \${dotClass}\`} />
          </div>
          <p className="font-bold text-xs text-blue-600 dark:text-blue-400 font-mono">{vehicleNo}</p>
          <p className={\`text-[10px] font-bold \${statusClass}\`}>
            {record.status}
          </p>
          <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-slate-700">`;

const newRender = `  const renderDockCard = (dockName: string, activeRecords: LoadUnloadEntry[]) => {
    if (activeRecords.length > 0) {
      const record = activeRecords[0];
      const isLoad = record.opType === 'LOADING';
      const vehicleNo = record.vehicleNo;

      const isAHPL = ['Dock 1', 'Dock 2', 'Dock 3', 'Dock 4'].includes(dockName);
      
      const cardColorClass = isAHPL
        ? 'border-l-[6px] border-l-blue-500 bg-blue-50/50 dark:bg-blue-900/20 border-t border-r border-b border-blue-200 dark:border-blue-800/50' 
        : 'border-l-[6px] border-l-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 border-t border-r border-b border-indigo-200 dark:border-indigo-800/50';

      const dotClass = isLoad ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500 animate-pulse';
      const statusClass = isLoad ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400';

      return (
        <div key={dockName} className={\`p-4 rounded-lg shadow-sm min-h-[180px] space-y-2 text-xs transition-all \${cardColorClass}\`}>
          <div className="flex justify-between items-center font-bold">
            <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100">{dockName}</span>
            <span className={\`w-2.5 h-2.5 rounded-full \${dotClass}\`} />
          </div>
          <div className="bg-white/60 dark:bg-slate-900/40 px-2 py-1.5 rounded flex justify-between items-center border border-slate-200/50 dark:border-slate-700/50">
             <p className="font-bold text-sm text-slate-800 dark:text-slate-100 font-mono">{vehicleNo}</p>
             <p className={\`text-[11px] font-bold uppercase tracking-wider \${statusClass}\`}>{record.status}</p>
          </div>
          
          <div className="space-y-2 pt-2 border-t border-slate-200/50 dark:border-slate-700/50">`;

content = content.replace(oldRender, newRender);

const oldEmpty = `    return (
      <div key={dockName} className="p-3 rounded bg-slate-50 dark:bg-slate-900/60 text-xs text-slate-400 space-y-1.5 border border-slate-200 dark:border-slate-700/80">
        <div className="flex justify-between items-center font-bold">
          <span className="text-slate-600 dark:text-slate-400 text-xs">{dockName}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
        </div>
        <p className="text-center py-2.5 text-[10px] font-medium text-slate-400">Available / Idle</p>
      </div>
    );`;

const newEmpty = `    return (
      <div key={dockName} className="p-4 rounded-xl bg-white dark:bg-slate-800/80 text-xs text-slate-400 space-y-2 border-2 border-dashed border-slate-300 dark:border-slate-600 min-h-[180px] flex flex-col transition-all hover:bg-slate-50 dark:hover:bg-slate-800">
        <div className="flex justify-between items-center font-bold">
          <span className="text-slate-500 dark:text-slate-400 text-sm">{dockName}</span>
          <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" />
        </div>
        <div className="flex-1 flex items-center justify-center">
            <p className="text-center text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Available / Idle</p>
        </div>
      </div>
    );`;

content = content.replace(oldEmpty, newEmpty);

fs.writeFileSync(file, content);
console.log('patched LiveDocksView styling');
