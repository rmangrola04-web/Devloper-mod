const fs = require('fs');
const file = './src/views/LoadUnloadView.tsx';
let content = fs.readFileSync(file, 'utf8');

const submitReplacement = `      if (unit === 'SHUTTLE') {
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

// Remove it from useEffect
content = content.replace(submitReplacement, "if (opType === 'LOADING' && unit === 'BOTH') {");

// Put it into handleSubmit
const searchStr = `  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleNo.trim()) {
      alert('Please enter or select a vehicle number.');
      return;
    }

    try {
      if (opType === 'LOADING' && unit === 'BOTH') {`;

const replaceStr = `  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleNo.trim()) {
      alert('Please enter or select a vehicle number.');
      return;
    }

    try {
${submitReplacement}`;

content = content.replace(searchStr, replaceStr);

fs.writeFileSync(file, content);
console.log('Fixed load');
