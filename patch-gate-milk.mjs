import fs from 'fs';
const file = './src/views/GateSecurityView.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add MilkRouteStop interface
const stateSearch = `const [routeType, setRouteType] = useState<'Single Drop' | 'Milk Route'>('Single Drop');
  const [milkRouteDestinations, setMilkRouteDestinations] = useState<string[]>([]);
  const [selectedMilkLocation, setSelectedMilkLocation] = useState(loadLocations[0] || 'AHMEDABAD');`;

const stateReplace = `const [routeType, setRouteType] = useState<'Single Drop' | 'Milk Route'>('Single Drop');
  const [milkRouteDestinations, setMilkRouteDestinations] = useState<{location: string, unit: string}[]>([]);
  const [selectedMilkLocation, setSelectedMilkLocation] = useState(loadLocations[0] || 'AHMEDABAD');
  const [selectedMilkUnit, setSelectedMilkUnit] = useState('AIL');`;

content = content.replace(stateSearch, stateReplace);

// 2. Update addMilkDestination
const addSearch = `const addMilkDestination = () => {
    if (selectedMilkLocation && !milkRouteDestinations.includes(selectedMilkLocation)) {
      setMilkRouteDestinations([...milkRouteDestinations, selectedMilkLocation]);
    }
  };

  const removeMilkDestination = (locToRemove: string) => {
    setMilkRouteDestinations(milkRouteDestinations.filter(loc => loc !== locToRemove));
  };`;

const addReplace = `const addMilkDestination = () => {
    if (selectedMilkLocation && !milkRouteDestinations.find(m => m.location === selectedMilkLocation)) {
      const unit = loadDivision === 'BOTH' ? selectedMilkUnit : loadDivision;
      setMilkRouteDestinations([...milkRouteDestinations, { location: selectedMilkLocation, unit }]);
    }
  };

  const removeMilkDestination = (locToRemove: string) => {
    setMilkRouteDestinations(milkRouteDestinations.filter(m => m.location !== locToRemove));
  };`;

content = content.replace(addSearch, addReplace);

// 3. Update route clearing on division change (optional but good idea), but we don't strictly need to clear.

// 4. Update the "if (routeType === 'Milk Route')" string joining
const joinSearch = `if (routeType === 'Milk Route') {
        if (milkRouteDestinations.length === 0) {
          alert('Please add at least one destination for the Milk Route.');
          return;
        }
        toLoc = milkRouteDestinations.join(' | ');
      } else {`;
      
const joinReplace = `if (routeType === 'Milk Route') {
        if (milkRouteDestinations.length === 0) {
          alert('Please add at least one destination for the Milk Route.');
          return;
        }
        toLoc = milkRouteDestinations.map(m => m.location).join(' | ');
      } else {`;
      
content = content.replace(joinSearch, joinReplace);

// 5. Update the auto-dock assignment
const dockSearch = `// 1.5 Auto-create Operational Entry for Loading
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

      const newOp = {`;

const dockReplace = `// 1.5 Auto-create Operational Entry for Loading
    if (purpose === 'Loading') {
      const activeOps = activeOperations.filter(op => op.status !== 'LOADED' && op.status !== 'UNLOADED');
      
      // Helper to find free dock based on unit
      const getFreeDock = (unit) => {
          // Check what docks this unit is allowed to use from DOCK_CONFIG
          const allowedDocks = (unit === 'AHPL') ? ['Dock 1', 'Dock 2', 'Dock 3', 'Dock 4'] : ['Dock 7', 'Dock 8', 'Dock 9'];
          // Docks currently occupied by ANY step that is pending/in-progress
          // Actually, we can just look at op.bayNo for simplicity, or we check if anyone is physically on the dock.
          // Let's just avoid docks that are currently active in the main bayNo
          const occupied = activeOps.map(op => op.bayNo);
          return allowedDocks.find(d => !occupied.includes(d)) || allowedDocks[0]; // fallback to first allowed
      };
      
      let shuttleSteps = [];
      
      if (routeType === 'Milk Route' && milkRouteDestinations.length > 0) {
          shuttleSteps = milkRouteDestinations.map((dest, idx) => {
              const stepUnit = dest.unit;
              return {
                  id: \`STEP-\${Date.now()}-\${idx}\`,
                  unit: stepUnit,
                  bayNo: getFreeDock(stepUnit),
                  destination: dest.location,
                  cases: 0,
                  status: 'PENDING'
              };
          });
      } else {
          const stepUnit = loadDivision === 'BOTH' ? 'AIL' : loadDivision;
          shuttleSteps = [{
              id: \`STEP-\${Date.now()}-0\`,
              unit: stepUnit,
              bayNo: getFreeDock(stepUnit),
              destination: toLoc,
              cases: 0,
              status: 'PENDING'
          }];
      }

      const initialDock = shuttleSteps[0].bayNo;

      const newOp = {`;

content = content.replace(dockSearch, dockReplace);

// 6. Update bayNo in newOp initialization
content = content.replace("bayNo: freeDock,", "bayNo: initialDock,");

// 7. Update UI for milk route destinations adding
const uiSearch = `<div className="flex gap-2">
                      <select
                        value={selectedMilkLocation}
                        onChange={(e) => setSelectedMilkLocation(e.target.value)}
                        className="flex-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700/80 rounded-lg p-2 text-xs font-bold text-slate-800 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
                      >
                        {loadLocations.map((loc) => (
                          <option key={loc} value={loc}>
                            {loc}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={addMilkDestination}
                        className="px-3.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-extrabold uppercase tracking-wider rounded-lg border border-blue-300 dark:border-blue-700 hover:bg-blue-200 dark:hover:bg-blue-800/60 transition text-[11px] flex items-center gap-1 shadow-sm cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add
                      </button>
                    </div>
                    {milkRouteDestinations.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {milkRouteDestinations.map((loc, idx) => (
                          <div key={loc} className="flex items-center gap-1 bg-blue-600 text-white pl-2 pr-1 py-1 rounded text-[10px] font-bold shadow-sm group">
                            <span className="opacity-70 font-mono mr-0.5">{idx + 1}.</span> {loc}
                            <button
                              type="button"
                              onClick={() => removeMilkDestination(loc)}
                              className="hover:bg-blue-700 p-0.5 rounded transition ml-1 cursor-pointer"
                              title={\`Remove \${loc}\`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>`;

const uiReplace = `<div className="flex gap-2">
                      {loadDivision === 'BOTH' && (
                        <select
                          value={selectedMilkUnit}
                          onChange={(e) => setSelectedMilkUnit(e.target.value)}
                          className="w-1/3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700/80 rounded-lg p-2 text-xs font-bold text-slate-800 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
                        >
                          <option value="AIL">AIL</option>
                          <option value="AHPL">AHPL</option>
                        </select>
                      )}
                      <select
                        value={selectedMilkLocation}
                        onChange={(e) => setSelectedMilkLocation(e.target.value)}
                        className="flex-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700/80 rounded-lg p-2 text-xs font-bold text-slate-800 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
                      >
                        {loadLocations.map((loc) => (
                          <option key={loc} value={loc}>
                            {loc}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={addMilkDestination}
                        className="px-3.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-extrabold uppercase tracking-wider rounded-lg border border-blue-300 dark:border-blue-700 hover:bg-blue-200 dark:hover:bg-blue-800/60 transition text-[11px] flex items-center gap-1 shadow-sm cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add
                      </button>
                    </div>
                    {milkRouteDestinations.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {milkRouteDestinations.map((dest, idx) => (
                          <div key={dest.location} className={\`flex items-center gap-1 text-white pl-2 pr-1 py-1 rounded text-[10px] font-bold shadow-sm group \${dest.unit === 'AIL' ? 'bg-indigo-600' : 'bg-blue-600'}\`}>
                            <span className="opacity-70 font-mono mr-0.5">{idx + 1}.</span> {dest.location} <span className="opacity-80 text-[9px]">({dest.unit})</span>
                            <button
                              type="button"
                              onClick={() => removeMilkDestination(dest.location)}
                              className="hover:bg-black/20 p-0.5 rounded transition ml-1 cursor-pointer"
                              title={\`Remove \${dest.location}\`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>`;

content = content.replace(uiSearch, uiReplace);

fs.writeFileSync(file, content);
console.log('patched GateSecurityView');
