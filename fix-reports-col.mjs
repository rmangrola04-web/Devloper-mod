import fs from 'fs';
const file = './src/views/ReportsView.tsx';
let content = fs.readFileSync(file, 'utf8');

// There is a potential mismatched JSX issue in the fallback legacy rendering if I didn't adjust colSpan correctly.
// Let's make sure it's correct.
content = content.replace(
  '<td colSpan={onEditOperation ? 12 : 11} className="text-center py-16 text-slate-400">',
  '<td colSpan={onEditOperation ? 10 : 9} className="text-center py-16 text-slate-400">'
);
fs.writeFileSync(file, content);
