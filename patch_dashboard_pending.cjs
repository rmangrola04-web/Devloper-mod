const fs = require('fs');
let content = fs.readFileSync('src/views/DashboardView.tsx', 'utf-8');

const searchLogic = `  const totalPendingPlans = planEntries.length;
  const ailPendingPlans = planEntries.filter(p => (p.unit || '').toUpperCase() === 'AIL').length;
  const ahplPendingPlans = planEntries.filter(p => (p.unit || '').toUpperCase() !== 'AIL').length;

  // Unique Plan Destinations
  const uniqueDestinations = useMemo(() => {
    const dests = planEntries
      .map(entry => (entry.destination || '').trim().toUpperCase())
      .filter(Boolean);
    return Array.from(new Set(dests));
  }, [planEntries]);`;

const replaceLogic = `  // Unique Plan Destinations (Grouped by Plan/Shipment)
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
  }, [planEntries]);`;

content = content.replace(searchLogic, replaceLogic);

// Ensure the bottom split badges display "Plans" or "Dest", not "Veh"
const searchCard4 = `              <div className="bg-emerald-100/70 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800/80 rounded px-1.5 py-0.5 flex flex-col items-center">
                <span className="text-[8px] font-black uppercase text-emerald-800 dark:text-emerald-300">AIL</span>
                <span className="text-xs font-mono font-black text-emerald-950 dark:text-emerald-200">{ailPendingPlans} Veh</span>
              </div>
              <div className="bg-blue-100/70 dark:bg-blue-950/50 border border-blue-300 dark:border-blue-800/80 rounded px-1.5 py-0.5 flex flex-col items-center">
                <span className="text-[8px] font-black uppercase text-blue-800 dark:text-blue-300">AHPL</span>
                <span className="text-xs font-mono font-black text-blue-950 dark:text-blue-200">{ahplPendingPlans} Veh</span>`;

const replaceCard4 = `              <div className="bg-emerald-100/70 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800/80 rounded px-1.5 py-0.5 flex flex-col items-center">
                <span className="text-[8px] font-black uppercase text-emerald-800 dark:text-emerald-300">AIL</span>
                <span className="text-xs font-mono font-black text-emerald-950 dark:text-emerald-200">{ailPendingPlans} {ailPendingPlans === 1 ? 'Plan' : 'Plans'}</span>
              </div>
              <div className="bg-blue-100/70 dark:bg-blue-950/50 border border-blue-300 dark:border-blue-800/80 rounded px-1.5 py-0.5 flex flex-col items-center">
                <span className="text-[8px] font-black uppercase text-blue-800 dark:text-blue-300">AHPL</span>
                <span className="text-xs font-mono font-black text-blue-950 dark:text-blue-200">{ahplPendingPlans} {ahplPendingPlans === 1 ? 'Plan' : 'Plans'}</span>`;

content = content.replace(searchCard4, replaceCard4);

fs.writeFileSync('src/views/DashboardView.tsx', content);
