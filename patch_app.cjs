const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

content = content.replace(
  /<DashboardView\s+planEntries={planEntries}\s+loadEntries={loadEntries}\s+securityLogs={securityLogs}\s+\/>/g,
  '<DashboardView\n                    planEntries={planEntries}\n                    archivedPlanEntries={archivedPlanEntries}\n                    loadEntries={loadEntries}\n                    securityLogs={securityLogs}\n                  />'
);

fs.writeFileSync('src/App.tsx', content);
