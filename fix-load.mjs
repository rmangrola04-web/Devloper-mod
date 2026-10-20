import fs from 'fs';
let content = fs.readFileSync('src/views/LoadUnloadView.tsx', 'utf8');

const replacement = `  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleNo.trim()) {
      alert('Please enter a vehicle number');
      return;
    }
    
    try {
      const isUnloading = opType === 'UNLOADING';
      const totalCasesVal = isUnloading
        ? (totalCasesUnload !== '' ? Number(totalCasesUnload) : 0)
        : (totalCasesLoad !== '' ? Number(totalCasesLoad) : 0);

      const gateMatch = securityLogs.find((s) => s.id === selectedGateId || (s.vehicle === vehicleNo.trim().toUpperCase() && s.purpose === 'Unloading'));
      const opGrNo = isUnloading ? (gateMatch?.grNo || '') : '';

      const newOp: LoadUnloadEntry = {
        id: \`OP-\${Date.now()}\`,
        opType,
        unit,
        bayNo,
        vehicleNo: vehicleNo.trim().toUpperCase(),
        fromLoc: fromLoc.trim().toUpperCase(),
        toLoc: toLoc.trim().toUpperCase(),
        transporter,
        operator: (opType === 'LOADING' && unit === 'BOTH') ? \`\${supervisor1} & \${supervisor2}\` : operator.trim(),
        startTime: startTime || new Date().toTimeString().substring(0, 5),
        endTime: '',
        duration: '-- In Progress --',
        status: opType === 'LOADING' ? 'LOADING IN-PROGRESS' : 'UNLOADING IN-PROGRESS',
        totalCases: totalCasesVal,
        damagedCases: isUnloading && damagedCases !== '' ? Number(damagedCases) : 0,
        damagedValue: isUnloading && damagedValue !== '' ? Number(damagedValue) : 0,
        podStatus: isUnloading ? unloadingPodStatus : 'N/A',
        grNo: opGrNo,
        remarks: (opType === 'LOADING' && unit === 'BOTH') ? \`Dual Load - \${company1}: \${cases1} cases, \${company2}: \${cases2} cases\` : ''
      };

      // Call the add operation which writes to Firebase
      await onAddOperation(newOp);

      // Reset Form
      setSelectedGateId('');
      setIsVehicleLocked(false);
      setVehicleNo('');
      setTotalCasesLoad('');
      setTotalCasesUnload('');
      setDamagedCases('');
      setDamagedValue('');
      handlePickCurrentTime();
      
    } catch (err) {
      console.error('Error starting operation:', err);
      alert('Failed to submit. Please check missing fields or connection.');
    }
  };`;

content = content.replace(/  const handleSubmit = \(e: React\.FormEvent\) => \{[\s\S]*?handlePickCurrentTime\(\);\n  \};/, replacement);

// Replace onAddOperation signature
content = content.replace(/onAddOperation: \(newOp: LoadUnloadEntry\) => void;/, 'onAddOperation: (newOp: LoadUnloadEntry) => Promise<void> | void;');

fs.writeFileSync('src/views/LoadUnloadView.tsx', content);
