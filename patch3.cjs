const fs = require('fs');
const file = './src/views/LoadUnloadView.tsx';
let content = fs.readFileSync(file, 'utf8');

const submitReplacement = `
      if (unit === 'SHUTTLE') {
        if (shuttleSteps.length === 0) {
          alert('Please add at least one step for the shuttle sequence.');
          return;
        }
        
        const firstStep = shuttleSteps[0];
        
        const newOp: LoadUnloadEntry = {
          id: \`OP-\${Date.now()}\`,
          opType: 'LOADING',
          unit: firstStep.unit,
          bayNo: firstStep.bayNo,
          vehicleNo: vehicleNo.trim().toUpperCase(),
          fromLoc: 'INDORE HUB',
          toLoc: firstStep.destination,
          transporter,
          operator: operator.trim(),
          startTime: startTime || new Date().toTimeString().substring(0, 5),
          endTime: '',
          duration: '-- In Progress --',
          status: 'LOADING IN-PROGRESS',
          totalCases: 0,
          damagedCases: 0,
          damagedValue: 0,
          podStatus: 'N/A',
          grNo: '',
          remarks: 'Shuttle Sequence Active',
          shuttleSteps: shuttleSteps,
          currentStepIndex: 0
        };
        await onAddOperation(newOp);
        
        setSelectedGateId('');
        setIsVehicleLocked(false);
        setVehicleNo('');
        setShuttleSteps([]);
        handlePickCurrentTime();
        return;
      }
      
      if (opType === 'LOADING' && unit === 'BOTH') {`;

content = content.replace("if (opType === 'LOADING' && unit === 'BOTH') {", submitReplacement);

// Now patch the UI part.
// The form has "From & To", "Unit & Dock", "Vehicle Number & Transporter", "Supervisor", "Start Time".
// When `unit === 'SHUTTLE'`, we want to hide "From & To", "Assigned Dock No", and "Total Cases Loaded" and replace them with Shuttle Sequence builder.
// Actually, it's easier to just inject the Shuttle Sequence Builder after the "Operation Activity" dropdown.

const builderUI = `
            {/* SHUTTLE ROUTE BUILDER */}
            {unit === 'SHUTTLE' && (
              <div className="bg-purple-50/50 dark:bg-purple-900/20 p-3 rounded-lg border border-purple-200 dark:border-purple-800 space-y-3">
                <h4 className="text-[11px] font-bold text-purple-800 dark:text-purple-300 uppercase tracking-wider border-b border-purple-200 dark:border-purple-800 pb-1 flex justify-between items-center">
                  <span>Sequence-Based Shuttle Logistics</span>
                  <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Multi-Dock</span>
                </h4>
                
                <div className="space-y-2">
                  {shuttleSteps.map((step, idx) => (
                    <div key={step.id} className="bg-white dark:bg-slate-800 p-2 rounded border border-purple-100 dark:border-purple-800/50 flex items-center justify-between shadow-sm">
                      <div className="flex-1">
                        <div className="text-[10px] font-bold text-slate-500 mb-0.5">Step {idx + 1}</div>
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                          <span className="text-purple-600 dark:text-purple-400 uppercase">{step.unit}</span>
                          <span>→</span>
                          <span>{step.bayNo}</span>
                          <span>→</span>
                          <span>{step.destination}</span>
                        </div>
                      </div>
                      <button type="button" onClick={() => removeShuttleStep(step.id)} className="text-red-500 hover:text-red-700 p-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/50 p-2 rounded border border-slate-200 dark:border-slate-700 space-y-2 mt-2">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 mb-0.5">Company</label>
                      <select value={shuttleUnit} onChange={e => setShuttleUnit(e.target.value)} className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1 text-xs">
                        <option value="AIL">AIL</option>
                        <option value="AHPL">AHPL</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 mb-0.5">Dock No.</label>
                      <select value={shuttleDock} onChange={e => setShuttleDock(e.target.value)} className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1 text-xs">
                        {DOCK_CONFIG[shuttleUnit] && DOCK_CONFIG[shuttleUnit].map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 mb-0.5">Destination</label>
                      <select value={shuttleDest} onChange={e => setShuttleDest(e.target.value)} className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1 text-xs uppercase">
                        {loadLocations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                      </select>
                    </div>
                  </div>
                  <button type="button" onClick={addShuttleStep} className="w-full bg-purple-100 hover:bg-purple-200 text-purple-700 font-bold py-1.5 rounded text-xs transition border border-purple-200">
                    + Add Step to Route
                  </button>
                </div>
              </div>
            )}
`;

content = content.replace("{/* LOADING: Cases Loaded Field */}", builderUI + "\n\n            {/* LOADING: Cases Loaded Field */}");


// Finally, we need to add the badge for 'SHUTTLE TRANSIT' in the Active Dock Log
const activeDockLogReplacement = `
                    if (item.status === 'LOADED') {
                      statusBadge = (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                          ✔ LOADED
                        </span>
                      );
                    } else if (item.status === 'SHUTTLE TRANSIT') {
                      statusBadge = (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800 animate-pulse">
                          🔄 SHUTTLE NEXT STEP
                        </span>
                      );
                    } else if (item.status === 'UNLOADED') {`;

content = content.replace("if (item.status === 'LOADED') {\n                      statusBadge = (\n                        <span className=\"px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800\">\n                          ✔ LOADED\n                        </span>\n                      );\n                    } else if (item.status === 'UNLOADED') {", activeDockLogReplacement);


fs.writeFileSync(file, content);
console.log('Done patch 3');
