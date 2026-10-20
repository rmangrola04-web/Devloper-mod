const fs = require('fs');
let content = fs.readFileSync('src/views/DashboardView.tsx', 'utf-8');

const target = `  // Unique Plan Destinations (Grouped by Plan/Shipment)
  const uniqueDestinations = useMemo(() => {
    const dests = planEntries
      .map(entry => (entry.destination || '').trim().toUpperCase())
      .filter(Boolean);
    return Array.from(new Set(dests));
  }, [planEntries]);

  // Main Counter for Pending Plans (grouped by unique plan/shipment)
  const totalPendingPlans = uniqueDestinations.length;

  // Split Unique Plans by Company (AIL vs AHPL)
  const ailPendingPlans = useMemo(() => {
    const dests = planEntries
      .filter(p => (p.unit || '').toUpperCase() === 'AIL')
      .map(entry => (entry.destination || '').trim().toUpperCase())
      .filter(Boolean);
    return new Set(dests).size;
  }, [planEntries]);

  const ahplPendingPlans = useMemo(() => {
    const dests = planEntries
      .filter(p => (p.unit || '').toUpperCase() !== 'AIL')
      .map(entry => (entry.destination || '').trim().toUpperCase())
      .filter(Boolean);
    return new Set(dests).size;
  }, [planEntries]);

  const distinctPlansCount = useMemo(() => {
    const map = new Set<string>();
    planEntries.forEach(p => {
      if (p.tripId) {
        map.add(\`TRIP_\${p.tripId}\`);
      } else {
        map.add(\`\${p.destination}_\${p.transporter}_\${p.vType}\`);
      }
    });
    return map.size;
  }, [planEntries]);`;

const replacement = `  // ===== FIXED METRICS CALCULATION =====
  const todayStr = new Date().toDateString();

  const todaysAllPlans = useMemo(() => {
    const combined = [...planEntries, ...(archivedPlanEntries || [])];
    return combined.filter(p => {
      const dateString = p.updatedAt; // or archivedAt
      if (dateString) {
        return new Date(dateString).toDateString() === todayStr;
      }
      return planEntries.some(active => active.id === p.id);
    });
  }, [planEntries, archivedPlanEntries, todayStr]);

  const distinctPlansCount = useMemo(() => {
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

  const totalPendingPlans = distinctPlansCount - completedPlansToday;

  // Split Pending Plans by Company (AIL vs AHPL)
  const ailPendingPlans = useMemo(() => {
    const dests = todaysAllPlans
      .filter(p => p.status !== 'Confirmed Plan' && (p.unit || '').toUpperCase() === 'AIL')
      .map(entry => (entry.destination || '').trim().toUpperCase())
      .filter(Boolean);
    return new Set(dests).size;
  }, [todaysAllPlans]);

  const ahplPendingPlans = useMemo(() => {
    const dests = todaysAllPlans
      .filter(p => p.status !== 'Confirmed Plan' && (p.unit || '').toUpperCase() !== 'AIL')
      .map(entry => (entry.destination || '').trim().toUpperCase())
      .filter(Boolean);
    return new Set(dests).size;
  }, [todaysAllPlans]);
  // ===================================`;

content = content.replace(target, replacement);
fs.writeFileSync('src/views/DashboardView.tsx', content);
