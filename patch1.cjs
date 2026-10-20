const fs = require('fs');
const file = './src/views/LoadUnloadView.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Import ShuttleStep
content = content.replace(
  "import { LoadUnloadEntry, SecurityGateEntry } from '../types';",
  "import { LoadUnloadEntry, SecurityGateEntry, ShuttleStep } from '../types';"
);

// 2. Add shuttle sequence states
const shuttleStates = `
  // Shuttle Sequence States
  const [shuttleSteps, setShuttleSteps] = useState<ShuttleStep[]>([]);
  const [shuttleUnit, setShuttleUnit] = useState('AIL');
  const [shuttleDock, setShuttleDock] = useState('Dock 5');
  const [shuttleDest, setShuttleDest] = useState(loadLocations[0] || '');

  const addShuttleStep = () => {
    setShuttleSteps([
      ...shuttleSteps,
      {
        id: \`STEP-\${Date.now()}\`,
        unit: shuttleUnit,
        bayNo: shuttleDock,
        destination: shuttleDest,
        cases: 0,
        status: 'PENDING'
      }
    ]);
  };

  const removeShuttleStep = (id: string) => {
    setShuttleSteps(shuttleSteps.filter(s => s.id !== id));
  };

  // Find waiting shuttles
  const waitingShuttles = loadEntries.filter(l => l.status === 'SHUTTLE TRANSIT' && l.shuttleSteps && l.currentStepIndex !== undefined && l.currentStepIndex < l.shuttleSteps.length);
`;

content = content.replace('const [startTime2, setStartTime2] = useState(() => new Date().toTimeString().substring(0, 5));', 'const [startTime2, setStartTime2] = useState(() => new Date().toTimeString().substring(0, 5));\n' + shuttleStates);

// 3. Update pendingGateLogs to include waitingShuttles in the dropdown
content = content.replace(
  '<option value="">-- Choose Arrived Vehicle (Auto-Fill) --</option>',
  '<option value="">-- Choose Arrived Vehicle (Auto-Fill) --</option>\n                {waitingShuttles.map(s => (\n                  <option key={s.id} value={`SHUTTLE_${s.id}`}>\n                    🚚 [SHUTTLE WAITING] {s.vehicleNo} | Next: {s.shuttleSteps![s.currentStepIndex!].unit} ({s.shuttleSteps![s.currentStepIndex!].bayNo})\n                  </option>\n                ))}'
);

// 4. Update handleGateSelect to handle SHUTTLE selection
const gateSelectRepl = `
  const handleGateSelect = (gateId: string) => {
    setSelectedGateId(gateId);
    
    if (gateId.startsWith('SHUTTLE_')) {
      const realId = gateId.replace('SHUTTLE_', '');
      const shuttle = loadEntries.find(l => l.id === realId);
      if (shuttle && shuttle.shuttleSteps && shuttle.currentStepIndex !== undefined) {
        const activeStep = shuttle.shuttleSteps[shuttle.currentStepIndex];
        setVehicleNo(shuttle.vehicleNo);
        setIsVehicleLocked(true);
        setTransporter(shuttle.transporter);
        setOpType('LOADING');
        setUnit(activeStep.unit);
        setBayNo(activeStep.bayNo);
        setToLoc(activeStep.destination);
        setFromLoc('INDORE HUB');
        handlePickCurrentTime();
      }
      return;
    }
    
    if (!gateId) {
`;
content = content.replace('const handleGateSelect = (gateId: string) => {\n    setSelectedGateId(gateId);\n    if (!gateId) {', gateSelectRepl);


// 5. Add SHUTTLE to unit dropdown
content = content.replace('<option value="THERMOCOL">THERMOCOL (All Docks)</option>', '<option value="THERMOCOL">THERMOCOL (All Docks)</option>\n                  <option value="SHUTTLE">SHUTTLE ROUTE (Multi-Dock)</option>');


fs.writeFileSync(file, content);
console.log('Done patch 1');
