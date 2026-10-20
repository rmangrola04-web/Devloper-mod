const fs = require('fs');
let content = fs.readFileSync('src/views/MainDashboardView.tsx', 'utf-8');

const target = `const totalPlanned = planEntries.filter(p => p.status === 'Planned' || p.status === 'Pending' || !p.status).length;
  const totalConfirmed = planEntries.filter(p => p.status === 'Confirmed').length;`;

const replacement = `const getDistinctPlansCount = (entries: typeof planEntries) => {
    const map = new Set<string>();
    entries.forEach(p => {
      if (p.tripId) {
        map.add(\`TRIP_\${p.tripId}\`);
      } else {
        map.add(\`\${p.destination}_\${p.transporter}_\${p.vType}\`);
      }
    });
    return map.size;
  };
  const totalPlanned = getDistinctPlansCount(planEntries.filter(p => p.status === 'Planned' || p.status === 'Pending' || !p.status));
  const totalConfirmed = getDistinctPlansCount(planEntries.filter(p => p.status === 'Confirmed Plan' || p.status === 'Confirmed'));`;

content = content.replace(target, replacement);
fs.writeFileSync('src/views/MainDashboardView.tsx', content);
