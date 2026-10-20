const fs = require('fs');
let content = fs.readFileSync('src/views/WaitingQueueView.tsx', 'utf8');

const target = `  // Pending gate arrivals that haven't been started yet
  const usedVehicleNos = new Set(loadEntries.map((l) => l.vehicleNo));
  const pendingGateLogs = securityLogs.filter(
    (veh) => veh.purpose !== 'Parking / Transit' && !usedVehicleNos.has(veh.vehicle)
  );`;

const replacement = `  // Pending gate arrivals that haven't been started yet
  const usedGateIds = new Set(loadEntries.map((l) => l.gateId).filter(Boolean));
  const activeOps = loadEntries.filter(l => l.status !== 'LOADED' && l.status !== 'UNLOADED');
  const activeVehicleNos = new Set(activeOps.map((l) => l.vehicleNo));
  const allUsedVehicleNos = new Set(loadEntries.map((l) => l.vehicleNo));

  const pendingGateLogs = securityLogs.filter((veh) => {
    if (veh.purpose === 'Parking / Transit') return false;
    
    // 1. If it was explicitly processed with the new gateId logic
    if (usedGateIds.has(veh.id)) return false;
    
    // 2. If it's a vehicle that currently has an ACTIVE operation, don't show another pending entry for it
    if (activeVehicleNos.has(veh.vehicle)) return false;
    
    // 3. Fallback for legacy entries before we added gateId tracking (cutoff: ~Sep 2026)
    const isLegacy = veh.id.startsWith('GATE-') ? parseInt(veh.id.replace('GATE-', '')) < 1788600000000 : false;
    if (isLegacy && allUsedVehicleNos.has(veh.vehicle)) return false;

    return true;
  });`;

content = content.replace(target, replacement);
fs.writeFileSync('src/views/WaitingQueueView.tsx', content);
console.log('patched WaitingQueueView');
