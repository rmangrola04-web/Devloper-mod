const fs = require('fs');
let content = fs.readFileSync('src/views/GateSecurityView.tsx', 'utf8');

const target = `    // Auto-assigned Dedicated Dock logic based on division
    let autoAssignedDock = '';
    if (loadDivision === 'AHPL') {
       autoAssignedDock = 'Dock 1 (AHPL Zone)';
    } else if (loadDivision === 'AIL') {
       autoAssignedDock = 'Dock 7 (AIL Zone)';
    } else {
       autoAssignedDock = 'Dock 1 & Dock 7 (Split Zone)';
    }`;

const replace = `    // Auto-assigned Dedicated Dock logic removed
    let autoAssignedDock = 'Unassigned';`;

content = content.replace(target, replace);
fs.writeFileSync('src/views/GateSecurityView.tsx', content);
console.log('patched GateSecurityView');
