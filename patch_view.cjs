const fs = require('fs');
let content = fs.readFileSync('src/views/DashboardView.tsx', 'utf-8');

// First add archivedPlanEntries to props
content = content.replace(
  /interface DashboardViewProps {/,
  'interface DashboardViewProps {\n  archivedPlanEntries?: PlanEntry[];'
);

content = content.replace(
  /export const DashboardView: React.FC<DashboardViewProps> = \({/,
  'export const DashboardView: React.FC<DashboardViewProps> = ({\n  archivedPlanEntries = [],'
);

fs.writeFileSync('src/views/DashboardView.tsx', content);
