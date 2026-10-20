const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const target = `                  <MainDashboardView 
                    planEntries={planEntries}
                    loadEntries={loadEntries}
                    securityLogs={securityLogs}
                    trackingRecords={trackingRecords}
                  />`;

const replace = `                  <MainDashboardView 
                    planEntries={planEntries}
                    loadEntries={loadEntries}
                    securityLogs={securityLogs}
                    trackingRecords={trackingRecords}
                    onSelectVehicle={(gateId) => {
                      setInitialGateId(gateId);
                      handleSwitchView('loadUnloadView');
                    }}
                  />`;

// Handle possible space issue:
content = content.replace(target, replace);
// If it didn't match, maybe it's "MainDashboardView \n" or something
if (!content.includes('onSelectVehicle={(gateId) => {')) {
  console.log("fallback replacement");
  content = content.replace(/<MainDashboardView[\s\S]*?trackingRecords=\{trackingRecords\}[\s\S]*?\/>/, replace);
}

fs.writeFileSync('src/App.tsx', content);
console.log('patched App.tsx MainDashboard');
