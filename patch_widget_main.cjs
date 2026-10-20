const fs = require('fs');
let content = fs.readFileSync('src/views/MainDashboardView.tsx', 'utf-8');

// Also update MainDashboardView to accept archivedPlanEntries
content = content.replace(
  /interface MainDashboardViewProps {/,
  'interface MainDashboardViewProps {\n  archivedPlanEntries?: PlanEntry[];'
);

content = content.replace(
  /export const MainDashboardView: React.FC<MainDashboardViewProps> = \({/,
  'export const MainDashboardView: React.FC<MainDashboardViewProps> = ({\n  archivedPlanEntries = [],'
);

content = content.replace(
  /<DashboardWidget planEntries={planEntries} loadEntries={loadEntries} securityLogs={securityLogs} \/>/g,
  '<DashboardWidget planEntries={planEntries} archivedPlanEntries={archivedPlanEntries} loadEntries={loadEntries} securityLogs={securityLogs} />'
);

content = content.replace(
  /<DashboardWidget\s+planEntries={planEntries}\s+loadEntries={loadEntries}\s+securityLogs={securityLogs}\s+\/>/g,
  '<DashboardWidget\n        planEntries={planEntries}\n        archivedPlanEntries={archivedPlanEntries}\n        loadEntries={loadEntries}\n        securityLogs={securityLogs}\n      />'
);

fs.writeFileSync('src/views/MainDashboardView.tsx', content);
