const fs = require('fs');
const file = './src/views/LoadUnloadView.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "{opType === 'LOADING' && (\\n              <div className=\\\"bg-amber-50/60 dark:bg-amber-950/20 p-2.5 rounded border border-amber-200 dark:border-amber-900/50 space-y-1\\\">",
  "{opType === 'LOADING' && unit !== 'SHUTTLE' && (\\n              <div className=\\\"bg-amber-50/60 dark:bg-amber-950/20 p-2.5 rounded border border-amber-200 dark:border-amber-900/50 space-y-1\\\">"
);

fs.writeFileSync(file, content);
console.log('Done patch 6');
