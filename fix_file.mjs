import fs from 'fs';
let content = fs.readFileSync('src/views/LoadUnloadView.tsx', 'utf8');

// Undo the wrong replacement in useEffect
// First, find the useEffect
const brokenUseEffect = `  React.useEffect(() => {
    
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
      
      if (opType === 'LOADING' && unit === 'BOTH') {
      const c1A = Number(cases1A) || 0;
      const c1B = Number(cases1B) || 0;
      const c2A = Number(cases2A) || 0;
      const c2B = Number(cases2B) || 0;
      const sum = c1A + c1B + c2A + c2B;
      setTotalCasesLoad(sum > 0 ? sum.toString() : '');
    }
  }, [cases1A, cases1B, cases2A, cases2B, unit, opType]);`;

const correctUseEffect = `  React.useEffect(() => {
    if (opType === 'LOADING' && unit === 'BOTH') {
      const c1A = Number(cases1A) || 0;
      const c1B = Number(cases1B) || 0;
      const c2A = Number(cases2A) || 0;
      const c2B = Number(cases2B) || 0;
      const sum = c1A + c1B + c2A + c2B;
      setTotalCasesLoad(sum > 0 ? sum.toString() : '');
    }
  }, [cases1A, cases1B, cases2A, cases2B, unit, opType]);`;

content = content.replace(brokenUseEffect, correctUseEffect);

// Apply replacement to handleSubmit
const targetSubmit = `      const opGrNo = isUnloading ? (gateMatch?.grNo || '') : '';

      if (opType === 'LOADING' && unit === 'BOTH') {`;

const replacedSubmit = `      const opGrNo = isUnloading ? (gateMatch?.grNo || '') : '';

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

content = content.replace(targetSubmit, replacedSubmit);

fs.writeFileSync('src/views/LoadUnloadView.tsx', content);
console.log('Fixed file');
