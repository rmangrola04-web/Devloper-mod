import fs from 'fs';
const file = './src/views/ReportsView.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add Dock Header
content = content.replace(
  '<th className="py-2.5 px-2.5">Location (Destination)</th>',
  '<th className="py-2.5 px-2.5">Assigned Dock</th>\n                  <th className="py-2.5 px-2.5">Location (Destination)</th>'
);

// 2. Add Dock Data Cell
const cellSearch = `<td className="py-3 px-2.5 font-bold text-slate-700 dark:text-slate-300">{step.destination}</td>`;
const cellReplace = `<td className="py-3 px-2.5 text-slate-600 dark:text-slate-400 font-mono text-[10px]">{step.bayNo}</td>
                              <td className="py-3 px-2.5 font-bold text-slate-700 dark:text-slate-300">{step.destination}</td>`;

content = content.replace(cellSearch, cellReplace);

// 3. Update colSpan
content = content.replace(
  '<td colSpan={onEditOperation ? 10 : 9}',
  '<td colSpan={onEditOperation ? 11 : 10}'
);

fs.writeFileSync(file, content);
console.log('patched ReportsView columns');
