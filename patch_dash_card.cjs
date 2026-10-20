const fs = require('fs');
let content = fs.readFileSync('src/views/DashboardView.tsx', 'utf-8');

const distinctCountCode = `  const distinctPlansCount = useMemo(() => {
    const map = new Set<string>();
    planEntries.forEach(p => {
      if (p.tripId) {
        map.add(\`TRIP_\${p.tripId}\`);
      } else {
        map.add(\`\${p.destination}_\${p.transporter}_\${p.vType}\`);
      }
    });
    return map.size;
  }, [planEntries]);

  // Filtered Operations`;

content = content.replace("  // Filtered Operations", distinctCountCode);

const oldCard = `<div className="widget-main-stat text-sky-950 dark:text-sky-300">
                {planEntries.length}
              </div>
              <span className="text-[10px] text-sky-700 dark:text-sky-400 font-bold uppercase text-right">
                Total Number<br/>Of Plan
              </span>`;

const newCard = `<div className="widget-main-stat text-sky-950 dark:text-sky-300">
                {distinctPlansCount}
              </div>
              <span className="text-[10px] text-sky-700 dark:text-sky-400 font-bold uppercase text-right">
                Total<br/>Plans
              </span>`;

content = content.replace(oldCard, newCard);
fs.writeFileSync('src/views/DashboardView.tsx', content);
