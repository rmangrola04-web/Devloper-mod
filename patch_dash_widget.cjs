const fs = require('fs');
let content = fs.readFileSync('src/components/DashboardWidget.tsx', 'utf-8');

const target = `const pendingPlans = useMemo(() => {
    return planEntries.filter(p => !p.status || p.status === 'Pending' || p.status === 'Planned').length;
  }, [planEntries]);`;

const replacement = `const pendingPlans = useMemo(() => {
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

content = content.replace(target, replacement);

const targetLabel = `<span className="text-xs text-purple-400 font-semibold">entries</span>`;
const replaceLabel = `<span className="text-xs text-purple-400 font-semibold">plans</span>`;
content = content.replace(targetLabel, replaceLabel);

fs.writeFileSync('src/components/DashboardWidget.tsx', content);
