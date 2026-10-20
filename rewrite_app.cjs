const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

// Add initialDest state
const stateInsert = `  const [initialGateId, setInitialGateId] = useState<string | null>(null);
  const [initialDest, setInitialDest] = useState<{location: string, unit?: string} | null>(null);`;
content = content.replace("  const [initialGateId, setInitialGateId] = useState<string | null>(null);", stateInsert);

// Replace onSelectVehicle in WaitingQueueView
const oldWaitingSelect = `                    onSelectVehicle={(gateId) => {
                      setInitialGateId(gateId);
                      handleSwitchView('loadUnloadView');
                    }}`;
const newWaitingSelect = `                    onSelectVehicle={(gateId, dest) => {
                      setInitialGateId(gateId);
                      if (dest) setInitialDest(dest);
                      else setInitialDest(null);
                      handleSwitchView('loadUnloadView');
                    }}`;
content = content.replace(oldWaitingSelect, newWaitingSelect);

// Replace onSelectVehicle in MainDashboardView
const oldMainSelect = `                    onSelectVehicle={(gateId) => {
                      setInitialGateId(gateId);
                      handleSwitchView('loadUnloadView');
                    }}`;
const newMainSelect = `                    onSelectVehicle={(gateId, dest) => {
                      setInitialGateId(gateId);
                      if (dest) setInitialDest(dest);
                      else setInitialDest(null);
                      handleSwitchView('loadUnloadView');
                    }}`;
content = content.replace(oldMainSelect, newMainSelect);

// Replace onClearInitialGateId in LoadUnloadView
const oldLoadClear = `                    onClearInitialGateId={() => setInitialGateId(null)}`;
const newLoadClear = `                    initialDest={initialDest}
                    onClearInitialGateId={() => {
                      setInitialGateId(null);
                      setInitialDest(null);
                    }}`;
content = content.replace(oldLoadClear, newLoadClear);

fs.writeFileSync('src/App.tsx', content);
console.log('App.tsx updated');
