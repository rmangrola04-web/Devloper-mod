const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

content = content.replace(
  /<DashboardWidget planEntries={planEntries} loadEntries={loadEntries} securityLogs={securityLogs} \/>/g,
  '<DashboardWidget planEntries={planEntries} archivedPlanEntries={archivedPlanEntries} loadEntries={loadEntries} securityLogs={securityLogs} />'
);

fs.writeFileSync('src/App.tsx', content);
