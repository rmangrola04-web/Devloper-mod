import fs from 'fs';
const file = './src/views/GateSecurityView.tsx';
let content = fs.readFileSync(file, 'utf8');

// Add Division State
content = content.replace(
  "const [successToast, setSuccessToast] = useState<string | null>(null);",
  "const [successToast, setSuccessToast] = useState<string | null>(null);\n  const [loadDivision, setLoadDivision] = useState('AIL');"
);

// Add Division UI
const divisionUI = `
                {purpose === 'Loading' && (
                  <div>
                    <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-blue-500" />
                      DIVISION (COMPANY) *
                    </label>
                    <select
                      value={loadDivision}
                      onChange={(e) => setLoadDivision(e.target.value)}
                      className="w-full bg-slate-50/80 dark:bg-[#252e3e]/70 border border-slate-300 dark:border-slate-700/80 rounded-lg p-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-[#2c3749] focus:border-blue-500 focus:outline-none transition backdrop-blur-xs"
                    >
                      <option value="AIL">AIL</option>
                      <option value="AHPL">AHPL</option>
                      <option value="BOTH">BOTH (Mixed)</option>
                    </select>
                  </div>
                )}
`;

content = content.replace(
  "{purpose === 'Unloading' && (\\n                  <div>\\n                    <label",
  divisionUI + "\\n\\n                {purpose === 'Unloading' && (\\n                  <div>\\n                    <label"
);

// Update handleSubmit
const submitSearch = `    const cleanVehicle = vehicleNo.trim().toUpperCase();
    if (!cleanVehicle) {
      alert('Vehicle Number is required!');
      return;
    }

    const cleanMobile = driverMobile.replace(/\\D/g, '');
    if (cleanMobile.length !== 10) {
      alert('Driver Mobile number must be exactly 10 digits!');
      return;
    }`;

const submitReplace = `    const cleanVehicle = vehicleNo.trim().toUpperCase();
    if (cleanVehicle.length !== 10) {
      alert('Vehicle Number must be exactly 10 characters (e.g., MP09AB1234)!');
      return;
    }

    const cleanMobile = driverMobile.replace(/\\D/g, '');
    if (cleanMobile.length !== 10) {
      alert('Driver Mobile number must be exactly 10 digits!');
      return;
    }`;

content = content.replace(submitSearch, submitReplace);

// Dock Assignment and pushing LoadUnloadEntry
const entryDispatchSearch = `    // 1. Dispatch Entry to App & Firestore
    onAddGateEntry(newEntry);

    // 2. Increment LocalStorage Counter for selected company (ONLY for Unloading)`;

const entryDispatchReplace = `    // 1. Dispatch Entry to App & Firestore
    onAddGateEntry(newEntry);

    // 1.5 Auto-create Operational Entry for Loading
    if (purpose === 'Loading') {
      const allDocks = ['Dock 1', 'Dock 2', 'Dock 3', 'Dock 4', 'Dock 5', 'Dock 6', 'Dock 7', 'Dock 8', 'Dock 9'];
      const occupiedDocks = activeOperations
          .filter(op => op.status !== 'LOADED' && op.status !== 'UNLOADED')
          .map(op => op.bayNo);
      const freeDock = allDocks.find(d => !occupiedDocks.includes(d)) || allDocks[0];
      
      let shuttleSteps = [];
      const initUnit = loadDivision === 'BOTH' ? 'AIL' : loadDivision;
      
      if (routeType === 'Milk Route' && milkRouteDestinations.length > 0) {
          shuttleSteps = milkRouteDestinations.map((dest, idx) => ({
              id: \`STEP-\${Date.now()}-\${idx}\`,
              unit: initUnit,
              bayNo: freeDock,
              destination: dest,
              cases: 0,
              status: 'PENDING'
          }));
      } else {
          shuttleSteps = [{
              id: \`STEP-\${Date.now()}-0\`,
              unit: initUnit,
              bayNo: freeDock,
              destination: toLoc,
              cases: 0,
              status: 'PENDING'
          }];
      }

      const newOp = {
          id: \`OP-\${Date.now()}\`,
          opType: 'LOADING',
          unit: loadDivision,
          bayNo: freeDock,
          vehicleNo: cleanVehicle,
          fromLoc: fromLoc,
          toLoc: toLoc,
          transporter: transporter,
          operator: '',
          startTime: '',
          endTime: '',
          duration: '-- In Progress --',
          status: 'PENDING',
          totalCases: 0,
          damagedCases: 0,
          damagedValue: 0,
          podStatus: 'N/A',
          grNo: '',
          remarks: 'Gate Assigned Dock',
          shuttleSteps: shuttleSteps,
          currentStepIndex: 0
      };
      
      // We pass the explicit type and any to bypass TS complaints in script
      onAddOperation(newOp as any);
    }

    // 2. Increment LocalStorage Counter for selected company (ONLY for Unloading)`;

content = content.replace(entryDispatchSearch, entryDispatchReplace);

fs.writeFileSync(file, content);
console.log('Gate patched for assignment');
