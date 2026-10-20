import fs from 'fs';
let content = fs.readFileSync('index.html', 'utf8');

const functionsToExport = [
  'switchTab',
  'handleCompanyChange',
  'handleRouteTypeChange',
  'addMilkRouteStop',
  'handleGateSubmit',
  'renderDocks',
  'openSupervisorForm',
  'closeSupervisorModal',
  'handleSupervisorSubmit',
  'renderAuditLogs'
];

let exportScript = '\n        // Export to window for Vite module compatibility\n';
functionsToExport.forEach(fn => {
  exportScript += `        window.${fn} = ${fn};\n`;
});

content = content.replace('// --- INIT ---', exportScript + '\n        // --- INIT ---');
fs.writeFileSync('index.html', content);
console.log('Fixed globals');
