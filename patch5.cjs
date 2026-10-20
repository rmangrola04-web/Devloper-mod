const fs = require('fs');
const file = './src/views/LoadUnloadView.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /{opType === 'LOADING' && \(\\s+<div className="bg-amber/g,
  "{opType === 'LOADING' && unit !== 'SHUTTLE' && (\\n              <div className=\\\"bg-amber"
);

content = content.replace(
  /\{\/\* From & To \*\/\}\\s+<div className="grid grid-cols-2 gap-2">/,
  "{/* From & To */}\\n            {unit !== 'SHUTTLE' && <div className=\\\"grid grid-cols-2 gap-2\\\">"
);

content = content.replace(
  /<\/div>\\s+<\/div>\\s+\{\/\* Unit & Dock \*\/\}/,
  "</div>\\n              </div>}\\n\\n            {/* Unit & Dock */}"
);

content = content.replace(
  /<div>\\s+<label className="block text-\[10px\] font-bold text-slate-500 uppercase tracking-wider mb-1">Assigned Dock No\.<\/label>/,
  "{unit !== 'SHUTTLE' && <div>\\n                <label className=\\\"block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1\\\">Assigned Dock No.</label>"
);

content = content.replace(
  /<\/select>\\s+<\/div>\\s+<\/div>\\s+\{\/\* Vehicle Number & Transporter \*\/\}/,
  "</select>\\n              </div>}\\n            </div>\\n\\n            {/* Vehicle Number & Transporter */}"
);

content = content.replace(
  /\{\!\(opType === 'LOADING' && unit === 'BOTH'\) && \(\\s+<div>\\s+<div className="flex justify-between items-center mb-1">\\s+<label className="block text-\[10px\] font-bold text-slate-500 uppercase tracking-wider">Operation Start Time \*/,
  "{!(opType === 'LOADING' && unit === 'BOTH') && unit !== 'SHUTTLE' && (\\n              <div>\\n                <div className=\\\"flex justify-between items-center mb-1\\\">\\n                  <label className=\\\"block text-[10px] font-bold text-slate-500 uppercase tracking-wider\\\">Operation Start Time *"
);

fs.writeFileSync(file, content);
console.log('Done patch 5');
