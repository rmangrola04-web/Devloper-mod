const fs = require('fs');
let content = fs.readFileSync('src/views/LoadUnloadView.tsx', 'utf8');

const t5 = `  // 1. Identify which gate logs have NOT been started yet.
  const usedVehicleNos = new Set(loadEntries.map((l) => l.vehicleNo));
  // Find all gate entries (excluding Parking/Transit) that aren't currently in operations
  const pendingGateLogs = securityLogs.filter(
    (veh) => veh.purpose !== 'Parking / Transit' && !usedVehicleNos.has(veh.vehicle)
  );`;

content = content.replace(t5, '');

fs.writeFileSync('src/views/LoadUnloadView.tsx', content);
console.log('removed pendingGateLogs from LoadUnloadView');
