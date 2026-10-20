import fs from 'fs';
const file = './src/views/LiveDocksView.tsx';
let content = fs.readFileSync(file, 'utf8');

const reps = [
  {
    from: `        <div key={dockName} className={\`p-4 rounded-lg shadow-sm min-h-[180px] space-y-2 text-xs transition-all \${cardColorClass}\`}>`,
    to: `        <div key={dockName} className={\`p-5 rounded-xl shadow-sm min-h-[200px] space-y-3 text-xs transition-all \${cardColorClass}\`}>`
  },
  {
    from: `          <div className="bg-white/60 dark:bg-slate-900/40 px-2 py-1.5 rounded flex justify-between items-center border border-slate-200/50 dark:border-slate-700/50">`,
    to: `          <div className="bg-white/60 dark:bg-slate-900/40 px-3 py-2.5 rounded-lg flex justify-between items-center border border-slate-200/50 dark:border-slate-700/50">`
  },
  {
    from: `          <div className="space-y-2 pt-2 border-t border-slate-200/50 dark:border-slate-700/50">`,
    to: `          <div className="space-y-3 pt-3 border-t border-slate-200/50 dark:border-slate-700/50">`
  },
  {
    from: `                  className={\`p-2 rounded \${stepBg} transition\`}`,
    to: `                  className={\`p-3 rounded-lg \${stepBg} transition\`}`
  },
  {
    from: `                  <div className="text-[10px] text-slate-700 dark:text-slate-300 font-bold">`,
    to: `                  <div className="text-[11px] text-slate-800 dark:text-slate-200 font-extrabold mt-1 mb-1">`
  },
  {
    from: `      <div key={dockName} className="p-4 rounded-xl bg-white dark:bg-slate-800/80 text-xs text-slate-400 space-y-2 border-2 border-dashed border-slate-300 dark:border-slate-600 min-h-[180px] flex flex-col transition-all hover:bg-slate-50 dark:hover:bg-slate-800">`,
    to: `      <div key={dockName} className="p-5 rounded-xl bg-white dark:bg-slate-800/80 text-xs text-slate-400 space-y-3 border-2 border-dashed border-slate-300 dark:border-slate-600 min-h-[200px] flex flex-col transition-all hover:bg-slate-50 dark:hover:bg-slate-800">`
  },
  {
    from: `      <div className="bg-white dark:bg-slate-800 p-4 rounded border border-slate-200 dark:border-slate-700 shadow-xs space-y-3">`,
    to: `      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-5">`
  },
  {
    from: `        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">`,
    to: `        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">`
  },
  {
    from: `        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">`,
    to: `        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">`
  }
];

reps.forEach(rep => {
  content = content.replace(rep.from, rep.to);
  // Need to do this globally for the double sections (AIL / AHPL)
  content = content.split(rep.from).join(rep.to);
});

fs.writeFileSync(file, content);
console.log('patched LiveDocksView layout');
