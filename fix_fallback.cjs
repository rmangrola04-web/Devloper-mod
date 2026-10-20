const fs = require('fs');

let content = fs.readFileSync('src/views/LoadUnloadView.tsx', 'utf8');

const oldCode2 = `    if (!gateId) {
      setIsVehicleLocked(false);
      setVehicleNo('');
      setFromLoc('INDORE HUB');
      setToLoc(loadLocations[0] || '');
      return;
    }`;

const newCode2 = `    if (!gateId) {
      setIsVehicleLocked(false);
      setVehicleNo('');
      setFromLoc('INDORE HUB');
      setToLoc('');
      return;
    }`;

if (content.includes(oldCode2)) {
  content = content.replace(oldCode2, newCode2);
  fs.writeFileSync('src/views/LoadUnloadView.tsx', content);
  console.log('Replaced fallback correctly!');
} else {
  console.log('Old fallback code not found!');
}
