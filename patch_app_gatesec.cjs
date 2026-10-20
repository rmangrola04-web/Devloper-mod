const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const t1 = `              <GateSecurityView
                activeOperations={loadEntries}
                onAddOperation={async (op) => { await saveOperationToFirestore(op); }}
                securityLogs={securityLogs}
                transporters={transporters}
                vehicleTypes={vehicleTypes}
                loadLocations={loadLocations}
                unloadLocations={unloadLocations}
                onAddGateEntry={handleAddGateEntry}`;

const r1 = `              <GateSecurityView
                activeOperations={loadEntries}
                onAddOperation={async (op) => { await saveOperationToFirestore(op); }}
                securityLogs={securityLogs}
                transporters={transporters}
                vehicleTypes={vehicleTypes}
                loadLocations={loadLocations}
                unloadLocations={unloadLocations}
                planEntries={planEntries}
                onAddGateEntry={handleAddGateEntry}`;

const t2 = `                  <GateSecurityView
                    activeOperations={loadEntries}
                    onAddOperation={async (op) => { await saveOperationToFirestore(op); }}
                    securityLogs={securityLogs}
                    transporters={transporters}
                    vehicleTypes={vehicleTypes}
                    loadLocations={loadLocations}
                    unloadLocations={unloadLocations}
                    onAddGateEntry={handleAddGateEntry}`;

const r2 = `                  <GateSecurityView
                    activeOperations={loadEntries}
                    onAddOperation={async (op) => { await saveOperationToFirestore(op); }}
                    securityLogs={securityLogs}
                    transporters={transporters}
                    vehicleTypes={vehicleTypes}
                    loadLocations={loadLocations}
                    unloadLocations={unloadLocations}
                    planEntries={planEntries}
                    onAddGateEntry={handleAddGateEntry}`;

content = content.replace(t1, r1);
content = content.replace(t2, r2);

fs.writeFileSync('src/App.tsx', content);
console.log('patched App.tsx');
