const fs = require('fs');

const orig = fs.readFileSync('current_gate.tsx', 'utf8').split('\n');

const topPart = orig.slice(0, 81).join('\n');
const bottomPart = orig.slice(690).join('\n');

const middlePart = `
  // 11-Parameter Strict Tracking Form State
  const [purpose, setPurpose] = useState<'Loading' | 'Unloading'>('Loading');
  const [vehicleNo, setVehicleNo] = useState('');
  const [vType, setVType] = useState('32 FT Standard');
  const [loadDivision, setLoadDivision] = useState('AIL');
  const [routeType, setRouteType] = useState<'Single Drop' | 'Milk Route'>('Single Drop');
  
  // Helper to format current Indian timestamp
  const getCurrentFormattedDateTime = () => {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return \`\${pad(now.getDate())}/\${pad(now.getMonth() + 1)}/\${now.getFullYear()}, \${pad(now.getHours())}:\${pad(now.getMinutes())}:\${pad(now.getSeconds())}\`;
  };
  
  const [dateTime, setDateTime] = useState(getCurrentFormattedDateTime());
  const [destination, setDestination] = useState(loadLocations[0] || 'AHMEDABAD');
  const [loadingStartInTime, setLoadingStartInTime] = useState('');
  const [loadingExitTime, setLoadingExitTime] = useState('');
  const [totalCases, setTotalCases] = useState<number | ''>('');
  const [supervisorNameRemarks, setSupervisorNameRemarks] = useState('');

  // Milk Route States
  const [milkRouteDestinations, setMilkRouteDestinations] = useState<{location: string, unit: string}[]>([]);
  const [selectedMilkLocation, setSelectedMilkLocation] = useState(loadLocations[0] || 'AHMEDABAD');
  const [selectedMilkUnit, setSelectedMilkUnit] = useState('AIL');
  
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const addMilkDestination = () => {
    if (selectedMilkLocation && !milkRouteDestinations.find(m => m.location === selectedMilkLocation)) {
      const unit = loadDivision === 'BOTH' ? selectedMilkUnit : loadDivision;
      setMilkRouteDestinations([...milkRouteDestinations, { location: selectedMilkLocation, unit }]);
    }
  };

  const removeMilkDestination = (locToRemove: string) => {
    setMilkRouteDestinations(milkRouteDestinations.filter(m => m.location !== locToRemove));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleNo || !vType) {
      alert("Please fill all required fields.");
      return;
    }

    const cleanVehicle = vehicleNo.replace(/\\s+/g, '').toUpperCase();
    
    // Auto-assigned Dedicated Dock logic based on division
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
      toLoc: purpose === 'Loading' ? destination : 'WAREHOUSE',
      dateTime: dateTime || getCurrentFormattedDateTime(),
      remarks: supervisorNameRemarks,
      unit: loadDivision,
      grNo: '', 
      routeType: routeType,
      milkRouteDestinations: routeType === 'Milk Route' ? milkRouteDestinations : [],
      assignedDock: autoAssignedDock,
      loadingStartInTime: loadingStartInTime,
      loadingExitTime: loadingExitTime,
      totalCases: totalCases,
      supervisorNameRemarks: supervisorNameRemarks
    };

    onAddGateEntry(newLog);

    // 1.5 Auto-create Operational Entry
    const activeOps = activeOperations.filter(op => op.status !== 'LOADED' && op.status !== 'UNLOADED');
    
    // Helper to find free dock based on unit
    let ahplCount = 0;
    let ailCount = 0;
    const getDockByUnitSeq = (unit: string) => {
        if (unit === 'AHPL') {
            const allowedDocks = ['Dock 1', 'Dock 2', 'Dock 3', 'Dock 4'];
            const dock = allowedDocks[ahplCount % allowedDocks.length];
            ahplCount++;
            return dock;
        } else {
            const allowedDocks = ['Dock 7', 'Dock 8', 'Dock 9'];
            const dock = allowedDocks[ailCount % allowedDocks.length];
            ailCount++;
            return dock;
        }
    };
    
    let shuttleSteps: any[] = [];
    
    if (routeType === 'Milk Route' && milkRouteDestinations.length > 0) {
        shuttleSteps = milkRouteDestinations.map((dest, idx) => {
            const stepUnit = dest.unit;
            const autoDock = getDockByUnitSeq(stepUnit);
            return {
                id: \`STEP-\${Date.now()}-\${idx}\`,
                unit: stepUnit,
                bayNo: autoDock,
                assignedDock: autoDock,
                destination: dest.location,
                cases: 0,
                status: 'PENDING'
            };
        });
    } else {
        const stepUnit = loadDivision === 'BOTH' ? 'AIL' : loadDivision;
        const autoDock = getDockByUnitSeq(stepUnit);
        shuttleSteps = [{
            id: \`STEP-\${Date.now()}-0\`,
            unit: stepUnit,
            bayNo: autoDock,
            assignedDock: autoDock,
            destination: purpose === 'Loading' ? destination : 'WAREHOUSE',
            cases: 0,
            status: 'PENDING'
        }];
    }

    const initialDock = shuttleSteps[0].bayNo;

    const newOp: LoadUnloadEntry = {
        id: \`OP-\${Date.now()}\`,
        opType: purpose === 'Loading' ? 'LOADING' : 'UNLOADING',
        unit: loadDivision,
        bayNo: initialDock,
        vehicleNo: cleanVehicle,
        vType: vType,
        fromLoc: purpose === 'Unloading' ? destination : 'WAREHOUSE',
        toLoc: purpose === 'Loading' ? destination : 'WAREHOUSE',
        transporter: 'N/A',
        operator: supervisorNameRemarks,
        startTime: loadingStartInTime,
        endTime: loadingExitTime,
        duration: '-- In Progress --',
        status: 'PENDING',
        totalCases: Number(totalCases) || 0,
        damagedCases: 0,
        damagedValue: 0,
        podStatus: 'N/A',
        grNo: '',
        remarks: supervisorNameRemarks,
        shuttleSteps: shuttleSteps as any,
        currentStepIndex: 0
    };
    
    onAddOperation(newOp as any);

    setVehicleNo('');
    setRemarks('');
    setDateTime(getCurrentFormattedDateTime());
    setMilkRouteDestinations([]);
    setSuccessToast(\`Entry Saved: [\${purpose}] | Vehicle: \${cleanVehicle}\`);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  return (
    <div className="h-full flex flex-col bg-slate-50/50 dark:bg-[#1a202c]">
      {successToast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-500 text-white px-4 py-3 rounded-lg shadow-xl font-bold flex items-center gap-2 animate-in slide-in-from-top-2 fade-in duration-300">
          <CheckCircle className="w-5 h-5" />
          {successToast}
        </div>
      )}

      <div className="flex-1 p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start overflow-y-auto custom-scrollbar">
        
        {/* LEFT COLUMN: STRICT 11-FIELD SECURITY GUARD GATE ENTRY FORM */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white dark:bg-[#1e2430] border border-blue-200/60 dark:border-slate-700/80 rounded-xl shadow-xs overflow-hidden">
            
            <div className="px-4 py-3.5 bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-800 dark:to-blue-900 border-b border-blue-700 flex justify-between items-center shadow-inner">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-white/10 rounded-md">
                  <Truck className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-widest text-white drop-shadow-sm">
                    Gate Register
                  </h2>
                  <p className="text-[10px] text-blue-100/80">Strict 11-Parameter Tracking</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
              
              {/* 1. Purpose */}
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Purpose *
                </label>
                <select
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value as 'Loading' | 'Unloading')}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none"
                >
                  <option value="Loading">Loading</option>
                  <option value="Unloading">Unloading</option>
                </select>
              </div>

              {/* 2 & 3. Vehicle Number & Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Vehicle Number (Strict 10) *
                  </label>
                  <input
                    type="text"
                    value={vehicleNo}
                    onChange={(e) => setVehicleNo(e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase())}
                    maxLength={10}
                    placeholder="MH12AB1234"
                    required
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Master Vehicle Type *
                  </label>
                  <select
                    value={vType}
                    onChange={(e) => setVType(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none"
                  >
                    <option value="24 FT Vehicle">24 FT Vehicle</option>
                    <option value="32 FT Multi Axle">32 FT Multi Axle</option>
                    <option value="Single Axle">Single Axle</option>
                    <option value="Milk Tanker">Milk Tanker</option>
                    <option value="32 FT Standard">32 FT Standard</option>
                  </select>
                </div>
              </div>

              {/* 4 & 5. Company Division & Route Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Company Division *
                  </label>
                  <select
                    value={loadDivision}
                    onChange={(e) => setLoadDivision(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none"
                  >
                    <option value="AIL">AIL</option>
                    <option value="AHPL">AHPL</option>
                    <option value="BOTH">BOTH</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Route Type *
                  </label>
                  <select
                    value={routeType}
                    onChange={(e) => setRouteType(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none"
                  >
                    <option value="Single Drop">Single Drop</option>
                    <option value="Milk Route">Milk Route</option>
                  </select>
                </div>
              </div>

              {/* 6. Gate Entry Timestamp */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Gate Entry Timestamp *
                  </label>
                  <button
                    type="button"
                    onClick={() => setDateTime(getCurrentFormattedDateTime())}
                    className="text-[10px] text-blue-600 font-bold hover:underline"
                  >
                    Auto Pick Current
                  </button>
                </div>
                <input
                  type="text"
                  value={dateTime}
                  onChange={(e) => setDateTime(e.target.value)}
                  placeholder="DD/MM/YYYY, HH:MM:SS"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-xs font-mono font-bold text-slate-800 dark:text-slate-100 focus:outline-none"
                />
              </div>

              {/* 7. Target Drop Location / Destinations */}
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Target Drop Location / Destination Stops *
                </label>
                {routeType === 'Milk Route' ? (
                  <div className="space-y-2 p-3 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-lg">
                    <div className="flex gap-2">
                      {loadDivision === 'BOTH' && (
                        <select
                          value={selectedMilkUnit}
                          onChange={(e) => setSelectedMilkUnit(e.target.value)}
                          className="w-1/3 bg-white dark:bg-slate-800 border border-blue-300 dark:border-slate-700 rounded-lg p-2 text-xs font-bold text-slate-800 dark:text-slate-100"
                        >
                          <option value="AIL">AIL</option>
                          <option value="AHPL">AHPL</option>
                        </select>
                      )}
                      <select
                        value={selectedMilkLocation}
                        onChange={(e) => setSelectedMilkLocation(e.target.value)}
                        className="flex-1 bg-white dark:bg-slate-800 border border-blue-300 dark:border-slate-700 rounded-lg p-2 text-xs font-bold text-slate-800 dark:text-slate-100"
                      >
                        {loadLocations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                      </select>
                      <button
                        type="button"
                        onClick={addMilkDestination}
                        className="px-3 bg-blue-600 text-white font-bold rounded-lg text-xs hover:bg-blue-700"
                      >
                        Add
                      </button>
                    </div>
                    {milkRouteDestinations.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {milkRouteDestinations.map(dest => (
                          <div key={dest.location} className="flex items-center gap-1 bg-blue-600 text-white px-2 py-1 rounded text-[10px] font-bold">
                            {dest.location} ({dest.unit})
                            <button type="button" onClick={() => removeMilkDestination(dest.location)} className="hover:bg-black/20 rounded p-0.5"><X className="w-3 h-3" /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <select
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none"
                  >
                    {loadLocations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                  </select>
                )}
              </div>

              {/* 8. Assigned Dedicated Dock (Read-Only) */}
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Assigned Dedicated Dock
                </label>
                <input
                  type="text"
                  value={
                    loadDivision === 'AIL' ? 'Auto-Assigned to AIL Zone (Docks 7-9)' :
                    loadDivision === 'AHPL' ? 'Auto-Assigned to AHPL Zone (Docks 1-4)' :
                    'Auto-Assigned sequentially per Stop'
                  }
                  disabled
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 rounded-lg p-2.5 text-[11px] font-bold cursor-not-allowed"
                />
              </div>

              {/* 9 & 10. Loading Start / Exit Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    {purpose} Start In-Time
                  </label>
                  <input
                    type="time"
                    value={loadingStartInTime}
                    onChange={(e) => setLoadingStartInTime(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    {purpose} Exit-Time
                  </label>
                  <input
                    type="time"
                    value={loadingExitTime}
                    onChange={(e) => setLoadingExitTime(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              {/* 11 & 12. Total Cases & Supervisor Remarks */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Total Cases / Cartons
                  </label>
                  <input
                    type="number"
                    value={totalCases}
                    onChange={(e) => setTotalCases(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="0"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Supervisor Name & Remarks
                  </label>
                  <input
                    type="text"
                    value={supervisorNameRemarks}
                    onChange={(e) => setSupervisorNameRemarks(e.target.value)}
                    placeholder="Remarks / Sign off..."
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-lg shadow-sm transition flex items-center justify-center gap-2 mt-2"
              >
                <CheckCircle className="w-4 h-4" />
                Submit Tracking Log
              </button>
            </form>
          </div>
        </div>
`;

const finalFile = topPart + '\n' + middlePart + '\n' + bottomPart;
fs.writeFileSync('src/views/GateSecurityView.tsx', finalFile);
console.log('rewritten GateSecurityView.tsx successfully');
