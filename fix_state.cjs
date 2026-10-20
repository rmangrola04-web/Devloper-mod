const fs = require('fs');

let content = fs.readFileSync('src/views/LoadUnloadView.tsx', 'utf8');

// 1. Add sealNumber to state
const stateInsertionPoint = "const [operator, setOperator] = useState(supervisors[0] || 'Rahul Mangrola');";
content = content.replace(stateInsertionPoint, `${stateInsertionPoint}
  const [sealNumber, setSealNumber] = useState('');`);

// 2. Fix the "Start Operation (Submit to Dock)" button text to "Save & Process"
content = content.replace(
  /> Start Operation \(Submit to Dock\)/g,
  '> Save & Process'
);

// 3. Update the handleGateSelect logic to properly use milkRouteDestinations
const newHandleGateSelect = `  const handleGateSelect = (gateId: string) => {
    setSelectedGateId(gateId);
    
    if (!gateId) {
      setIsVehicleLocked(false);
      setVehicleNo('');
      setFromLoc('INDORE HUB');
      setToLoc('');
      return;
    }

    const gate = securityLogs.find((s) => s.id === gateId);
    if (!gate) return;

    setVehicleNo(gate.vehicle);
    setIsVehicleLocked(true);
    if (gate.transporter && transporters.includes(gate.transporter)) {
      setTransporter(gate.transporter);
    }
    
    if (gate.purpose === 'Loading') {
      setOpType('LOADING');
      if (gate.unit && gate.unit !== 'BOTH' && gate.unit !== 'SHUTTLE') {
        handleUnitChange(gate.unit);
      }
      setFromLoc('INDORE HUB');
      
      if (gate.routeType === 'Milk Route' && gate.milkRouteDestinations && gate.milkRouteDestinations.length > 0) {
        // Milk route format: DEST (UNIT) / DEST (UNIT)
        const combinedDest = gate.milkRouteDestinations.map(m => m.unit ? \`\${m.location} (\${m.unit})\` : m.location).join(' / ');
        setToLoc(combinedDest);
      } else {
        setToLoc(gate.toLoc || '');
      }
    } else {
      setOpType('UNLOADING');
      if (gate.unit && gate.unit !== 'BOTH' && gate.unit !== 'SHUTTLE') {
        handleUnitChange(gate.unit);
      }
      
      if (gate.routeType === 'Milk Route' && gate.milkRouteDestinations && gate.milkRouteDestinations.length > 0) {
        const combinedDest = gate.milkRouteDestinations.map(m => m.unit ? \`\${m.location} (\${m.unit})\` : m.location).join(' / ');
        setFromLoc(combinedDest);
      } else {
        setFromLoc(gate.fromLoc || '');
      }
      setToLoc('INDORE HUB');
    }
    handlePickCurrentTime();
  };`;

content = content.replace(/  const handleGateSelect = \(gateId: string\) => \{[\s\S]*?    \}\n    handlePickCurrentTime\(\);\n  \};\n/g, newHandleGateSelect);

fs.writeFileSync('src/views/LoadUnloadView.tsx', content);
console.log('Fixed state');
