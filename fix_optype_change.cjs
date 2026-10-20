const fs = require('fs');

let content = fs.readFileSync('src/views/LoadUnloadView.tsx', 'utf8');

const oldChange = `                onChange={(e) => {
                  const val = e.target.value as 'LOADING' | 'UNLOADING';
                  setOpType(val);
                  if (val === 'LOADING') {
                    setFromLoc('INDORE HUB');
                    setToLoc(loadLocations[0] || 'MUMBAI');
                  } else {
                    setFromLoc(unloadLocations[0] || 'DEWAS FACTORY');
                    setToLoc('INDORE HUB');
                  }
                }}`;

const newChange = `                onChange={(e) => {
                  const val = e.target.value as 'LOADING' | 'UNLOADING';
                  setOpType(val);
                  if (val === 'LOADING') {
                    setFromLoc('INDORE HUB');
                    setToLoc('');
                  } else {
                    setFromLoc('');
                    setToLoc('INDORE HUB');
                  }
                }}`;

content = content.replace(oldChange, newChange);
fs.writeFileSync('src/views/LoadUnloadView.tsx', content);
console.log('Fixed opType onChange');
