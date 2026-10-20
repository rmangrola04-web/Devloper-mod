const fs = require('fs');
let content = fs.readFileSync('src/components/DashboardWidget.tsx', 'utf-8');

// Add archivedPlanEntries to props
content = content.replace(
  /interface DashboardWidgetProps {/,
  'interface DashboardWidgetProps {\n  archivedPlanEntries?: PlanEntry[];'
);

content = content.replace(
  /export const DashboardWidget: React.FC<DashboardWidgetProps> = \({[\s\S]*?}\) => {/,
  `export const DashboardWidget: React.FC<DashboardWidgetProps> = ({
  planEntries,
  archivedPlanEntries = [],
  loadEntries,
  securityLogs
}) => {`
);

const target = `  const pendingPlans = useMemo(() => {
    const map = new Set<string>();
    planEntries.forEach(p => {
      if (!p.status || p.status === 'Pending' || p.status === 'Planned') {
        if (p.tripId) {
          map.add(\`TRIP_\${p.tripId}\`);
        } else {
          map.add(\`\${p.destination}_\${p.transporter}_\${p.vType}\`);
        }
      }
    });
    return map.size;
  }, [planEntries]);`;

const replacement = `  const todayStr = new Date().toDateString();

  const todaysAllPlans = useMemo(() => {
    const combined = [...planEntries, ...(archivedPlanEntries || [])];
    return combined.filter(p => {
      const dateString = (p as any).archivedAt || p.updatedAt;
      if (dateString) {
        return new Date(dateString).toDateString() === todayStr;
      }
      return planEntries.some(active => active.id === p.id);
    });
  }, [planEntries, archivedPlanEntries, todayStr]);

  const totalPlansToday = useMemo(() => {
    const map = new Set<string>();
    todaysAllPlans.forEach(p => {
      if (p.tripId) {
        map.add(\`TRIP_\${p.tripId}\`);
      } else {
        map.add(\`\${p.destination}_\${p.transporter}_\${p.vType}\`);
      }
    });
    return map.size;
  }, [todaysAllPlans]);

  const completedPlansToday = useMemo(() => {
    const map = new Set<string>();
    todaysAllPlans.forEach(p => {
      if (p.status === 'Confirmed Plan') {
        if (p.tripId) {
          map.add(\`TRIP_\${p.tripId}\`);
        } else {
          map.add(\`\${p.destination}_\${p.transporter}_\${p.vType}\`);
        }
      }
    });
    return map.size;
  }, [todaysAllPlans]);

  const pendingPlans = totalPlansToday - completedPlansToday;`;

content = content.replace(target, replacement);
fs.writeFileSync('src/components/DashboardWidget.tsx', content);
