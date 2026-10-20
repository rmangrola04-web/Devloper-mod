const fs = require('fs');

let content = fs.readFileSync('src/views/LoadUnloadView.tsx', 'utf8');

const oldCode = `    if (gate.purpose === 'Loading') {
      setOpType('LOADING');
      if (gate.unit) {
        handleUnitChange(gate.unit);
      }
      setFromLoc('INDORE HUB');
      setToLoc(gate.toLoc || loadLocations[0] || 'MUMBAI');
    } else {
      setOpType('UNLOADING');
      if (gate.unit) {
        handleUnitChange(gate.unit);
      }
      setFromLoc(gate.fromLoc || unloadLocations[0] || 'DEWAS FACTORY');
      setToLoc('INDORE HUB');
    }`;

const newCode = `    if (gate.purpose === 'Loading') {
      setOpType('LOADING');
      if (gate.unit && gate.unit !== 'BOTH' && gate.unit !== 'SHUTTLE') {
        handleUnitChange(gate.unit);
      }
      setFromLoc('INDORE HUB');
      
      if (gate.routeType === 'Milk Route' && gate.milkRouteDestinations && gate.milkRouteDestinations.length > 0) {
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
    }`;

if (content.includes(oldCode)) {
  content = content.replace(oldCode, newCode);
  fs.writeFileSync('src/views/LoadUnloadView.tsx', content);
  console.log('Replaced correctly!');
} else {
  console.log('Old code not found!');
}
