const fs = require('fs');
let content = fs.readFileSync('src/views/GateSecurityView.tsx', 'utf8');

const t1 = `    // Auto-assigned Dedicated Dock logic based on division
    let autoAssignedDock = '';
    if (loadDivision === 'AHPL') {
       autoAssignedDock = 'Dock 1 (AHPL Zone)';
    } else if (loadDivision === 'AIL') {
       autoAssignedDock = 'Dock 7 (AIL Zone)';
    } else {
       autoAssignedDock = 'Dock 1 & Dock 7 (Split Zone)';
    }
    
    const newLog: SecurityGateEntry = {
      id: \`GATE-\${Date.now()}\`,
      purpose: purpose,
      vehicle: cleanVehicle,
      vType: vType,
      mobile: 'N/A', // Removed from UI
      transporter: 'N/A', // Removed from UI
      fromLoc: purpose === 'Unloading' ? destination : 'WAREHOUSE',
      toLoc: purpose === 'Loading' ? destination : 'WAREHOUSE',`;

const r1 = `    // Auto-assigned Dedicated Dock logic based on division
    let autoAssignedDock = '';
    if (loadDivision === 'AHPL') {
       autoAssignedDock = 'Dock 1 (AHPL Zone)';
    } else if (loadDivision === 'AIL') {
       autoAssignedDock = 'Dock 7 (AIL Zone)';
    } else {
       autoAssignedDock = 'Dock 1 & Dock 7 (Split Zone)';
    }
    
    // Resolve combined destination for Milk Route
    const combinedDestination = routeType === 'Milk Route' && milkRouteDestinations.length > 0 
      ? milkRouteDestinations.map(m => m.location).join(' / ')
      : destination;
    
    const newLog: SecurityGateEntry = {
      id: \`GATE-\${Date.now()}\`,
      purpose: purpose,
      vehicle: cleanVehicle,
      vType: vType,
      mobile: 'N/A',
      transporter: 'N/A',
      fromLoc: purpose === 'Unloading' ? combinedDestination : 'WAREHOUSE',
      toLoc: purpose === 'Loading' ? combinedDestination : 'WAREHOUSE',`;

content = content.replace(t1, r1);
fs.writeFileSync('src/views/GateSecurityView.tsx', content);
console.log('Patched GateSecurityView.tsx destination');
