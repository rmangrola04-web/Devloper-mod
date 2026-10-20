const fs = require('fs');
const file = './src/views/LoadUnloadView.tsx';
let content = fs.readFileSync(file, 'utf8');

// Hide Cases
content = content.replace(
  "{opType === 'LOADING' && (\\n              <div className=\\\"bg-amber-50/60 dark:bg-amber-950/20 p-2.5 rounded border border-amber-200 dark:border-amber-900/50 space-y-1\\\">",
  "{opType === 'LOADING' && unit !== 'SHUTTLE' && (\\n              <div className=\\\"bg-amber-50/60 dark:bg-amber-950/20 p-2.5 rounded border border-amber-200 dark:border-amber-900/50 space-y-1\\\">"
);

// Hide From & To
content = content.replace(
  "{/* From & To */}\\n            <div className=\\\"grid grid-cols-2 gap-2\\\">",
  "{/* From & To */}\\n            {unit !== 'SHUTTLE' && <div className=\\\"grid grid-cols-2 gap-2\\\">"
);
content = content.replace(
  "</div>\\n\\n            {/* Unit & Dock */}",
  "</div>}\\n\\n            {/* Unit & Dock */}"
);

// Hide Assigned Dock No
content = content.replace(
  "<div>\\n                <label className=\\\"block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1\\\">Assigned Dock No.</label>",
  "{unit !== 'SHUTTLE' && <div>\\n                <label className=\\\"block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1\\\">Assigned Dock No.</label>"
);
content = content.replace(
  "</select>\\n              </div>\\n            </div>\\n\\n            {/* Vehicle Number & Transporter */}",
  "</select>\\n              </div>}\\n            </div>\\n\\n            {/* Vehicle Number & Transporter */}"
);

// Hide Supervisor
content = content.replace(
  "{!(opType === 'LOADING' && unit === 'BOTH') && (",
  "{!(opType === 'LOADING' && unit === 'BOTH') && unit !== 'SHUTTLE' && ("
);

// Hide Start Time
content = content.replace(
  "{!(opType === 'LOADING' && unit === 'BOTH') && (\\n              <div>\\n                <div className=\\\"flex justify-between items-center mb-1\\\">\\n                  <label className=\\\"block text-[10px] font-bold text-slate-500 uppercase tracking-wider\\\">Operation Start Time *</label>",
  "{!(opType === 'LOADING' && unit === 'BOTH') && unit !== 'SHUTTLE' && (\\n              <div>\\n                <div className=\\\"flex justify-between items-center mb-1\\\">\\n                  <label className=\\\"block text-[10px] font-bold text-slate-500 uppercase tracking-wider\\\">Operation Start Time *</label>"
);


fs.writeFileSync(file, content);
console.log('Done patch 4');
