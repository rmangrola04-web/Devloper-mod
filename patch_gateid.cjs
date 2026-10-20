const fs = require('fs');
let content = fs.readFileSync('src/views/LoadUnloadView.tsx', 'utf8');

content = content.replace(/const op1: LoadUnloadEntry = \{/g, 'const op1: LoadUnloadEntry = {\n          gateId: selectedGateId,');
content = content.replace(/const op2: LoadUnloadEntry = \{/g, 'const op2: LoadUnloadEntry = {\n          gateId: selectedGateId,');
content = content.replace(/const newOp: LoadUnloadEntry = \{/g, 'const newOp: LoadUnloadEntry = {\n          gateId: selectedGateId,');

fs.writeFileSync('src/views/LoadUnloadView.tsx', content);
console.log('patched gateId');
