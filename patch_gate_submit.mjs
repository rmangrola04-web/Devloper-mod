import fs from 'fs';

let content = fs.readFileSync('src/views/GateSecurityView.tsx', 'utf8');

const submitStartStr = `  const handleSubmit = (e: React.FormEvent) => {`;
const submitEndStr = `    setSuccessToast(\`Gate entry saved for \${cleanVehicle}\`);`;

const newSubmit = `  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleNo || !vType) {
      alert("Please fill all required fields.");
      return;
    }

    const cleanVehicle = vehicleNo.replace(/\\s+/g, '').toUpperCase();
    
    // We auto-assign the dock for simulation/saving purposes.
    const assignedDock = loadDivision === 'AHPL' ? 'Dock 1' : 'Dock 7';
    
    const newLog: SecurityGateEntry = {
      id: \`GATE-\${Date.now()}\`,
      purpose: purpose,
      vehicle: cleanVehicle,
      vType: vType,
      mobile: 'N/A', // Removed from form
      transporter: 'N/A', // Removed from form
      fromLoc: purpose === 'Unloading' ? destination : 'WAREHOUSE',
      toLoc: purpose === 'Loading' ? destination : 'WAREHOUSE',
      dateTime: dateTime || getCurrentFormattedDateTime(),
      remarks: supervisorNameRemarks,
      unit: loadDivision,
      grNo: '', // Removed from form
      routeType: routeType,
      milkRouteDestinations: routeType === 'Milk Route' ? milkRouteDestinations : [],
      assignedDock: assignedDock,
      loadingStartInTime: loadingStartInTime,
      loadingExitTime: loadingExitTime,
      totalCases: totalCases,
      supervisorNameRemarks: supervisorNameRemarks
    };

    onAddGateEntry(newLog);

    // 1.5 Auto-create Operational Entry for Loading
    if (purpose === 'Loading') {
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
          opType: 'LOADING',
          unit: loadDivision,
          bayNo: initialDock,
          vehicleNo: cleanVehicle,
          vType: vType,
          fromLoc: 'WAREHOUSE',
          toLoc: purpose === 'Loading' ? destination : 'WAREHOUSE',
          transporter: 'N/A',
          operator: '',
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
      
      onAddOperation(newOp);
    }

`;

let beforeSubmit = content.substring(0, content.indexOf(submitStartStr));
let afterSubmit = content.substring(content.indexOf(submitEndStr));

content = beforeSubmit + newSubmit + afterSubmit;

fs.writeFileSync('src/views/GateSecurityView.tsx', content);
console.log('patched submit');
