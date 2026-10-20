const fs = require('fs');
let content = fs.readFileSync('src/views/MainDashboardView.tsx', 'utf-8');

const targetAmber = `<span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold uppercase text-right">
                Entries
              </span>`;
const replaceAmber = `<span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold uppercase text-right">
                Plans
              </span>`;

const targetBlue = `<span className="text-[10px] text-blue-700 dark:text-blue-400 font-bold uppercase text-right">
                Entries
              </span>`;
const replaceBlue = `<span className="text-[10px] text-blue-700 dark:text-blue-400 font-bold uppercase text-right">
                Plans
              </span>`;

content = content.replace(targetAmber, replaceAmber).replace(targetBlue, replaceBlue);
fs.writeFileSync('src/views/MainDashboardView.tsx', content);
