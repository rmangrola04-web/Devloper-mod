const fs = require('fs');
let content = fs.readFileSync('src/views/DashboardView.tsx', 'utf-8');

// Add import
const importStat = `import { PlanEntry, LoadUnloadEntry, SecurityGateEntry } from '../types';\nimport { DashboardWidget } from '../components/DashboardWidget';`;
content = content.replace("import { PlanEntry, LoadUnloadEntry, SecurityGateEntry } from '../types';", importStat);

// Add component inside return
const renderStart = `  return (
    <section className="space-y-4">
      <DashboardWidget planEntries={planEntries} loadEntries={loadEntries} securityLogs={securityLogs} />

      {/* 5 Primary Operational KPI Cards */}`;
content = content.replace(`  return (
    <section className="space-y-4">
      {/* 5 Primary Operational KPI Cards */}`, renderStart);

fs.writeFileSync('src/views/DashboardView.tsx', content);
