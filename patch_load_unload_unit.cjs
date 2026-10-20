const fs = require('fs');
let content = fs.readFileSync('src/views/LoadUnloadView.tsx', 'utf8');

const target = `    if (gate.purpose === 'Loading') {
      setOpType('LOADING');
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

const replacement = `    if (gate.purpose === 'Loading') {
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

content = content.replace(target, replacement);
fs.writeFileSync('src/views/LoadUnloadView.tsx', content);
console.log('patched unit in handleGateSelect');
