const fs = require('fs');
let content = fs.readFileSync('src/views/LiveDocksView.tsx', 'utf8');

const t1 = '          <div className="flex justify-between items-center font-bold mb-3">\n' +
           '            <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100">{dockName}</span>\n' +
           '            <span className={`w-2.5 h-2.5 rounded-full ${dotClass}`} />\n' +
           '          </div>\n' +
           '          \n' +
           '          {/* Top: Vehicle Number */}\n' +
           '          <div className="bg-white/80 dark:bg-slate-900/60 px-3 py-2 rounded-lg border border-slate-200/50 dark:border-slate-700/50 mb-4 shadow-sm">\n' +
           '             <p className="font-bold text-lg text-slate-800 dark:text-slate-100 font-mono text-center tracking-widest">{vehicleNo}</p>\n' +
           '          </div>\n' +
           '          \n' +
           '          {/* Middle: Shuttle Steps */}\n' +
           '          <div className="flex-1 space-y-3">';

const r1 = '          <div className="flex justify-between items-center font-bold mb-5">\n' +
           '            <span className="text-base font-extrabold text-slate-800 dark:text-slate-100">{dockName}</span>\n' +
           '            <div className="flex items-center gap-2">\n' +
           '              <span className={`text-[10px] font-bold uppercase tracking-wider ${statusClass}`}>{record.status === "LOADING IN-PROGRESS" || record.status === "UNLOADING IN-PROGRESS" ? "IN PROGRESS" : record.status}</span>\n' +
           '              <span className={`w-3 h-3 rounded-full ${dotClass}`} />\n' +
           '            </div>\n' +
           '          </div>\n' +
           '          \n' +
           '          {/* Top: Vehicle Number & Status */}\n' +
           '          <div className="bg-white/80 dark:bg-slate-900/60 px-4 py-4 rounded-xl border border-slate-200/50 dark:border-slate-700/50 mb-6 shadow-sm flex flex-col items-center justify-center space-y-1">\n' +
           '             <p className="font-black text-2xl text-slate-800 dark:text-slate-100 font-mono tracking-widest">{vehicleNo}</p>\n' +
           '             <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{record.vType || "Vehicle"}</p>\n' +
           '          </div>\n' +
           '          \n' +
           '          {/* Middle: Shuttle Steps */}\n' +
           '          <div className="flex-1 space-y-4 pt-4 border-t border-slate-200/50 dark:border-slate-700/50">\n' +
           '            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Destination Stops</p>';

content = content.replace(t1, r1);

// Also replace p-5 rounded-xl shadow-sm min-h-[250px] with p-6 rounded-2xl shadow-sm min-h-[340px]
content = content.replace('p-5 rounded-xl shadow-sm min-h-[250px]', 'p-6 rounded-2xl shadow-sm min-h-[340px]');

// Replace shuttle step padding
const t2 = "className={`p-3 rounded-lg ${stepBg} transition`}";
const r2 = "className={`p-4 rounded-xl ${stepBg} transition shadow-sm border border-slate-200/50 dark:border-slate-700/50`}";
content = content.replace(t2, r2);

// Replace empty card
const t3 = '<div key={dockName} id={cardId} className="p-5 rounded-xl bg-white dark:bg-slate-800/80 text-xs text-slate-400 space-y-3 border-2 border-dashed border-slate-300 dark:border-slate-600 min-h-[200px] flex flex-col transition-all hover:bg-slate-50 dark:hover:bg-slate-800 scroll-mt-6">\n        <div className="flex justify-between items-center font-bold">\n          <span className="text-slate-500 dark:text-slate-400 text-sm">{dockName}</span>\n          <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" />\n        </div>\n        <div className="flex-1 flex items-center justify-center">\n            <p className="text-center text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Available / Idle</p>\n        </div>\n      </div>';

const r3 = '<div key={dockName} id={cardId} className="p-6 rounded-2xl bg-white/50 dark:bg-slate-800/50 text-xs text-slate-400 space-y-3 border-2 border-dashed border-slate-300 dark:border-slate-600 min-h-[340px] flex flex-col transition-all hover:bg-slate-50 dark:hover:bg-slate-800 scroll-mt-6">\n        <div className="flex justify-between items-center font-bold mb-5">\n          <span className="text-base text-slate-500 dark:text-slate-400">{dockName}</span>\n          <span className="w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-600" />\n        </div>\n        <div className="flex-1 flex items-center justify-center">\n            <p className="text-center text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Available / Idle</p>\n        </div>\n      </div>';

content = content.replace(t3, r3);

fs.writeFileSync('src/views/LiveDocksView.tsx', content);
console.log('patched LiveDocksView');
