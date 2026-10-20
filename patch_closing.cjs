const fs = require('fs');
let content = fs.readFileSync('src/views/DashboardView.tsx', 'utf-8');

content = content.replace(
  /            <p className="text-\[10px\] text-sky-800\/80 dark:text-slate-400 font-medium mt-1 text-right\">\s*Total Plan Entries for Today\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/,
  '            <p className="text-[10px] text-sky-800/80 dark:text-slate-400 font-medium mt-1 text-right">\n              Total Plan Entries for Today\n            </p>\n          </div>\n        </div>\n      </div>'
);

fs.writeFileSync('src/views/DashboardView.tsx', content);
