const fs = require('fs');
let content = fs.readFileSync('src/views/PlanView.tsx', 'utf-8');
content = content.replace(
  "entryIds: string[]; isMilkRoute: boolean }>();",
  "entryIds: string[]; isMilkRoute: boolean; hasCarriedForward: boolean }>();"
);
fs.writeFileSync('src/views/PlanView.tsx', content);
