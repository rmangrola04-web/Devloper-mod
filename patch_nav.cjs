const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

// Replace the container wrapper class
content = content.replace(
  'className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#1e293b]/90 backdrop-blur-md border border-slate-700/50 rounded-full px-4 py-2.5 flex justify-center items-center z-50 shadow-2xl gap-3 sm:gap-6 w-[92%] max-w-sm"',
  'className="md:hidden fixed bottom-4 left-1/2 -translate-x-1/2 bg-[#1e293b]/90 backdrop-blur-md border border-slate-700/50 rounded-full px-2 py-2 flex justify-between items-center z-50 shadow-2xl gap-1 w-[98%] max-w-[420px] overflow-x-auto no-scrollbar"'
);

// Reduce button widths
content = content.replace(/min-w-\[3rem\]/g, 'min-w-[2.75rem] px-1');

fs.writeFileSync('src/App.tsx', content);
